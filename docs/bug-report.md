# Bug Report — Craftify E-Commerce Platform

**Document ID:** BR-CRAFTIFY-001  
**Version:** 1.0  
**Date:** May 4, 2026  
**Course:** ITCS489 — Software Engineering  
**Reference:** Test Plan TP-CRAFTIFY-001 | Bug-Fix Test Suite: `tests/bug-fixes.test.js`  

---

## Bug Report Summary

| Bug ID | Title | Severity | Status |
|---|---|---|---|
| BUG-001 | Coupon creation allows past expiry date | High | Fixed |
| BUG-002 | Seed file produces coupons and auctions with invalid dates | Medium | Fixed |
| BUG-003 | Auction `end_time` not normalized to ISO string on creation | High | Fixed |

---

## BUG-001 — Coupon Creation Accepts Past Expiry Date

| Field | Details |
|---|---|
| **Bug ID** | BUG-001 |
| **Title** | Coupon creation allows past expiry date |
| **Component** | `controllers/artisanController.js` → `createCoupon()`, `controllers/adminController.js` → `createCoupon()`, `models/Coupon.js` → `validate()` |
| **Severity** | **High** |
| **Priority** | P1 |
| **Reported Date** | May 4, 2026 |
| **Regression Test** | `tests/bug-fixes.test.js` — "BUG 1 — Coupon date validation" describe block |

### Description

When an artisan or admin created a new coupon and set the `valid_until` date to a date in the **past**, the server accepted the form submission and inserted the coupon row into the database with no validation error. This allowed unusable (immediately-invalid) coupon codes to appear in the UI. Furthermore, `Coupon.validate()` did not check the `expires_at` field at runtime, meaning that if such a coupon were somehow applied, it would be treated as valid and a discount would be incorrectly applied at checkout.

### Steps to Reproduce

1. Log in as an artisan (e.g., `art@test.com`).
2. Navigate to **Artisan Dashboard → Coupons → Create Coupon**.
3. Fill in the coupon form:
   - Code: `PASTTEST`
   - Discount Type: `percent`
   - Discount Value: `10`
   - Valid Until: *(any date in the past, e.g., yesterday's date)*
4. Submit the form.
5. Query the database: `SELECT * FROM coupons WHERE code = 'PASTTEST'`.

### Expected Result

- The form submission is rejected with an error message: *"Expiry date must be in the future."*
- No row is inserted into the `coupons` table.
- `Coupon.validate('PASTTEST', 100, [])` returns `{ valid: false, error: 'Coupon has expired' }`.

### Actual Result (Before Fix)

- The coupon is inserted into the database with `expires_at` set to the past date.
- `Coupon.validate()` does not check `expires_at` and returns `{ valid: true, discount: 10 }`.
- A customer can apply the expired coupon and receive an unintended 10% discount.

### Fix Applied

- Added a server-side date validation check in `artisanController.js` and `adminController.js`: if `new Date(valid_until) <= new Date()`, redirect back with a flash error and abort insertion.
- Added an expiry check in `Coupon.validate()`: if `coupon.expires_at && new Date(coupon.expires_at) < new Date()`, return `{ valid: false, error: 'Coupon has expired' }`.

---

## BUG-002 — Seed File Produces Coupons and Auctions with Invalid Dates

| Field | Details |
|---|---|
| **Bug ID** | BUG-002 |
| **Title** | Seed file produces coupons with past expiry and auctions with past end_time |
| **Component** | `seeds/seed.js` |
| **Severity** | **Medium** |
| **Priority** | P2 |
| **Reported Date** | May 4, 2026 |
| **Regression Test** | `tests/bug-fixes.test.js` — "BUG 2 — Seed file correctness" describe block |

### Description

The `seeds/seed.js` file contained hardcoded date values (e.g., `'2024-12-31'` for coupon expiry and `'2024-06-01'` for auction end times) that were valid at the time the file was written but became dates in the past as time progressed. As a result, running `npm run seed` on any date after those hardcoded values produced a database where:

1. All seeded coupons were already expired — any customer attempting to use the demo coupon codes would see an error.
2. All seeded auctions had already ended — the "Live Auctions" page appeared empty on a fresh install.

Additionally, the seed script was not idempotent — running it twice would throw a `UNIQUE constraint failed` error on the `users.email` column rather than safely skipping already-existing rows.

### Steps to Reproduce

1. Ensure the project has no existing `craftify.db`.
2. Run `npm run seed` (sets `NODE_ENV=development`).
3. Log in as the demo customer (`customer@craftify.com`).
4. Navigate to the **Live Auctions** page.
5. Navigate to the cart and attempt to apply the demo coupon `SAVE10`.

### Expected Result

- At least one auction is visible on the **Live Auctions** page with a future end time.
- The coupon `SAVE10` is accepted with a discount applied.
- Re-running `npm run seed` does not throw any errors.

### Actual Result (Before Fix)

- The **Live Auctions** page shows "No auctions currently active."
- Applying `SAVE10` returns "This coupon has expired."
- Running `npm run seed` a second time crashes with `SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email`.

### Fix Applied

- All date values in `seeds/seed.js` are now computed dynamically relative to `new Date()` (e.g., `end_time = new Date(Date.now() + 7 * 86400000).toISOString()`).
- `INSERT OR IGNORE` (or existence checks) are used for all user, category, and coupon rows to make the seed idempotent.

---

## BUG-003 — Auction `end_time` Not Normalized to ISO String on Creation

| Field | Details |
|---|---|
| **Bug ID** | BUG-003 |
| **Title** | Auction `end_time` stored as non-ISO `datetime-local` string, breaking comparisons |
| **Component** | `models/Auction.js` → `create()`, `controllers/artisanController.js` → `createAuction()` |
| **Severity** | **High** |
| **Priority** | P1 |
| **Reported Date** | May 4, 2026 |
| **Regression Test** | `tests/bug-fixes.test.js` — "BUG 3 — Auction lifecycle and end_time normalization" describe block |

### Description

The artisan "Create Auction" HTML form uses an `<input type="datetime-local">` field, which submits the value in the format `"YYYY-MM-DDTHH:MM"` (no seconds, no timezone suffix). The `Auction.create()` model method stored this value verbatim into the SQLite `end_time` column. SQLite compares datetime strings lexicographically; the format `"YYYY-MM-DDTHH:MM"` does not include a timezone and can compare incorrectly against ISO strings that include `"Z"` or `"+00:00"`. This caused two observable failures:

1. **Auction appeared active past its end time** — the `WHERE end_time > ?` query comparing `"2025-06-01T18:30"` against `new Date().toISOString()` = `"2025-06-01T18:30:00.000Z"` could evaluate incorrectly because `"18:30"` < `"18:30:00.000Z"` lexicographically.
2. **`Auction.findAll({ active: true })`** used `end_time > datetime('now')` which behaved correctly in SQLite's `datetime()` function, but code outside the model that did string comparisons on the raw `end_time` value broke silently.

### Steps to Reproduce

1. Log in as an artisan.
2. Navigate to **Artisan Dashboard → Auctions → Create New Auction**.
3. Set the end date/time using the datetime-local picker to a time 1 minute in the future.
4. Submit the form.
5. Wait 2 minutes, then directly query: `SELECT id, end_time, status FROM auctions WHERE title = '<your title>'`.
6. Check whether `new Date(end_time) < new Date()` evaluates to `true` in Node.js.

### Expected Result

- `end_time` is stored as a full ISO 8601 string with seconds and UTC designator, e.g., `"2025-06-01T18:30:00.000Z"`.
- `new Date(stored.end_time).getTime() > Date.now()` correctly evaluates to `true` immediately after creation.
- After the auction expires, the status is updated to `"ended"` on the next status-check cycle.

### Actual Result (Before Fix)

- `end_time` is stored as `"2025-06-01T18:30"` (no seconds, no timezone).
- `new Date("2025-06-01T18:30")` is interpreted as **local time** by JavaScript's `Date` constructor, which on a UTC+3 machine means the value is stored as 3 hours earlier than intended.
- The auction may show as "ended" in the Node.js layer while SQLite's own `datetime('now')` comparison considers it still active, causing inconsistent auction status across different code paths.

### Fix Applied

- In `Auction.create()`, the received `end_time` value is always converted via `new Date(end_time).toISOString()` before being passed to the SQL `INSERT`. This normalizes both `"YYYY-MM-DDTHH:MM"` and already-correct ISO strings to `"YYYY-MM-DDTHH:MM:SS.mmmZ"`.
- Added the same normalization for `start_time`.
- Added a guard: if `new Date(end_time) <= new Date()`, throw a validation error so auctions cannot be created with an already-past end time.
