/** IRCTC Alert modal: orange हिंदी / English buttons. */
export async function selectEnglishLanguage(page) {
  const mask = page.locator(".ui-dialog-mask-scrollblocker, .ui-dialog-visible");
  const alertOpen = await mask
    .first()
    .isVisible({ timeout: 12_000 })
    .catch(() => false);

  if (!alertOpen) {
    const welcome = await page
      .getByText(/welcome to irctc/i)
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!welcome) {
      return false;
    }
  }

  const dialog = page.locator(".ui-dialog-visible [role='dialog'], .ui-dialog-visible").first();

  let english = dialog
    .locator("button, a, span, div")
    .filter({ hasText: /^english$/i })
    .first();

  if (!(await english.isVisible({ timeout: 3_000 }).catch(() => false))) {
    english = page.getByRole("button", { name: /^english$/i }).first();
  }

  if (!(await english.isVisible({ timeout: 3_000 }).catch(() => false))) {
    const buttons = page.locator(
      ".ui-dialog-visible button, .ui-dialog-visible a, .ui-dialog button"
    );
    const n = await buttons.count();
    for (let i = 0; i < n; i++) {
      const text = (await buttons.nth(i).innerText()).trim();
      if (/^english$/i.test(text)) {
        english = buttons.nth(i);
        break;
      }
    }
  }

  if (!(await english.isVisible({ timeout: 2_000 }).catch(() => false))) {
    console.log("Language Alert visible but English button not found.");
    return false;
  }

  await english.scrollIntoViewIfNeeded();
  await english.click({ force: true });

  await page
    .locator(".ui-dialog-mask-scrollblocker")
    .waitFor({ state: "hidden", timeout: 20_000 })
    .catch(() => {});

  const stillBlocked = await page
    .locator(".ui-dialog-mask-scrollblocker")
    .isVisible()
    .catch(() => false);
  if (stillBlocked) {
    await english.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }

  console.log("Language popup: clicked English.");
  return true;
}

export async function dismissBetaBanner(page) {
  const topClose = page.locator(".h_head1 .fa-close, .beta-close .fa-close").first();
  if (await topClose.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await topClose.click().catch(() => {});
  }
}

export async function dismissCommonPopups(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const done = await selectEnglishLanguage(page);
    if (done) {
      break;
    }
    await page.waitForTimeout(600);
  }

  await dismissBetaBanner(page);

  const ok = page.getByRole("button", { name: /^ok$/i }).first();
  if (await ok.isVisible().catch(() => false)) {
    await ok.click().catch(() => {});
  }
}
