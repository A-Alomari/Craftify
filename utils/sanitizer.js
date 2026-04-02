/**
 * Input sanitization utilities
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

function validateRequired(str, fieldName) {
  if (!str || typeof str !== 'string' || str.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return null;
}

function validateMaxLength(str, max, fieldName) {
  if (typeof str === 'string' && str.length > max) {
    return `${fieldName} must be at most ${max} characters`;
  }
  return null;
}

function validateProductInput(body) {
  const errors = [];
  
  const name = sanitizeString(body.name);
  const description = sanitizeString(body.description);
  
  const nameError = validateRequired(name, 'Product name');
  if (nameError) errors.push(nameError);
  
  const nameLenError = validateMaxLength(name, 200, 'Product name');
  if (nameLenError) errors.push(nameLenError);
  
  const descLenError = validateMaxLength(description, 5000, 'Description');
  if (descLenError) errors.push(descLenError);
  
  return { errors, sanitized: { name, description } };
}

function validateReviewInput(body) {
  const errors = [];
  
  const title = sanitizeString(body.title);
  const comment = sanitizeString(body.comment);
  
  const titleLenError = validateMaxLength(title, 200, 'Review title');
  if (titleLenError) errors.push(titleLenError);
  
  const commentLenError = validateMaxLength(comment, 1000, 'Review comment');
  if (commentLenError) errors.push(commentLenError);
  
  return { errors, sanitized: { title, comment } };
}

module.exports = {
  sanitizeString,
  sanitizeText,
  validateRequired,
  validateMaxLength,
  validateProductInput,
  validateReviewInput
};
