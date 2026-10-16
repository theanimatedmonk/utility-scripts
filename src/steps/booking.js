import {
  fillPassengersFromFamilyList,
  submitPassengerDetails,
  waitForPassengerDetails,
} from "./passengers.js";
import { waitForPaymentPage } from "./payment.js";

/**
 * Runs through passenger details, then waits for payment.
 * Never interacts with payment gateways.
 */
export async function runUntilPaymentPage(page) {
  await waitForPassengerDetails(page);
  await fillPassengersFromFamilyList(page);
  await submitPassengerDetails(page);
  await waitForPaymentPage(page);
}
