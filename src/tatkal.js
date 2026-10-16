import { config } from "./config.js";

const AC_TATKAL_CLASSES = new Set([
  "1A",
  "2A",
  "3A",
  "3E",
  "CC",
  "EC",
  "EA",
  "FC",
]);

/** Tatkal opens 10:00 AC / 11:00 non-AC (IST). */
export function tatkalOpenTime(classCode) {
  const c = classCode.toUpperCase();
  if (AC_TATKAL_CLASSES.has(c)) {
    return { hour: 10, minute: 0, second: 0 };
  }
  return { hour: 11, minute: 0, second: 0 };
}

function nowInIST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function msUntilISTTime({ hour, minute, second }) {
  const now = nowInIST();
  const target = new Date(now);
  target.setHours(hour, minute, second, 0);
  let diff = target.getTime() - now.getTime();
  if (diff < 0) {
    diff = 0;
  }
  return diff;
}

export async function waitForTatkalOpenIfConfigured() {
  if (!config.tatkal.syncToOpenTime) {
    return;
  }

  const openAt = tatkalOpenTime(config.journey.travelClass);
  const waitMs = msUntilISTTime(openAt);

  if (waitMs <= 0) {
    console.log("Tatkal window already open (IST) — continuing.");
    return;
  }

  const mins = Math.ceil(waitMs / 60_000);
  console.log(
    `TATKAL_SYNC: waiting ~${mins} min until ${String(openAt.hour).padStart(2, "0")}:${String(openAt.minute).padStart(2, "0")} IST…`
  );
  await new Promise((r) => setTimeout(r, waitMs));
}
