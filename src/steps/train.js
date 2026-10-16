import { config } from "../config.js";
import { fillLoginModalIfOpen } from "./login.js";

const CLASS_TAB_LABEL = {
  SL: /sleeper\s*\(SL\)/i,
  "3E": /AC 3 Economy \(3E\)/i,
  "3A": /AC 3 Tier \(3A\)/i,
  "2A": /AC 2 Tier \(2A\)/i,
  "1A": /AC First Class \(1A\)/i,
  "2S": /second seating \(2S\)/i,
  CC: /chair car \(CC\)/i,
};

function classLabelPattern(classCode) {
  const code = classCode.toUpperCase();
  return CLASS_TAB_LABEL[code] || new RegExp(`\\(${code}\\)`, "i");
}

function normalizeTrainNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(0, 5);
}

/** e.g. JOURNEY_DATE 2026-10-17 → "Sat, 17 Oct" */
function dateCardLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  const date = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[date.getDay()]}, ${d} ${months[m - 1]}`;
}

function trainRowLocator(page, trainNo) {
  const pattern = new RegExp(`\\(${trainNo}\\)|\\b${trainNo}\\b`);
  let row = page.locator("app-train-avl-enq").filter({ hasText: pattern }).first();

  if (config.train.name) {
    row = page
      .locator("app-train-avl-enq")
      .filter({ hasText: new RegExp(config.train.name, "i") })
      .filter({ hasText: pattern })
      .first();
  }

  return row;
}

async function selectClassTab(row, classCode) {
  const label = classLabelPattern(classCode);
  const tab = row.getByText(label).first();
  await tab.scrollIntoViewIfNeeded();
  await tab.click({ force: true });
  console.log(`Selected class tab (${classCode.toUpperCase()}).`);
  await row.page().waitForTimeout(600);
}

/** White date tile → orange when selected; Book Now activates only after this. */
async function selectJourneyDateCard(row, isoDate) {
  const label = dateCardLabel(isoDate);
  const [y, m, d] = isoDate.split("-");

  await row.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));

  const clicked = await row.evaluate((root, dateLabel) => {
    const status = /WL\d+|AVAILABLE|RAC|REGRET|GNWL|TQWL/i;
    const nodes = [...root.querySelectorAll("div, a, button, span")];
    const cards = nodes
      .filter((el) => {
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        if (!text.includes(dateLabel) || !status.test(text)) {
          return false;
        }
        return text.length < 60;
      })
      .sort((a, b) => a.innerText.length - b.innerText.length);

    const card = cards[0];
    if (!card) {
      return false;
    }
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  }, label);

  if (!clicked) {
    await row.getByText(label, { exact: true }).first().click({ force: true });
  }

  console.log(`Clicked date card: ${label} (JOURNEY_DATE ${d}/${m}/${y}).`);

  const bookNow = row.getByRole("button", { name: /^book now$/i }).first();
  for (let i = 0; i < 50; i++) {
    const enabled = await bookNow.evaluate((btn) => {
      if (!btn) {
        return false;
      }
      const style = window.getComputedStyle(btn);
      return (
        !btn.disabled &&
        !btn.classList.contains("disable-book") &&
        style.pointerEvents !== "none" &&
        style.opacity !== "0.5"
      );
    });
    if (enabled) {
      console.log("Book Now is active (orange date card selected).");
      return;
    }
    await row.page().waitForTimeout(300);
  }

  throw new Error(`Book Now still inactive after date card ${label}.`);
}

async function clickBookNowForRow(row) {
  const bookNow = row.getByRole("button", { name: /^book now$/i }).first();
  await bookNow.waitFor({ state: "visible", timeout: 30_000 });

  if (!(await bookNow.isEnabled().catch(() => false))) {
    throw new Error("Book Now is disabled — select a date card first.");
  }

  await bookNow.click({ force: true });
  console.log("Clicked Book Now (login modal may open).");
}

export async function selectTrainAndBook(page, { saveSession }) {
  const trainNo = normalizeTrainNumber(config.train.number || "");
  if (!trainNo) {
    console.log("TRAIN_NUMBER not set — pick class, date card, Book Now manually.");
    return;
  }

  const classCode = config.journey.travelClass.toUpperCase();
  const deadline = Date.now() + config.tatkal.bookRetrySeconds * 1000;

  console.log(
    `Train ${trainNo}: class → date card → Book Now → login (if modal).`
  );

  while (Date.now() < deadline) {
    try {
      const row = trainRowLocator(page, trainNo);
      await row.waitFor({ state: "attached", timeout: 25_000 });
      await row.scrollIntoViewIfNeeded();

      await selectClassTab(row, classCode);
      await selectJourneyDateCard(row, config.journey.date);
      await clickBookNowForRow(row);

      const loggedIn = await fillLoginModalIfOpen(page, { saveSession });
      if (loggedIn) {
        console.log("Login complete after Book Now.");
      }

      await page
        .getByText(/passenger details|full name as per govt/i)
        .first()
        .waitFor({ state: "visible", timeout: 120_000 })
        .catch(() => {});

      return;
    } catch (err) {
      console.log(`Retry train book: ${err.message?.slice(0, 100) || "unknown"}`);
      await page.waitForTimeout(config.tatkal.retryIntervalMs);
    }
  }

  throw new Error(
    `Could not book train ${trainNo} (${classCode}) within ${config.tatkal.bookRetrySeconds}s.`
  );
}
