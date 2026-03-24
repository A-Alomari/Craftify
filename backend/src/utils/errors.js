class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed", details) {
    super(400, message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message);
  }
}

class PaymentRequiredError extends AppError {
  constructor(message = "Payment required") {
    super(402, message);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PaymentRequiredError,
};
