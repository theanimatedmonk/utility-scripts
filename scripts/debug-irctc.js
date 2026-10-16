import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { selectEnglishLanguage } from "../src/steps/popups.js";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "debug-output");

async function launchPage() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-IN",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  return { browser, page };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { browser, page } = await launchPage();
  const log = [];

  try {
    await page.goto("https://www.irctc.co.in/nget/train-search", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(3000);

    const langOk = await selectEnglishLanguage(page);
    log.push(`selectEnglishLanguage: ${langOk}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, "02-after-english.png"), fullPage: true });

    const ac = await page.locator("p-autocomplete input, input[formcontrolname]").evaluateAll(
      (els) =>
        els.map((el) => ({
          formcontrolname: el.getAttribute("formcontrolname"),
          placeholder: el.getAttribute("placeholder"),
          visible: el.offsetParent !== null,
        }))
    );
    log.push(`autocomplete inputs: ${JSON.stringify(ac.filter((x) => x.visible), null, 2)}`);

    const login = await page.getByText(/^login$/i).first().isVisible().catch(() => false);
    log.push(`LOGIN visible: ${login}`);

    fs.writeFileSync(path.join(outDir, "log.txt"), log.join("\n"));
    console.log(log.join("\n"));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
