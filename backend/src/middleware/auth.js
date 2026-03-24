const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { AppError } = require("../utils/http");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Missing or invalid authorization header"));
  }

  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret);
    req.auth = decoded;
    return next();
  } catch (error) {
    return next(new AppError(401, "Invalid or expired token"));
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(new AppError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(new AppError(403, "You are not allowed to access this resource"));
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };
