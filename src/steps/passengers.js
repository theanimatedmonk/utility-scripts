import { config } from "../config.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function passengerLinePattern(name) {
  return new RegExp(`^\\s*${escapeRegExp(name)}\\s*\\|`, "i");
}

function nameInputs(page) {
  return page
    .getByPlaceholder(/full name as per govt\.?\s*id/i)
    .or(page.locator('input[placeholder*="Full Name as per Govt"]'));
}

async function waitForFamilyDropdown(page) {
  const panel = page
    .locator(
      "ul.p-autocomplete-items, .p-autocomplete-panel ul, .ui-autocomplete-items"
    )
    .filter({ visible: true })
    .first();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  return panel;
}

async function selectFromFamilyDropdown(page, field, name) {
  await field.scrollIntoViewIfNeeded();
  await field.click({ force: true });
  await field.focus();

  let panel;
  try {
    panel = await waitForFamilyDropdown(page);
  } catch {
    await field.click({ force: true });
    panel = await waitForFamilyDropdown(page);
  }

  const items = panel.locator("li");
  const count = await items.count();
  const matches = [];

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = (await item.innerText()).replace(/\s+/g, " ").trim();
    if (!passengerLinePattern(name).test(text)) {
      continue;
    }
    const verified =
      (await item
        .locator(".fa-check-circle, [class*='check-circle'], .pi-check")
        .count()) > 0;
    matches.push({ item, verified });
  }

  if (matches.length === 0) {
    await field.fill(name);
    await page.waitForTimeout(500);
    panel = await waitForFamilyDropdown(page);
    const retryItems = panel.locator("li");
    const retryCount = await retryItems.count();
    for (let i = 0; i < retryCount; i++) {
      const item = retryItems.nth(i);
      const text = (await item.innerText()).replace(/\s+/g, " ").trim();
      if (passengerLinePattern(name).test(text)) {
        matches.push({
          item,
          verified:
            (await item.locator(".fa-check-circle, [class*='check']").count()) >
            0,
        });
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(`Passenger "${name}" not found in family dropdown.`);
  }

  const chosen =
    config.passengers.preferVerified && matches.find((m) => m.verified)
      ? matches.find((m) => m.verified)
      : matches[0];

  await chosen.item.scrollIntoViewIfNeeded();
  await chosen.item.click({ force: true });

  await panel.waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
}

async function clickAddPassengerRow(page) {
  const addLink = page
    .getByText(/add passenger/i)
    .filter({ visible: true })
    .first();

  await addLink.scrollIntoViewIfNeeded();
  await addLink.click();
  await page.waitForTimeout(700);
  console.log("Clicked + Add Passenger for another row.");
}

async function fillOnePassenger(page, name, rowIndex) {
  const field = nameInputs(page).nth(rowIndex);
  await field.waitFor({ state: "visible", timeout: 60_000 });

  console.log(`Focusing Full Name field (row ${rowIndex + 1})…`);
  await selectFromFamilyDropdown(page, field, name);

  const value = await field.inputValue();
  const first = name.split(" ")[0];
  if (!value.toLowerCase().includes(first.toLowerCase())) {
    await selectFromFamilyDropdown(page, field, name);
  }

  console.log(`Selected passenger row ${rowIndex + 1}: ${name}`);
}

export async function waitForPassengerDetails(page) {
  console.log("\n>>> Waiting for Passenger Details…\n");

  const nameField = nameInputs(page).first();

  if (!(await nameField.isVisible({ timeout: 120_000 }).catch(() => false))) {
    const section = page.getByText(/^passenger details$/i).first();
    if (await section.isVisible().catch(() => false)) {
      await section.click();
    }
  }

  await nameField.waitFor({ state: "visible", timeout: 600_000 });
  console.log("Passenger Details form ready.");
}

export async function fillPassengersFromFamilyList(page) {
  const names = config.passengers.names;
  if (names.length === 0) {
    console.log(
      "PASSENGERS not set in .env — pick family members manually in the dropdown."
    );
    return;
  }

  console.log(`Adding ${names.length} passenger(s) from family dropdown…`);

  for (let i = 0; i < names.length; i++) {
    if (i > 0) {
      await clickAddPassengerRow(page);
    }
    await fillOnePassenger(page, names[i], i);
  }
}

export async function submitPassengerDetails(page) {
  const continueBtn = page
    .getByRole("button", { name: /continue/i })
    .filter({ hasNotText: /search/i })
    .first();

  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.scrollIntoViewIfNeeded();
    await continueBtn.click();
    console.log("Clicked Continue on Passenger Details.");
  }
}
