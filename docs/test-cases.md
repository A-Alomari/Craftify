# Test Cases — Craftify E-Commerce Platform

**Document ID:** TC-CRAFTIFY-001  
**Version:** 1.0  
**Date:** May 4, 2026  
**Course:** ITCS489 — Software Engineering  
**Reference:** Test Plan TP-CRAFTIFY-001  

---

## Testing Technique Notes

### Black-Box: Equivalence Partitioning and Boundary Value Analysis

Each test case below is classified by the black-box technique it demonstrates:

- **EP** = Equivalence Partitioning — the input space is divided into valid and invalid classes; one representative from each class is tested.
- **BVA** = Boundary Value Analysis — values are chosen at the exact boundary, just inside, and just outside.

### White-Box: Branch / Statement Coverage

Controller and model test cases exercise specific code branches to ensure both the `true` and `false` paths of conditionals are reached, contributing to the ≥ 80% coverage target.

---

## Test Cases

---

### TC-001 — Valid User Login

| Field | Details |
|---|---|
| **Test Case ID** | TC-001 |
| **Description** | A registered, active customer logs in with correct credentials. The system should authenticate the user and redirect to the home page. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (valid class) |
| **Test Suite File** | `tests/controllers/c02-auth.suite.js` |
| **Input Data** | Email: `customer@test.com`, Password: `cust123` |
| **Expected Result** | HTTP 302 redirect (to `/` or `/dashboard`); session created with `user.id` set |
| **Actual Result** | HTTP 302 redirect received; session cookie present in response |
| **Status** | **Pass** |

---

### TC-002 — Login with Wrong Password

| Field | Details |
|---|---|
| **Test Case ID** | TC-002 |
| **Description** | A user attempts to log in with an incorrect password. The system should deny access and redirect back to the login page. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (invalid password class) |
| **Test Suite File** | `tests/controllers/c02-auth.suite.js` |
| **Input Data** | Email: `customer@test.com`, Password: `wrongpass` |
| **Expected Result** | HTTP 302 redirect to `/auth/login`; flash error message present |
| **Actual Result** | HTTP 302; `location` header contains `login` |
| **Status** | **Pass** |

---

### TC-003 — Login with Suspended Account

| Field | Details |
|---|---|
| **Test Case ID** | TC-003 |
| **Description** | A user whose account status is `suspended` attempts to log in. Access must be denied regardless of password correctness. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (suspended account class) |
| **Test Suite File** | `tests/controllers/c02-auth.suite.js` |
| **Input Data** | Email: `suspended@test.com`, Password: `susp123` |
| **Expected Result** | HTTP 302 redirect to `/auth/login`; session not created for this user |
| **Actual Result** | HTTP 302; `location` header contains `login` |
| **Status** | **Pass** |

---

### TC-004 — Duplicate Email Registration Rejected

| Field | Details |
|---|---|
| **Test Case ID** | TC-004 |
| **Description** | A visitor tries to register with an email address that already exists in the database. Registration must be rejected without creating a duplicate record. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (duplicate email class) |
| **Test Suite File** | `tests/controllers/c02-auth.suite.js` |
| **Input Data** | Name: `Dup`, Email: `customer@test.com`, Password: `pass123`, ConfirmPassword: `pass123` |
| **Expected Result** | HTTP 302 redirect back to `/auth/register`; no new row inserted in `users` |
| **Actual Result** | HTTP 302; `location` contains `register`; user count unchanged |
| **Status** | **Pass** |

---

### TC-005 — Product Retrieved by Valid ID

| Field | Details |
|---|---|
| **Test Case ID** | TC-005 |
| **Description** | The `Product.findById()` model method is called with a known product ID. The returned object must contain the correct name, price, and related artisan/category data. |
| **Testing Level** | Unit |
| **Technique** | White-Box — Statement Coverage |
| **Test Suite File** | `tests/models/m01-product.suite.js` |
| **Input Data** | `ids.vaseId` (seeded product "Test Vase", price 45.00, category "Pottery") |
| **Expected Result** | Returns object `{ name: 'Test Vase', price: 45.00, shop_name: 'Test Shop', category_name: 'Pottery' }` |
| **Actual Result** | Object returned with all expected fields matching |
| **Status** | **Pass** |

---

### TC-006 — Product.findById with Non-Existent ID Returns Undefined

| Field | Details |
|---|---|
| **Test Case ID** | TC-006 |
| **Description** | Calling `Product.findById()` with an ID that does not exist in the database should return `undefined` rather than throwing an error. |
| **Testing Level** | Unit |
| **Technique** | Black-Box — Equivalence Partitioning (invalid ID class) |
| **Test Suite File** | `tests/models/m01-product.suite.js` |
| **Input Data** | `Product.findById(99999)` |
| **Expected Result** | `undefined` |
| **Actual Result** | `undefined` |
| **Status** | **Pass** |

---

### TC-007 — Auction Bid Below Minimum Rejected

| Field | Details |
|---|---|
| **Test Case ID** | TC-007 |
| **Description** | Placing a bid that is lower than the current minimum acceptable bid (`starting_price + bid_increment`) must throw an error and not save the bid. |
| **Testing Level** | Unit |
| **Technique** | Black-Box — Boundary Value Analysis (bid = 1.00, well below minimum of 35.00) |
| **Test Suite File** | `tests/models/m06-auction.suite.js` |
| **Input Data** | Auction starting price 30.00, bid_increment 5.00; bid amount = `1.00` |
| **Expected Result** | `Auction.placeBid()` throws an error; `bids` table row count unchanged |
| **Actual Result** | Error thrown as expected |
| **Status** | **Pass** |

---

### TC-008 — Valid Auction Bid Accepted

| Field | Details |
|---|---|
| **Test Case ID** | TC-008 |
| **Description** | Placing a bid that exceeds the current highest bid by at least the bid increment must succeed and persist the bid record. |
| **Testing Level** | Unit |
| **Technique** | Black-Box — Boundary Value Analysis (bid = current_highest + increment, at valid boundary) |
| **Test Suite File** | `tests/models/m06-auction.suite.js` |
| **Input Data** | Auction current_highest_bid 45.00, bid_increment 5.00; new bid = `55.00` |
| **Expected Result** | `Auction.placeBid()` returns a truthy result; new bid row exists in DB |
| **Actual Result** | Result is truthy; bid inserted |
| **Status** | **Pass** |

---

### TC-009 — Expired Coupon Rejected at Checkout

| Field | Details |
|---|---|
| **Test Case ID** | TC-009 |
| **Description** | Applying a coupon whose `expires_at` date is in the past must be rejected by the server. The discount must not be applied and the coupon must not be inserted. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (expired coupon class) |
| **Test Suite File** | `tests/bug-fixes.test.js` (BUG 1) |
| **Input Data** | Coupon code: `BUGEXPIRED`, expires_at = 90 days in the past |
| **Expected Result** | `Coupon.validate()` returns `{ valid: false }`; artisan coupon creation POST redirects with error |
| **Actual Result** | `valid` is `false`; redirect to coupon page with error flash |
| **Status** | **Pass** |

---

### TC-010 — Valid Future-Dated Coupon Accepted

| Field | Details |
|---|---|
| **Test Case ID** | TC-010 |
| **Description** | Creating a coupon with an expiry date 30 days in the future must succeed. The coupon row must be inserted into the database. |
| **Testing Level** | Integration |
| **Technique** | Black-Box — Equivalence Partitioning (valid coupon class) |
| **Test Suite File** | `tests/bug-fixes.test.js` (BUG 1) |
| **Input Data** | Code: unique string, discount_type: `percent`, discount_value: `15`, valid_until: 30 days future |
| **Expected Result** | HTTP 302; coupon row present in `coupons` table |
| **Actual Result** | Row found in DB after POST |
| **Status** | **Pass** |

---

### TC-011 — Coupon Below Minimum Order Amount Rejected

| Field | Details |
|---|---|
| **Test Case ID** | TC-011 |
| **Description** | A coupon with a minimum order of BD 20 must be rejected when the cart total is BD 10. |
| **Testing Level** | Unit |
| **Technique** | Black-Box — Boundary Value Analysis (order total = 10 < min_order = 20) |
| **Test Suite File** | `tests/models/m07-coupon.suite.js` |
| **Input Data** | `Coupon.validate('TEST10', 10)` where TEST10 has `min_order = 20` |
| **Expected Result** | `{ valid: false }` |
| **Actual Result** | `{ valid: false }` |
| **Status** | **Pass** |

---

### TC-012 — Cart Add, Update, and Remove Flow

| Field | Details |
|---|---|
| **Test Case ID** | TC-012 |
| **Description** | Tests the complete cart lifecycle: add item → verify it appears → update quantity → verify updated quantity → remove item → verify cart is empty. |
| **Testing Level** | Unit |
| **Technique** | White-Box — Basic Path (success path through all cart operations) |
| **Test Suite File** | `tests/models/m05-cart.suite.js` |
| **Input Data** | Customer user ID, product ID (`ids.vaseId`), quantities: add 2, update to 3, then remove |
| **Expected Result** | After add: item present with qty 2. After update: qty 3. After remove: item absent from `Cart.getItems()` |
| **Actual Result** | All assertions pass sequentially |
| **Status** | **Pass** |

---

### TC-013 — Unauthenticated Access to Protected Route Redirects to Login

| Field | Details |
|---|---|
| **Test Case ID** | TC-013 |
| **Description** | An unauthenticated visitor attempts to access `/artisan/dashboard`, which requires an authenticated artisan session. The middleware must redirect to the login page. |
| **Testing Level** | Integration |
| **Technique** | White-Box — Branch Coverage (auth middleware false branch: no session) |
| **Test Suite File** | `tests/controllers/c04-role.suite.js` |
| **Input Data** | No session cookie; `GET /artisan/dashboard` |
| **Expected Result** | HTTP 302 redirect to `/auth/login` |
| **Actual Result** | HTTP 302; `location` = `/auth/login` |
| **Status** | **Pass** |

---

### TC-014 — Checkout Transaction Rolls Back on Payment Failure

| Field | Details |
|---|---|
| **Test Case ID** | TC-014 |
| **Description** | When `authorizePayment()` throws a `PAYMENT_DECLINED` error during checkout, the database transaction must be rolled back. No order row should be inserted. |
| **Testing Level** | Unit (isolated service test with mocks) |
| **Technique** | White-Box — Basic Path (error/rollback path through `checkoutService.createOrderFromCheckout`) |
| **Test Suite File** | `tests/services/checkoutService.test.js` |
| **Input Data** | Valid cart, valid user, `authorizePayment` mocked to throw `PAYMENT_DECLINED` |
| **Expected Result** | `createOrderFromCheckout()` rejects; DB `exec('ROLLBACK')` called; no order row created |
| **Actual Result** | Promise rejected; rollback exec spy was called |
| **Status** | **Pass** |

---

### TC-015 — Home Page Responds Within 500 ms

| Field | Details |
|---|---|
| **Test Case ID** | TC-015 |
| **Description** | A GET request to the home page `/` must complete and return HTTP 200 within the defined performance threshold of 500 ms. |
| **Testing Level** | Performance |
| **Technique** | Black-Box — Boundary Value Analysis (response time ≤ 500 ms threshold) |
| **Test Suite File** | `tests/performance/performance.test.js` |
| **Input Data** | `GET /` with no authentication |
| **Expected Result** | HTTP 200; elapsed time ≤ 500 ms |
| **Actual Result** | HTTP 200; elapsed time well within threshold |
| **Status** | **Pass** |

---

## Summary Table

| ID | Description | Level | Technique | Status |
|---|---|---|---|---|
| TC-001 | Valid user login | Integration | EP | Pass |
| TC-002 | Login with wrong password | Integration | EP | Pass |
| TC-003 | Login with suspended account | Integration | EP | Pass |
| TC-004 | Duplicate email registration rejected | Integration | EP | Pass |
| TC-005 | Product retrieved by valid ID | Unit | White-Box | Pass |
| TC-006 | Product.findById non-existent ID | Unit | EP | Pass |
| TC-007 | Auction bid below minimum rejected | Unit | BVA | Pass |
| TC-008 | Valid auction bid accepted | Unit | BVA | Pass |
| TC-009 | Expired coupon rejected at checkout | Integration | EP | Pass |
| TC-010 | Valid future-dated coupon accepted | Integration | EP | Pass |
| TC-011 | Coupon below minimum order rejected | Unit | BVA | Pass |
| TC-012 | Cart add/update/remove lifecycle | Unit | White-Box | Pass |
| TC-013 | Unauthenticated access redirects to login | Integration | White-Box | Pass |
| TC-014 | Checkout rollback on payment failure | Unit | White-Box | Pass |
| TC-015 | Home page responds within 500 ms | Performance | BVA | Pass |
