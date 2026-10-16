import { config } from "../config.js";
import { dismissCommonPopups } from "./popups.js";

async function isLoggedIn(page) {
  return page
    .getByText(/logout|sign out|my account/i)
    .first()
    .isVisible()
    .catch(() => false);
}

function credentialInputs(page) {
  return {
    user: page
      .getByPlaceholder(/user name/i)
      .or(page.locator('input[formcontrolname="userid"], input[name="userId"]'))
      .first(),
    pass: page
      .getByPlaceholder(/^password$/i)
      .or(
        page.locator(
          'input[formcontrolname="password"], input[type="password"]'
        )
      )
      .first(),
  };
}

async function waitForLoginComplete(page) {
  await page.waitForFunction(
    () => {
      const body = document.body?.innerText || "";
      const loginOpen = /user name/i.test(body) && /sign in/i.test(body);
      const loggedIn = /logout|sign out|my account/i.test(body);
      const passenger = /passenger details|full name as per govt/i.test(body);
      return loggedIn || passenger || !loginOpen;
    },
    { timeout: 300_000 }
  );
}

function signInButton(page) {
  return page
    .getByRole("button", { name: /^sign in$/i })
    .or(page.locator("button, a, span").filter({ hasText: /^sign in$/i }))
    .first();
}

async function waitForCaptchaFilled(page) {
  const captcha = page
    .locator(
      'input[formcontrolname="captcha"], input[name="captcha"], input[placeholder*="captcha" i]'
    )
    .first();

  if (!(await captcha.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }

  console.log(">>> Solve CAPTCHA in the browser…");
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        'input[formcontrolname="captcha"], input[name="captcha"]'
      );
      return el && el.value.trim().length >= 4;
    },
    { timeout: 300_000 }
  );
}

async function clickSignIn(page) {
  const btn = signInButton(page);
  await btn.waitFor({ state: "visible", timeout: 30_000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  console.log(">>> Clicked SIGN IN.");
}

/** Fill LOGIN modal from .env, wait for CAPTCHA, click SIGN IN. */
export async function fillLoginModalIfOpen(page, { saveSession }) {
  const { user: userInput, pass: passInput } = credentialInputs(page);
  const open = await userInput.isVisible({ timeout: 12_000 }).catch(() => false);

  if (!open) {
    return false;
  }

  await userInput.fill(config.irctc.username);
  await passInput.fill(config.irctc.password);
  console.log("\n>>> LOGIN modal: ID/password filled from .env.");

  await waitForCaptchaFilled(page);
  await clickSignIn(page);

  await waitForLoginComplete(page).catch(async () => {
    console.log(">>> Login still open — solve CAPTCHA if needed; clicking SIGN IN again.");
    await waitForCaptchaFilled(page);
    await clickSignIn(page);
    await waitForLoginComplete(page);
  });

  await saveSession();
  return true;
}

async function openLoginDialog(page) {
  await dismissCommonPopups(page);
  const loginBtn = page.locator('a.loginText[aria-label*="Login"]').first();
  await loginBtn.waitFor({ state: "attached", timeout: 30_000 });
  await loginBtn.click({ force: true });
  await page.waitForTimeout(800);
}

/** Open site, English popup, optional header login if not signed in. */
export async function loginIfNeeded(page, { saveSession }) {
  await page.goto(config.irctc.baseUrl, { waitUntil: "domcontentloaded" });
  await dismissCommonPopups(page);

  if (await isLoggedIn(page)) {
    console.log("Already logged in at start.");
    await saveSession();
    return;
  }

  const { user: userInput } = credentialInputs(page);
  if (!(await userInput.isVisible({ timeout: 3_000 }).catch(() => false))) {
    console.log("Not logged in — will log in after Book Now if IRCTC asks.");
    return;
  }

  await fillLoginModalIfOpen(page, { saveSession });
}
