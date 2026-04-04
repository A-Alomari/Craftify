/**
 * Client-side form validation with real-time feedback
 * Provides inline error messages and visual feedback for form fields
 */

(function() {
  'use strict';

  // Validation rules
  const validators = {
    required: function(value) {
      return value.trim() !== '';
    },
    email: function(value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    minLength: function(value, min) {
      return value.length >= min;
    },
    match: function(value, matchValue) {
      return value === matchValue;
    }
  };

  // Validation messages
  const messages = {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    minLength: function(min) {
      return `Must be at least ${min} characters`;
    },
    match: 'Fields do not match'
  };

  /**
   * Show error message for a field
   */
  function showError(input, message) {
    // Remove existing error
    hideError(input);

    // Add error class
    input.classList.add('border-red-500', 'border-2');
    input.classList.remove('border-green-500');

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-red-600 text-xs mt-1 validation-error';
    errorDiv.textContent = message;

    // Insert after input
    input.parentNode.insertBefore(errorDiv, input.nextSibling);
  }

  /**
   * Show success state for a field
   */
  function showSuccess(input) {
    hideError(input);
    input.classList.add('border-green-500', 'border-2');
    input.classList.remove('border-red-500');
  }

  /**
   * Hide error message for a field
   */
  function hideError(input) {
    input.classList.remove('border-red-500', 'border-green-500', 'border-2');
    const errorDiv = input.parentNode.querySelector('.validation-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  /**
   * Validate a single field
   */
  function validateField(input) {
    const value = input.value;
    const rules = input.dataset.validate ? input.dataset.validate.split('|') : [];
    
    for (let rule of rules) {
      const [ruleName, ruleValue] = rule.split(':');
      
      if (ruleName === 'required' && !validators.required(value)) {
        showError(input, messages.required);
        return false;
      }
      
      if (ruleName === 'email' && value && !validators.email(value)) {
        showError(input, messages.email);
        return false;
      }
      
      if (ruleName === 'minLength') {
        const min = parseInt(ruleValue, 10);
        if (value && !validators.minLength(value, min)) {
          showError(input, messages.minLength(min));
          return false;
        }
      }
      
      if (ruleName === 'match') {
        const matchField = document.querySelector(`[name="${ruleValue}"]`);
        if (matchField && !validators.match(value, matchField.value)) {
          showError(input, messages.match);
          return false;
        }
      }
    }
    
    if (value && rules.length > 0) {
      showSuccess(input);
    } else {
      hideError(input);
    }
    
    return true;
  }

  /**
   * Initialize validation for a form
   */
  function initFormValidation() {
    const forms = document.querySelectorAll('form[data-validate="true"]');
    
    forms.forEach(function(form) {
      const inputs = form.querySelectorAll('[data-validate]');
      
      // Real-time validation on blur
      inputs.forEach(function(input) {
        input.addEventListener('blur', function() {
          validateField(input);
        });
        
        // Clear error on input
        input.addEventListener('input', function() {
          if (input.classList.contains('border-red-500')) {
            hideError(input);
          }
        });
      });
      
      // Validate on submit
      form.addEventListener('submit', function(e) {
        let isValid = true;
        
        inputs.forEach(function(input) {
          if (!validateField(input)) {
            isValid = false;
          }
        });
        
        if (!isValid) {
          e.preventDefault();
          // Scroll to first error
          const firstError = form.querySelector('.border-red-500');
          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstError.focus();
          }
        }
      });
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormValidation);
  } else {
    initFormValidation();
  }
})();
