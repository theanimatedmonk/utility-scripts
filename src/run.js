import { launchContext } from "./browser.js";
import { config } from "./config.js";
import { loginIfNeeded } from "./steps/login.js";
import { fillTrainSearch } from "./steps/search.js";
import { selectTrainAndBook } from "./steps/train.js";
import { runUntilPaymentPage } from "./steps/booking.js";

async function main() {
  const session = await launchContext();
  const { browser, page, saveSession } = session;
  let reachedPayment = false;

  try {
    await loginIfNeeded(page, { saveSession });
    await fillTrainSearch(page);
    await selectTrainAndBook(page, { saveSession });
    await runUntilPaymentPage(page);
    reachedPayment = true;
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (config.keepOpenAtPayment) {
      const msg = reachedPayment
        ? "Close the browser when you are done paying."
        : "Browser left open for debugging — close it when finished.";
      console.log(msg);
      await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
    }
    await browser.close();
  }
}

main();
