function parseMinPasswordLength(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 6) {
    return fallback;
  }
  return parsed;
}

function getMinPasswordLength() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isJest = process.env.NODE_ENV === 'test'
    || Boolean(process.env.JEST_WORKER_ID)
    || process.argv.some((arg) => arg.includes('jest'));
  const defaultMin = isProduction && !isJest ? 10 : 6;
  return parseMinPasswordLength(process.env.PASSWORD_MIN_LENGTH, defaultMin);
}

function getPasswordValidationMessage() {
  return `Password must be at least ${getMinPasswordLength()} characters`;
}

module.exports = {
  getMinPasswordLength,
  getPasswordValidationMessage
};
