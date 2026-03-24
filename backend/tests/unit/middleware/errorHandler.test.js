/**
 * Unit tests for errorHandler middleware
 */
const { createMockReqRes } = require("../../helpers/setup");
const { AppError } = require("../../../src/utils/errors");

// We need to mock fs for notFoundHandler tests
jest.mock("fs", () => ({
  existsSync: jest.fn(() => false),
}));

const { notFoundHandler, errorHandler } = require("../../../src/middleware/errorHandler");

describe("Error Handler Middleware", () => {
  // ───────────────────── notFoundHandler ─────────────────────
  describe("notFoundHandler", () => {
    it("should call next with 404 AppError for API routes", () => {
      const { req, res, next } = createMockReqRes({
        method: "GET",
        originalUrl: "/api/nonexistent",
        accepts: jest.fn(() => "application/json"),
      });

      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: expect.stringContaining("Route not found") })
      );
    });

    it("should include method and URL in error message", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        originalUrl: "/api/doesnotexist",
        accepts: jest.fn(() => ""),
      });

      notFoundHandler(req, res, next);

      const error = next.mock.calls[0][0];
      expect(error.message).toContain("POST");
      expect(error.message).toContain("/api/doesnotexist");
    });

    it("should serve HTML 404 page for non-API GET request when file exists", () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(true);

      const sendFile = jest.fn();
      const { req, res, next } = createMockReqRes({
        method: "GET",
        originalUrl: "/some-page",
        accepts: jest.fn(() => "text/html"),
      });
      res.sendFile = sendFile;

      notFoundHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(sendFile).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();

      fs.existsSync.mockReturnValue(false);
    });

    it("should call next for non-API GET request when 404 page doesn't exist", () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValue(false);

      const { req, res, next } = createMockReqRes({
        method: "GET",
        originalUrl: "/some-page",
        accepts: jest.fn(() => "text/html"),
      });

      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  // ───────────────────── errorHandler ─────────────────────
  describe("errorHandler", () => {
    it("should return 400 for validation errors", () => {
      const err = new AppError(400, "Validation failed", { field: "email" });
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: "Validation failed", details: { field: "email" } })
      );
    });

    it("should return 404 for not found errors", () => {
      const err = new AppError(404, "Resource not found");
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 for generic errors", () => {
      const err = new Error("Something broke");
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("should not leak stack trace in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const err = new Error("Internal crash");
      err.stack = "Error: Internal crash\n    at secret/path.js:42";
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("should include stack trace in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const err = new Error("Dev crash");
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("should include details when present on error", () => {
      const err = new AppError(400, "Bad request", { fields: ["name"] });
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.details).toEqual({ fields: ["name"] });
    });

    it("should set success to false", () => {
      const err = new Error("fail");
      const { req, res, next } = createMockReqRes();

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });
});
