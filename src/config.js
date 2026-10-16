import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name} (see .env.example)`);
  }
  return value;
}

export const config = {
  irctc: {
    baseUrl: "https://www.irctc.co.in/nget/train-search",
    username: required("IRCTC_USERNAME"),
    password: required("IRCTC_PASSWORD"),
  },
  journey: {
    from: required("FROM_STATION"),
    to: required("TO_STATION"),
    date: required("JOURNEY_DATE"),
    /** Tatkal-first: default TQ unless QUOTA is set */
    quota: process.env.QUOTA?.trim() || "TQ",
    travelClass: process.env.CLASS?.trim() || "3A",
  },
  train: {
    number: process.env.TRAIN_NUMBER?.trim() || "",
    /** Optional disambiguation, e.g. RAJDHANI */
    name: process.env.TRAIN_NAME?.trim() || "",
  },
  tatkal: {
    /** Wait until 10:00 / 11:00 IST before Search (based on CLASS) */
    syncToOpenTime:
      process.env.TATKAL_SYNC === "1" || process.env.TATKAL_SYNC === "true",
    bookRetrySeconds: Number(process.env.TATKAL_RETRY_SECONDS || 180),
    retryIntervalMs: Number(process.env.TATKAL_RETRY_MS || 400),
  },
  passengers: {
    /** Comma-separated names as shown in the family dropdown (before the "|") */
    names: (process.env.PASSENGERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** When two "Sajal Kumar" rows exist, pick the Aadhaar-verified one (green tick) */
    preferVerified: process.env.PASSENGER_PREFER_VERIFIED !== "false",
  },
  storageStatePath:
    process.env.STORAGE_STATE_PATH?.trim() ||
    path.join(root, ".auth", "irctc-storage.json"),
  headed: process.env.HEADED === "1" || process.env.HEADED === "true",
  slowMo: Number(process.env.SLOW_MO || 0),
  /** After payment page loads, keep browser open until you close it (set KEEP_OPEN=0 to exit immediately). */
  keepOpenAtPayment: process.env.KEEP_OPEN !== "0",
};
