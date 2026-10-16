/**
 * Hard stop: wait until the payment UI is visible.
 * This project does NOT click Pay, UPI, cards, or complete any transaction.
 */
export async function waitForPaymentPage(page) {
  console.log(
    "\n>>> If IRCTC shows insurance / review screens, confirm them manually.\n" +
      ">>> Script will stop as soon as the payment page appears.\n"
  );

  await page.waitForSelector(
    "text=/payment|pay now|total amount|upi|net banking|credit card|debit card/i",
    { timeout: 600_000 }
  );

  console.log(
    "\n========================================\n" +
      "  STOP: Payment page reached.\n" +
      "  Automation ends here — pay yourself.\n" +
      "========================================\n"
  );

  return true;
}
