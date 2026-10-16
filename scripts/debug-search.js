import "dotenv/config";
import { launchContext } from "../src/browser.js";
import { dismissCommonPopups } from "../src/steps/popups.js";
import { fillTrainSearch } from "../src/steps/search.js";

async function main() {
  const { browser, page } = await launchContext();
  try {
    await page.goto("https://www.irctc.co.in/nget/train-search", {
      waitUntil: "domcontentloaded",
    });
    await dismissCommonPopups(page);
    const buttons = await page.locator("button").evaluateAll((els) =>
      els.map((el) => ({ text: el.innerText.trim(), visible: el.offsetParent !== null }))
    );
    console.log("buttons:", buttons.filter((b) => b.visible && b.text));

    await fillTrainSearch(page);
    console.log("Search step OK");
  } catch (e) {
    console.error("Search step failed:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
