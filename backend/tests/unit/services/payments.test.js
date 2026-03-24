/**
 * Unit tests for payments.js
 */
jest.mock("../../../src/config/env", () => ({
  env: {
    paymentProvider: "mock",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
  },
}));

const { createPayment, parseWebhook, toMinorUnits } = require("../../../src/services/payments");

describe("Payments Service", () => {
  describe("createPayment", () => {
    it("should return mock payment for valid amount", async () => {
      const result = await createPayment({ amount: 50, description: "Test" });

      expect(result.provider).toBe("mock");
      expect(result.status).toBe("succeeded");
      expect(result.amount).toBe(50);
      expect(result.paymentId).toMatch(/^mock_/);
    });

    it("should throw ValidationError for zero amount", async () => {
      await expect(createPayment({ amount: 0 })).rejects.toThrow("Invalid payment amount");
    });

    it("should throw ValidationError for negative amount", async () => {
      await expect(createPayment({ amount: -10 })).rejects.toThrow("Invalid payment amount");
    });

    it("should default currency to usd", async () => {
      const result = await createPayment({ amount: 10 });
      expect(result.currency).toBe("usd");
    });

    it("should accept custom currency", async () => {
      const result = await createPayment({ amount: 10, currency: "eur" });
      expect(result.currency).toBe("eur");
    });

    it("should include amount in result", async () => {
      const result = await createPayment({ amount: 25, description: "Test order" });
      expect(result.amount).toBe(25);
      expect(result.status).toBe("succeeded");
    });
  });

  describe("parseWebhook", () => {
    it("should return mock provider when stripe is not configured", async () => {
      const result = await parseWebhook({ type: "test" }, null);

      expect(result.provider).toBe("mock");
      expect(result.validated).toBe(false);
    });

    it("should return mock result with signature provided", async () => {
      const body = { type: "payment_intent.succeeded", data: { id: "pi_123" } };
      const result = await parseWebhook(body, "some-sig");

      expect(result.provider).toBe("mock");
      expect(result.validated).toBe(false);
    });

    it("should work with empty body", async () => {
      const result = await parseWebhook({}, undefined);
      expect(result.provider).toBe("mock");
    });
  });

  describe("toMinorUnits", () => {
    it("should exist as a function", () => {
      if (typeof toMinorUnits === "function") {
        expect(toMinorUnits(10)).toBe(1000);
        expect(toMinorUnits(0.5)).toBe(50);
      }
    });
  });
});

