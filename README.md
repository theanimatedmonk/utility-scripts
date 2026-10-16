# IRCTC booking helper (Playwright)

Browser helper for IRCTC: **login** (credentials from `.env`), **search**, **pick train + class**, **family passengers**, then **stop on the payment page**.

**Automation does not pay.** It never clicks Pay / UPI / card buttons or enters payment details. You take over on the payment screen (CAPTCHA at login is still manual).

Aadhaar-verified accounts usually need **no login OTP**—only CAPTCHA until payment.

---

## Quick start

```bash
cp .env.example .env
# Fill .env (see checklist below)

npm install
npm run install:browsers
npm run book:headed
```

Use **`npm run book:headed`** so you can solve CAPTCHA. Headless mode often fails at login.

---

## Fast booking checklist (what to set in `.env`)

Fill these for the **shortest** path from open browser → payment screen:

| Priority | Variable | Required? | What to put |
|----------|----------|-----------|-------------|
| 1 | `IRCTC_USERNAME` | **Yes** | Your IRCTC user ID |
| 1 | `IRCTC_PASSWORD` | **Yes** | Your IRCTC password |
| 1 | `FROM_STATION` | **Yes** | Station code (e.g. `HWH`, `NDLS`) |
| 1 | `TO_STATION` | **Yes** | Station code |
| 1 | `JOURNEY_DATE` | **Yes** | `YYYY-MM-DD` |
| 2 | `QUOTA` | Recommended | `TQ`, `GN`, `PT`, or `LD` (see below) |
| 2 | `CLASS` | Recommended | `1A`, `2A`, `3A`, `SL`, `2S`, `CC`, etc. |
| 2 | `TRAIN_NUMBER` | Recommended | 5-digit train number (e.g. `12301`) |
| 2 | `PASSENGERS` | Recommended | Comma-separated names from family dropdown |
| 3 | `TRAIN_NAME` | Optional | Train name snippet if list is crowded |
| 3 | `TATKAL_SYNC` | Optional | `1` = wait until Tatkal open time before Search |
| 3 | `PASSENGER_PREFER_VERIFIED` | Optional | Default `true` — green-tick profile if duplicate names |

**First run:** solve login CAPTCHA once. Session is saved under `.auth/`; later runs often skip login until IRCTC expires the session.

**You handle manually:** login CAPTCHA, any IRCTC popups between Continue and payment (e.g. travel insurance), and **everything on the payment page** (method, UPI/card, bank OTP).

**Hard stop:** when the payment UI appears, the script prints `STOP: Payment page reached` and does nothing further except keep the browser open (default) so you can pay.

---

## Example `.env` (Tatkal, fastest)

```env
IRCTC_USERNAME=your_user_id
IRCTC_PASSWORD=your_password

FROM_STATION=HWH
TO_STATION=NDLS
JOURNEY_DATE=2026-10-25
QUOTA=TQ
CLASS=3A

TRAIN_NUMBER=12301
TRAIN_NAME=RAJDHANI

PASSENGERS=Sajal Kumar,Debasis Patra
PASSENGER_PREFER_VERIFIED=true

TATKAL_SYNC=1
TATKAL_RETRY_SECONDS=180
```

## Example `.env` (General quota)

Same as above, but:

```env
QUOTA=GN
# TATKAL_SYNC not needed unless you still want a timed Search
```

---

## Full environment reference

### Login & session

| Variable | Default | Description |
|----------|---------|-------------|
| `IRCTC_USERNAME` | — | **Required.** IRCTC user ID. |
| `IRCTC_PASSWORD` | — | **Required.** IRCTC password. Never commit `.env`. |
| `STORAGE_STATE_PATH` | `.auth/irctc-storage.json` | Saved cookies after login; reuse to skip CAPTCHA while valid. |

### Journey (search form)

| Variable | Default | Description |
|----------|---------|-------------|
| `FROM_STATION` | — | **Required.** Origin station code. |
| `TO_STATION` | — | **Required.** Destination station code. |
| `JOURNEY_DATE` | — | **Required.** Travel date as `YYYY-MM-DD`. |
| `QUOTA` | `TQ` | Quota dropdown before Search. |

**`QUOTA` values** (set any one in `.env`):

| Value | IRCTC option |
|-------|----------------|
| `GN` | General |
| `TQ` | Tatkal |
| `PT` | Premium Tatkal |
| `LD` | Ladies |

If omitted, default is **`TQ`**. Your explicit value in `.env` always wins (e.g. `QUOTA=GN`).

| Variable | Default | Description |
|----------|---------|-------------|
| `CLASS` | `3A` | Travel class; used in class filter and which column to click on the train row. |

### Train selection (after search)

| Variable | Default | Description |
|----------|---------|-------------|
| `TRAIN_NUMBER` | empty | 5-digit number. If set, script finds the train, clicks the class **card** (e.g. AC 3 Tier (3A)), then **Book Now** (with retries). If empty, you pick the train manually. |
| `TRAIN_NAME` | empty | Optional extra filter (e.g. `RAJDHANI`) when many trains match the route. |

### Passengers (Passenger Details page)

| Variable | Default | Description |
|----------|---------|-------------|
| `PASSENGERS` | empty | Comma-separated **full names** exactly as in the dropdown, before the `\|` (e.g. `Sajal Kumar,Shilpa Rani`). |
| `PASSENGER_PREFER_VERIFIED` | `true` | If the same name appears twice, prefer the row with the green verified tick. Set `false` to take the first match. |

### Tatkal timing & retries

| Variable | Default | Description |
|----------|---------|-------------|
| `TATKAL_SYNC` | off | Set to `1` or `true` to **delay Search** until Tatkal opens (IST): **10:00** for AC-type classes (`1A`, `2A`, `3A`, `3E`, `CC`, `EC`, `EA`, `FC`), **11:00** for others (e.g. `SL`, `2S`). Log in early; CAPTCHA can be done before the wait finishes. |
| `TATKAL_RETRY_SECONDS` | `180` | How long to keep retrying **Book Now** after results load. |
| `TATKAL_RETRY_MS` | `400` | Pause between refresh/retry attempts. |

`TATKAL_SYNC` does **not** change quota—only **when** Search runs. Quota is always from `QUOTA`.

### Run / debug (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADED` | off | `1` = visible browser. `npm run book:headed` sets this for you. |
| `KEEP_OPEN` | **on** (`1`) | Browser stays open on the payment page until you close it. Set `KEEP_OPEN=0` to quit right after payment loads. |
| `SLOW_MO` | `0` | Milliseconds to slow Playwright actions (debugging). |

---

## What the script does (in order)

```text
1. Open IRCTC train search
2. Login if needed (fill ID/password → you solve CAPTCHA → save session)
3. [If TATKAL_SYNC=1] Wait until 10:00 or 11:00 IST (by CLASS)
4. Fill From / To / Date, QUOTA + CLASS → **Modify Search** (results bar) or **Search Trains** (home)
5. [If TRAIN_NUMBER set] Click class card e.g. (3A) → **Book Now** (retry loop)
6. [If PASSENGERS set] Family dropdown → **Continue**
7. Payment page → **automation stops** → you pay manually (browser stays open by default)
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run book:headed` | **Recommended.** Visible browser for CAPTCHA. |
| `npm run book` | Headless (usually not suitable for IRCTC). |
| `npm run install:browsers` | One-time Chromium install for Playwright. |
| `KEEP_OPEN=1 npm run book:headed` | Keep window open at payment. |

---

## Files & security

| File | Purpose |
|------|---------|
| `.env` | Your secrets and journey config (**gitignored**). |
| `.env.example` | Template without real credentials (safe to commit). |
| `.auth/irctc-storage.json` | Saved login session (**gitignored**). |

Do not commit `.env` or share screenshots that show passwords or payment details.

---

## Limits

- **Login CAPTCHA** is manual every time the session expires.
- **OTP** at login is uncommon if Aadhaar is verified; **payment** may still need bank/UPI OTP or PIN.
- **IRCTC UI** changes frequently—you may need small selector updates in `src/steps/`.
- Automating IRCTC may conflict with their terms; use at your own risk.
- **Payment boundary:** code in `src/steps/payment.js` only *waits* for the payment screen. No payment automation exists in this repo.

---

## Troubleshooting

| Issue | Things to check |
|-------|------------------|
| Script exits on start | `IRCTC_USERNAME`, `IRCTC_PASSWORD`, `FROM_STATION`, `TO_STATION`, `JOURNEY_DATE` must be set. |
| Wrong quota | `QUOTA=GN` vs `TQ` in `.env` (explicit value overrides default `TQ`). |
| Train not booked | `TRAIN_NUMBER` correct for that date/route; `CLASS` matches an available column; increase `TATKAL_RETRY_SECONDS`. |
| Wrong passenger | Name must match dropdown text before `\|`; use `PASSENGER_PREFER_VERIFIED` for duplicate names. |
| Login every time | Delete stale session or log in again; check `.auth/irctc-storage.json` is writable. |

For selector fixes, see `src/steps/login.js`, `search.js`, `train.js`, and `passengers.js`.
