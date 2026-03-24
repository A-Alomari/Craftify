const { AppError } = require("../utils/http");

const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return next(new AppError(400, "Validation failed", result.error.flatten()));
  }

  req[source] = result.data;
  return next();
};

module.exports = { validate };
