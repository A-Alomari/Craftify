/**
 * Unit tests for error classes
 */
const {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PaymentRequiredError,
} = require("../../../src/utils/errors");

describe("Error Classes", () => {
  describe("AppError", () => {
    it("should create error with status code and message", () => {
      const err = new AppError(400, "Bad request");

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Bad request");
      expect(err.isOperational).toBe(true);
    });

    it("should store details when provided", () => {
      const err = new AppError(400, "Invalid", { field: "email" });

      expect(err.details).toEqual({ field: "email" });
    });

    it("should have a stack trace", () => {
      const err = new AppError(500, "fail");

      expect(err.stack).toBeDefined();
    });
  });

  describe("ValidationError", () => {
    it("should default to 400 status", () => {
      const err = new ValidationError();

      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Validation failed");
    });

    it("should accept custom message", () => {
      const err = new ValidationError("Custom validation error");

      expect(err.message).toBe("Custom validation error");
    });
  });

  describe("UnauthorizedError", () => {
    it("should default to 401 status", () => {
      const err = new UnauthorizedError();

      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Unauthorized");
    });
  });

  describe("ForbiddenError", () => {
    it("should default to 403 status", () => {
      const err = new ForbiddenError();

      expect(err.statusCode).toBe(403);
      expect(err.message).toBe("Forbidden");
    });
  });

  describe("NotFoundError", () => {
    it("should default to 404 status", () => {
      const err = new NotFoundError();

      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Resource not found");
    });
  });

  describe("ConflictError", () => {
    it("should default to 409 status", () => {
      const err = new ConflictError();

      expect(err.statusCode).toBe(409);
      expect(err.message).toBe("Conflict");
    });
  });

  describe("PaymentRequiredError", () => {
    it("should default to 402 status", () => {
      const err = new PaymentRequiredError();

      expect(err.statusCode).toBe(402);
      expect(err.message).toBe("Payment required");
    });
  });

  describe("Inheritance chain", () => {
    it("all errors should be instances of Error and AppError", () => {
      const errors = [
        new ValidationError(),
        new UnauthorizedError(),
        new ForbiddenError(),
        new NotFoundError(),
        new ConflictError(),
        new PaymentRequiredError(),
      ];

      errors.forEach((err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
        expect(err.isOperational).toBe(true);
      });
    });
  });
});
