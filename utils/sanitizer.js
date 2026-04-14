/**
 * Input sanitization utilities
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\r\n/g, '\n').trim();
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

function validateCheckoutInput(body = {}) {
  const errors = [];

  const shipping_address = sanitizeString(body.shipping_address);
  const shipping_building = sanitizeString(body.shipping_building) || '';
  const shipping_city = sanitizeString(body.shipping_city);
  const shipping_postal = sanitizeString(body.shipping_postal) || '';
  const shipping_country = sanitizeString(body.shipping_country) || 'Bahrain';
  const payment_method = sanitizeString(body.payment_method);
  const notes = sanitizeText(body.notes) || '';

  if (!shipping_address || !shipping_building || !shipping_city) {
    errors.push('Shipping address, building, and city are required');
  }

  const allowedPaymentMethods = new Set(['card', 'cash']);
  if (!payment_method) {
    errors.push('Payment method is required');
  } else if (!allowedPaymentMethods.has(payment_method)) {
    errors.push('Payment method is invalid');
  }

  const sanitized = {
    shipping_address,
    shipping_building,
    shipping_city,
    shipping_postal,
    shipping_country,
    payment_method,
    notes
  };

  if (payment_method === 'card') {
    const card_number = (sanitizeString(body.card_number) || '').replace(/\s+/g, '');
    const card_expiry = sanitizeString(body.card_expiry) || '';
    const card_cvc = sanitizeString(body.card_cvc) || '';

    if (!card_number || !card_expiry || !card_cvc) {
      errors.push('Card details are required for card payments');
    } else {
      if (!/^\d{13,19}$/.test(card_number)) {
        errors.push('Card number must contain 13 to 19 digits');
      }

      const expiryMatch = card_expiry.match(/^(\d{2})\/(\d{2})$/);
      if (!expiryMatch) {
        errors.push('Card expiry must use MM/YY format');
      } else {
        const month = Number.parseInt(expiryMatch[1], 10);
        if (Number.isNaN(month) || month < 1 || month > 12) {
          errors.push('Card expiry month is invalid');
        }
      }

      if (!/^\d{3,4}$/.test(card_cvc)) {
        errors.push('Card CVC is invalid');
      }
    }

    sanitized.card_number = card_number;
    sanitized.card_expiry = card_expiry;
    sanitized.card_cvc = card_cvc;
  }

  return { errors, sanitized };
}

function validateMessageInput(body = {}, maxLength = 2000) {
  const errors = [];
  const parsedReceiverId = Number.parseInt(body.receiver_id, 10);
  const content = sanitizeText(body.content);

  if (Number.isNaN(parsedReceiverId) || parsedReceiverId <= 0) {
    errors.push('Invalid recipient');
  }

  if (!content) {
    errors.push('Message content is required');
  } else if (content.length > maxLength) {
    errors.push(`Message must be at most ${maxLength} characters`);
  }

  return {
    errors,
    sanitized: {
      receiver_id: parsedReceiverId,
      content
    }
  };
}

module.exports = {
  sanitizeString,
  sanitizeText,
  validateRequired,
  validateMaxLength,
  validateProductInput,
  validateReviewInput,
  validateCheckoutInput,
  validateMessageInput
};
