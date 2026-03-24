/**
 * Unit tests for validate middleware
 */
const { z } = require("zod");
const { createMockReqRes } = require("../../helpers/setup");

// Need to mock the http module used by validate
jest.mock("../../../src/utils/http", () => {
  class AppError extends Error {
    constructor(statusCode, message, details) {
      super(message);
      this.statusCode = statusCode;
      this.details = details;
    }
  }
  return { AppError };
});

const { validate } = require("../../../src/middleware/validate");

describe("Validate Middleware", () => {
  const testSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
  });

  it("should pass validation with valid data and attach parsed data to req.body", () => {
    const { req, res, next } = createMockReqRes({
      body: { name: "Alice", email: "alice@test.com" },
    });

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "Alice", email: "alice@test.com" });
  });

  it("should call next with AppError 400 for invalid data", () => {
    const { req, res, next } = createMockReqRes({
      body: { name: "A", email: "not-an-email" },
    });

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: "Validation failed" })
    );
  });

  it("should fail when required fields are missing", () => {
    const { req, res, next } = createMockReqRes({
      body: {},
    });

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("should strip unknown fields (Zod default behavior)", () => {
    const { req, res, next } = createMockReqRes({
      body: { name: "Bob", email: "bob@test.com", malicious: "<script>" },
    });

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.malicious).toBeUndefined();
  });

  it("should validate query params when source is 'query'", () => {
    const querySchema = z.object({ q: z.string().min(1) });
    const { req, res, next } = createMockReqRes({
      query: { q: "search term" },
    });

    validate(querySchema, "query")(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query.q).toBe("search term");
  });

  it("should reject invalid query params", () => {
    const querySchema = z.object({ q: z.string().min(1) });
    const { req, res, next } = createMockReqRes({
      query: { q: "" },
    });

    validate(querySchema, "query")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
  });
});
