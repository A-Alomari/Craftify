/**
 * Phase 8: E2E Test Specifications (Cypress)
 *
 * These specs are designed to run against a live dev server (frontend + backend).
 * Install Cypress: npx cypress install
 * Run: npx cypress open (or npx cypress run for headless)
 *
 * NOTE: These tests require:
 * - Backend running on http://localhost:4000
 * - Frontend running on http://localhost:3000
 * - A test database with seed data
 */

// ═══════════════════════════════════════════════════════════
// BUYER COMPLETE JOURNEY
// ═══════════════════════════════════════════════════════════
describe("Buyer Complete Journey", () => {
  const testBuyer = {
    fullName: "Test Buyer",
    email: `buyer_${Date.now()}@test.com`,
    password: "TestPassword123!",
  };

  it("should sign up as a new buyer", () => {
    cy.visit("/register");
    cy.get('[data-testid="fullName"]').type(testBuyer.fullName);
    cy.get('[data-testid="email"]').type(testBuyer.email);
    cy.get('[data-testid="password"]').type(testBuyer.password);
    cy.get('[data-testid="submit"]').click();
    cy.url().should("not.include", "/register");
    cy.contains(testBuyer.fullName).should("exist");
  });

  it("should browse home page and see featured products", () => {
    cy.visit("/");
    cy.get('[data-testid="product-card"]').should("have.length.greaterThan", 0);
  });

  it("should search for a product", () => {
    cy.visit("/");
    cy.get('[data-testid="search-input"]').type("handmade{enter}");
    cy.url().should("include", "search");
    cy.get('[data-testid="search-results"]').should("exist");
  });

  it("should view product detail page", () => {
    cy.visit("/");
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="product-detail"]').should("exist");
    cy.get('[data-testid="product-price"]').should("exist");
  });

  it("should add product to cart", () => {
    cy.visit("/");
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="add-to-cart"]').click();
    cy.get('[data-testid="cart-count"]').should("contain", "1");
  });

  it("should add product to wishlist", () => {
    cy.visit("/");
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="add-to-wishlist"]').click();
    cy.visit("/wishlist");
    cy.get('[data-testid="wishlist-item"]').should("have.length.greaterThan", 0);
  });

  it("should view cart with correct items and prices", () => {
    cy.visit("/cart");
    cy.get('[data-testid="cart-item"]').should("have.length.greaterThan", 0);
    cy.get('[data-testid="cart-total"]').should("exist");
  });

  it("should proceed to checkout and complete order", () => {
    cy.visit("/cart");
    cy.get('[data-testid="checkout-btn"]').click();
    cy.get('[data-testid="shipping-name"]').type("Test Buyer");
    cy.get('[data-testid="shipping-email"]').type("buyer@test.com");
    cy.get('[data-testid="shipping-street"]').type("123 Main St");
    cy.get('[data-testid="shipping-city"]').type("Springfield");
    cy.get('[data-testid="shipping-state"]').type("IL");
    cy.get('[data-testid="shipping-zip"]').type("62701");
    cy.get('[data-testid="place-order"]').click();
    cy.url().should("include", "/order");
  });

  it("should view order in order history", () => {
    cy.visit("/orders");
    cy.get('[data-testid="order-item"]').should("have.length.greaterThan", 0);
  });
});

// ═══════════════════════════════════════════════════════════
// BUYER AUCTION JOURNEY
// ═══════════════════════════════════════════════════════════
describe("Buyer Auction Journey", () => {
  it("should browse live auctions", () => {
    cy.visit("/auctions");
    cy.get('[data-testid="auction-card"]').should("exist");
  });

  it("should enter auction room and see current bid", () => {
    cy.visit("/auctions");
    cy.get('[data-testid="auction-card"]').first().click();
    cy.get('[data-testid="current-bid"]').should("exist");
    cy.get('[data-testid="auction-timer"]').should("exist");
  });

  it("should place a bid", () => {
    cy.visit("/auctions");
    cy.get('[data-testid="auction-card"]').first().click();
    cy.get('[data-testid="bid-input"]').type("100");
    cy.get('[data-testid="place-bid"]').click();
    cy.get('[data-testid="bid-success"]').should("exist");
  });
});

// ═══════════════════════════════════════════════════════════
// ARTISAN COMPLETE JOURNEY
// ═══════════════════════════════════════════════════════════
describe("Artisan Complete Journey", () => {
  it("should register as artisan", () => {
    cy.visit("/artisan/register");
    cy.get('[data-testid="shop-name"]').type("My Craft Shop");
    cy.get('[data-testid="location"]').type("New York");
    cy.get('[data-testid="submit"]').click();
    cy.url().should("include", "/artisan/dashboard");
  });

  it("should add a new product", () => {
    cy.visit("/artisan/products/new");
    cy.get('[data-testid="product-name"]').type("Handmade Vase");
    cy.get('[data-testid="product-description"]').type("A beautiful ceramic vase");
    cy.get('[data-testid="product-price"]').type("49.99");
    cy.get('[data-testid="submit"]').click();
    cy.contains("Handmade Vase").should("exist");
  });

  it("should view artisan dashboard with stats", () => {
    cy.visit("/artisan/dashboard");
    cy.get('[data-testid="total-products"]').should("exist");
    cy.get('[data-testid="total-sales"]').should("exist");
  });

  it("should view incoming orders", () => {
    cy.visit("/artisan/orders");
    cy.get('[data-testid="order-item"]').should("exist");
  });
});

// ═══════════════════════════════════════════════════════════
// ADMIN COMPLETE JOURNEY
// ═══════════════════════════════════════════════════════════
describe("Admin Complete Journey", () => {
  it("should access admin dashboard", () => {
    cy.visit("/admin/dashboard");
    cy.get('[data-testid="admin-stats"]').should("exist");
    cy.get('[data-testid="total-users"]').should("exist");
    cy.get('[data-testid="total-orders"]').should("exist");
  });

  it("should view all users", () => {
    cy.visit("/admin/users");
    cy.get('[data-testid="user-row"]').should("have.length.greaterThan", 0);
  });

  it("should view all orders", () => {
    cy.visit("/admin/orders");
    cy.get('[data-testid="order-row"]').should("have.length.greaterThan", 0);
  });
});

// ═══════════════════════════════════════════════════════════
// MESSAGING FLOW
// ═══════════════════════════════════════════════════════════
describe("Messaging Flow", () => {
  it("should send a message to artisan from product page", () => {
    cy.visit("/products/p1");
    cy.get('[data-testid="contact-artisan"]').click();
    cy.get('[data-testid="message-input"]').type("Hello, I love your work!");
    cy.get('[data-testid="send-message"]').click();
    cy.get('[data-testid="message-sent"]').should("exist");
  });

  it("should see conversation in conversation list", () => {
    cy.visit("/messages");
    cy.get('[data-testid="conversation-item"]').should("have.length.greaterThan", 0);
  });
});

// ═══════════════════════════════════════════════════════════
// PASSWORD RECOVERY FLOW
// ═══════════════════════════════════════════════════════════
describe("Password Recovery Flow", () => {
  it("should initiate forgot password", () => {
    cy.visit("/forgot-password");
    cy.get('[data-testid="email"]').type("user@test.com");
    cy.get('[data-testid="submit"]').click();
    cy.contains("verification code").should("exist");
  });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING FLOWS
// ═══════════════════════════════════════════════════════════
describe("Error Handling Flows", () => {
  it("should show 404 page for non-existent URL", () => {
    cy.visit("/this-page-does-not-exist", { failOnStatusCode: false });
    cy.contains("404").should("exist");
  });

  it("should redirect to login when accessing protected page", () => {
    cy.clearCookies();
    cy.visit("/orders");
    cy.url().should("include", "/login");
  });

  it("should show validation errors on empty form submit", () => {
    cy.visit("/register");
    cy.get('[data-testid="submit"]').click();
    cy.get('[data-testid="error-message"]').should("exist");
  });
});
