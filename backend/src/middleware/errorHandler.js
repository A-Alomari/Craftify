const fs = require("fs");
const path = require("path");
const { AppError } = require("../utils/http");

const notFoundPagePath = path.resolve(__dirname, "../../../pages/errors/404.html");

function notFoundHandler(req, res, next) {
  const wantsHtml = req.method === "GET" && (req.accepts("html") || "").includes("html");
  const isApiRoute = req.originalUrl.startsWith("/api/");

  if (wantsHtml && !isApiRoute && fs.existsSync(notFoundPagePath)) {
    res.status(404).sendFile(notFoundPagePath);
    return;
  }

  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;

  if (err && err.name === "MulterError") {
    statusCode = 400;
  }

  const payload = {
    success: false,
    message: err.message || "Internal server error",
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
