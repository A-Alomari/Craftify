# Test Plan — Craftify E-Commerce Platform

**Document ID:** TP-CRAFTIFY-001  
**Version:** 1.0  
**Date:** May 4, 2026  
**Course:** ITCS489 — Software Engineering  
**Project:** Craftify – Artisan Marketplace Web Application  

---

## 1. Objectives of Testing

The testing effort for the Craftify system has the following objectives:

1. **Verify correctness** — Confirm that every functional requirement (user registration, product browsing, cart management, checkout, auctions, artisan registration, order tracking, admin moderation) produces the expected output for valid inputs.
2. **Validate boundary and edge cases** — Ensure the application handles invalid, missing, and boundary inputs gracefully (e.g., expired coupons, negative bid amounts, duplicate emails).
3. **Confirm security controls** — Verify that authentication guards, role-based access control (customer / artisan / admin), CSRF protection, and input sanitization are enforced at every protected endpoint.
4. **Measure performance** — Assert that critical pages (home, product list, product detail, auctions, cart) respond within 500 ms under normal single-user load, and that repeated requests maintain an average response time under 300 ms.
5. **Detect regressions** — Provide a repeatable, automated test suite that flags breakage immediately when code is changed.
6. **Report known defects** — Document all identified bugs with reproducible steps so they can be triaged and fixed.

---

## 2. Scope of Testing

### In Scope

| Area | Coverage |
|---|---|
| Authentication (register, login, logout, password reset) | Full |
| Product management (CRUD, search, filtering, pagination) | Full |
| Shopping cart (add, update, remove, clear, totals) | Full |
| Checkout & order creation (payment, coupon application, stock decrement) | Full |
| Auction lifecycle (create, bid placement, bid validation, end) | Full |
| Artisan registration & dashboard (multi-step form, profile, products, coupons) | Full |
| Admin panel (user moderation, product approval, category/coupon/order management) | Full |
| User profile (wishlist, order history, messaging, reviews) | Full |
| API endpoints (XHR/JSON responses) | Full |
| Email service, upload utility, sanitizer, redirect utility | Full |
| Database layer (models, transactions, migrations) | Full |
| Performance — response time & DB query speed | Sampled |

### Out of Scope

- Browser compatibility / cross-browser UI testing (manual only)
- Mobile responsiveness (manual only)
- Third-party payment gateway live integration
- Penetration / vulnerability scanning (covered separately by security review)

---

## 3. Testing Strategy

Craftify uses a **four-layer testing strategy**:

### 3.1 Unit Testing
Each model (`User`, `Product`, `Cart`, `Auction`, `Coupon`, etc.) and each service (`checkoutService`, `paymentService`) is tested in isolation. All external dependencies (database, other models, email) are either seeded via an in-memory SQLite test database or **mocked with Jest** so that each test exercises exactly one unit.

**Files:** `tests/models/m01–m26` and `tests/services/`

### 3.2 Integration Testing
Controller and route suites spin up the full Express application via **Supertest** against a private SQLite database seeded before each suite. HTTP requests traverse the complete middleware stack (session, CSRF-bypass in test mode, auth guards, validators, controllers) and assert on HTTP status codes, redirect targets, response body content, and resulting database state.

**Files:** `tests/controllers/c01–c30` and `tests/routes/`

### 3.3 System Testing
The `tests/craftify.test.js` entry point registers all model, controller, and view suites against a single shared test database to simulate end-to-end user journeys (e.g., register → browse → add to cart → checkout → receive order confirmation). The `tests/full-audit.test.js` file exercises every reported bug fix and regression path.

**Files:** `tests/craftify.test.js`, `tests/full-audit.test.js`, `tests/bug-fixes.test.js`

### 3.4 Performance Testing
A dedicated performance suite measures wall-clock response times for all critical HTTP endpoints and direct database queries. Thresholds are set at **500 ms per HTTP request** and **50 ms per database query**. A throughput test fires 10 sequential requests per endpoint and asserts the average remains under **300 ms**.

**Files:** `tests/performance/performance.test.js`

### 3.5 Black-Box Techniques Applied
- **Equivalence Partitioning:** Login inputs are divided into valid credentials, wrong password, non-existent user, and suspended account partitions. Coupon validation is divided into valid/expired/below-minimum-order partitions.
- **Boundary Value Analysis:** Auction bid amounts are tested at `starting_price - 1` (invalid), `starting_price` (boundary), and `starting_price + increment` (valid). Product price filters are tested at the exact min and max boundary values.

### 3.6 White-Box Techniques Applied
- **Statement Coverage:** Jest `--coverage` is used to measure line and statement coverage. The target threshold is ≥ 80% statements across all controllers, models, middleware, and services.
- **Branch Coverage:** Each conditional branch (e.g., `if (coupon.expires_at && new Date(coupon.expires_at) < new Date())`, `if (!user || user.status !== 'active')`) has at least one test for the true path and one for the false path. Branch suites (`c08`, `c17`, `c18`, `c19`, `c20`, `c21`, etc.) are specifically designed to reach all branches.
- **Basic Path Testing:** The checkout transaction in `checkoutService.js` has paths for: (a) success, (b) payment declined (rollback), (c) empty cart (early exit). All three paths are covered in `tests/services/checkoutService.test.js`.

---

## 4. Testing Environment

### Hardware
| Component | Specification |
|---|---|
| Development Machine | Windows 11, x64 |
| CPU | Intel Core i7 (or equivalent) |
| RAM | 16 GB |
| Storage | SSD |

### Software
| Component | Version / Details |
|---|---|
| Operating System | Windows 11 |
| Runtime | Node.js (LTS) |
| Test Framework | Jest 30.x |
| HTTP Test Client | Supertest 7.x |
| Database (test) | sql.js (in-process SQLite, no file I/O contention) |
| Database (production) | SQLite via sql.js |
| Web Framework | Express 4.x |
| Template Engine | EJS 3.x |
| Version Control | Git |
| CI / Automation | `npm test` (jest --runInBand --forceExit --detectOpenHandles) |

### Test Database Isolation
Each Jest test file creates its own uniquely named SQLite file (`craftify.test.<pid>.db`) in the project root. The file is deleted in `afterAll()`. This prevents any cross-suite data contamination.

---

## 5. Roles and Responsibilities

| Role | Responsible Party | Responsibilities |
|---|---|---|
| **Test Lead** | ITCS489 Team Lead | Approve test plan, review coverage reports, sign off on release |
| **Backend Test Engineer** | Backend Developer | Write and maintain model suites (m01–m26), service tests, middleware tests |
| **Integration Test Engineer** | Full-Stack Developer | Write and maintain controller/route suites (c01–c30), route test files |
| **Performance Test Engineer** | Backend Developer | Write and maintain performance suite, analyse response-time regressions |
| **QA Reviewer** | Any Team Member | Execute full test run before each merge, review bug reports, verify fixes |
| **Documentation Owner** | Team Lead | Maintain this test plan, test case table, and bug report |

---

## 6. Entry and Exit Criteria

### Entry Criteria
- All feature code for the sprint has been merged to the main branch.
- The test database helper (`tests/helpers/testDb.js`) successfully seeds data.
- All npm dependencies are installed (`npm install`).

### Exit Criteria
- All tests pass (`npm test` exits with code 0).
- Code coverage meets thresholds: ≥ 80% statements, ≥ 75% branches, ≥ 80% functions.
- All Critical and High severity bugs are resolved.
- Performance tests pass for all listed endpoints.

---

## 7. Test Deliverables

| Deliverable | Location |
|---|---|
| Test Plan | `docs/test-plan.md` |
| Test Cases | `docs/test-cases.md` |
| Bug Report | `docs/bug-report.md` |
| Unit Test Suite | `tests/models/` |
| Integration Test Suite | `tests/controllers/`, `tests/routes/` |
| System Test Suite | `tests/craftify.test.js`, `tests/full-audit.test.js` |
| Performance Test Suite | `tests/performance/performance.test.js` |
| Bug-Fix Regression Suite | `tests/bug-fixes.test.js` |

---

## 8. Risk and Mitigation

| Risk | Mitigation |
|---|---|
| Flaky tests due to timing (auction end_time) | Store end_time as ISO string; use relative offsets from `Date.now()` |
| Module cache pollution across suites | Each isolated test sets `CRAFTIFY_DB_PATH` before any `require()` |
| Session-based tests failing due to CSRF | `NODE_ENV=test` disables CSRF middleware (see `server.js`) |
| Performance thresholds too tight for slow CI | Thresholds are 500 ms (HTTP) and 50 ms (DB), well above typical local times |
