import { config } from "../config.js";
import { waitForTatkalOpenIfConfigured } from "../tatkal.js";
import { dismissCommonPopups, selectEnglishLanguage } from "./popups.js";

function parseIrctcDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return { ddmmyyyy: `${d}/${m}/${y}`, day: Number(d), month: Number(m), year: Number(y) };
}

const QUOTA_LABELS = {
  TQ: /tatkal/i,
  PT: /premium tatkal/i,
  GN: /general/i,
  LD: /ladies/i,
};

const QUOTA_DISPLAY = {
  GN: "General",
  TQ: "Tatkal",
  PT: "Premium Tatkal",
  LD: "Ladies",
};

function journeyDateInput(page) {
  return page
    .locator('p-calendar[formcontrolname="journeyDate"] input')
    .filter({ visible: true })
    .last();
}

async function clickDropdownOption(page, optionPattern) {
  const panel = page.locator(
    ".p-dropdown-panel li, .ui-dropdown-items li, ul.p-dropdown-items li"
  );
  const option = panel.filter({ hasText: optionPattern }).first();
  await option.waitFor({ state: "visible", timeout: 8_000 });
  await option.click();
}

async function openDropdown(dropdown) {
  const trigger = dropdown
    .locator(".p-dropdown-trigger, .ui-dropdown-trigger")
    .first();
  await dropdown.scrollIntoViewIfNeeded();
  await trigger.click();
}

async function setDropdownFormControl(page, formControlName, optionPattern) {
  const dropdown = page
    .locator(`p-dropdown[formcontrolname="${formControlName}"]`)
    .filter({ visible: true })
    .last();
  if (!(await dropdown.isVisible().catch(() => false))) {
    return false;
  }
  await openDropdown(dropdown);
  await clickDropdownOption(page, optionPattern);
  return true;
}

async function setQuota(page) {
  const code = config.journey.quota.toUpperCase();
  const pattern = QUOTA_LABELS[code] || new RegExp(code, "i");
  const display = QUOTA_DISPLAY[code] || code;

  let ok = false;
  try {
    ok = await setDropdownFormControl(page, "journeyQuota", pattern);
  } catch {
    ok = false;
  }

  if (ok) {
    console.log(`Quota set from .env: ${code} (${display}).`);
  } else {
    console.log(
      `Could not auto-set quota (wanted QUOTA=${code} / ${display}) — set "${display}" manually.`
    );
  }
}

async function setTravelClass(page) {
  const code = config.journey.travelClass.toUpperCase();
  const pattern = new RegExp(`\\b${code}\\b`, "i");

  let ok = false;
  try {
    ok = await setDropdownFormControl(page, "journeyClass", pattern);
  } catch {
    ok = false;
  }

  if (ok) {
    console.log(`Class set from .env: ${code}.`);
  } else {
    console.log(`Could not auto-set CLASS=${code} — pick class manually.`);
  }
}

async function fillAutocompleteStation(page, formControlName, stationCode) {
  const input = page
    .locator(`p-autocomplete[formcontrolname="${formControlName}"] input`)
    .filter({ visible: true })
    .last();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.click();
  await input.fill("");
  await input.fill(stationCode);
  await page.waitForTimeout(600);

  const suggestion = page
    .locator("ul.p-autocomplete-items li, .ui-autocomplete-list li")
    .filter({ hasText: new RegExp(stationCode, "i") })
    .first();
  await suggestion.waitFor({ state: "visible", timeout: 15_000 });
  await suggestion.click();
}

async function pickDateInCalendar(page, { day, month, year }) {
  const calendar = page.locator(".p-datepicker-calendar, .ui-datepicker-calendar").first();
  await calendar.waitFor({ state: "visible", timeout: 8_000 });

  for (let step = 0; step < 18; step++) {
    const title = await page
      .locator(".p-datepicker-title, .ui-datepicker-title")
      .innerText()
      .catch(() => "");

    const titleHasYear = title.includes(String(year));
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const titleHasMonth = title.includes(monthNames[month - 1]?.slice(0, 3) || "");

    if (titleHasYear && titleHasMonth) {
      const dayCell = calendar
        .locator("td span, td a, span")
        .filter({ hasText: new RegExp(`^${day}$`) })
        .first();
      if (await dayCell.isVisible().catch(() => false)) {
        await dayCell.click();
        return true;
      }
    }

    await page.locator(".p-datepicker-next, .ui-datepicker-next").first().click();
    await page.waitForTimeout(200);
  }

  return false;
}

async function setJourneyDate(page, isoDate) {
  const { ddmmyyyy, day, month, year } = parseIrctcDate(isoDate);
  const input = journeyDateInput(page);
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.scrollIntoViewIfNeeded();
  await input.click({ clickCount: 3 });
  await input.fill(ddmmyyyy);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);

  let value = await input.inputValue();
  const yearOk = value.includes(String(year));
  const dayOk = value.startsWith(String(day).padStart(2, "0")) || value.includes(`/${String(day).padStart(2, "0")}/`);

  if (!yearOk || !dayOk) {
    await input.click();
    const picked = await pickDateInCalendar(page, { day, month, year }).catch(() => false);
    if (!picked) {
      await input.click({ clickCount: 3 });
      await input.pressSequentially(ddmmyyyy, { delay: 40 });
      await page.keyboard.press("Tab");
    }
    value = await input.inputValue();
  }

  await page.keyboard.press("Escape").catch(() => {});
  console.log(`Date set from .env (JOURNEY_DATE): ${ddmmyyyy} (field: ${value})`);
}

async function clickSubmitSearch(page) {
  const modify = page.getByRole("button", { name: /modify search/i }).first();
  const searchTrains = page.getByRole("button", { name: /search trains/i }).first();

  if (await modify.isVisible().catch(() => false)) {
    await modify.click();
    console.log("Clicked Modify Search.");
    return "modify";
  }

  await searchTrains.waitFor({ state: "visible", timeout: 30_000 });
  await searchTrains.click();
  console.log("Clicked Search Trains.");
  return "search";
}

/** IRCTC keeps network busy — do not use networkidle. */
async function waitForSearchResults(page) {
  console.log("Waiting for results (max ~20s)…");

  await page
    .locator(
      ".ui-progress-spinner, .loading, .loader, [class*='spinner'], [class*='overlay']"
    )
    .first()
    .waitFor({ state: "hidden", timeout: 25_000 })
    .catch(() => {});

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const hasResultsHeader = await page
      .getByText(/results for/i)
      .first()
      .isVisible()
      .catch(() => false);
    const trainCount = await page.locator("app-train-avl-enq").count();
    if (hasResultsHeader || trainCount > 0) {
      console.log("Results detected — proceeding to train booking.");
      return;
    }
    await page.waitForTimeout(500);
  }

  console.log("Results wait timed out — still proceeding to train booking.");
}

/** From → To → Date → Class → Quota → Modify Search / Search Trains */
export async function fillTrainSearch(page) {
  await selectEnglishLanguage(page);
  await dismissCommonPopups(page);
  await waitForTatkalOpenIfConfigured();

  console.log("Setting modify/search bar: From, To, Date, Class, Quota…");
  await fillAutocompleteStation(page, "origin", config.journey.from);
  await fillAutocompleteStation(page, "destination", config.journey.to);
  await setJourneyDate(page, config.journey.date);
  await setTravelClass(page);
  await setQuota(page);

  await clickSubmitSearch(page);
  await waitForSearchResults(page);
}
