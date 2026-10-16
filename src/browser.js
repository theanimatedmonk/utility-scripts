import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "./config.js";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function launchContext() {
  const storagePath = config.storageStatePath;
  const hasStorage = fs.existsSync(storagePath);

  const headless = !config.headed;
  if (headless) {
    console.warn(
      "IRCTC often blocks headless browsers. Use: npm run book:headed"
    );
  }

  const browser = await chromium.launch({
    headless,
    slowMo: config.slowMo,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    userAgent: CHROME_USER_AGENT,
    ...(hasStorage ? { storageState: storagePath } : {}),
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(90_000);

  return {
    browser,
    context,
    page,
    async saveSession() {
      const dir = path.dirname(storagePath);
      fs.mkdirSync(dir, { recursive: true });
      await context.storageState({ path: storagePath });
      console.log(`Saved session to ${storagePath}`);
    },
  };
}
