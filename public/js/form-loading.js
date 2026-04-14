/**
 * Form loading states and submission prevention
 * Disables submit buttons during form submission to prevent double-submits
 */

(function() {
  'use strict';

  function initFormLoadingStates() {
    const forms = document.querySelectorAll('form:not([data-no-loading])');

    forms.forEach(function(form) {
      form.addEventListener('submit', function() {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

        if (submitButton && !submitButton.disabled) {
          submitButton.disabled = true;
          submitButton.style.opacity = '0.6';
          submitButton.style.cursor = 'not-allowed';
          submitButton.dataset.originalText = submitButton.innerHTML || submitButton.value;

          // Re-enable after 10 seconds as a fallback
          setTimeout(function() {
            if (submitButton.disabled) {
              submitButton.disabled = false;
              submitButton.style.opacity = '1';
              submitButton.style.cursor = 'pointer';
              if (submitButton.tagName === 'BUTTON') {
                submitButton.innerHTML = submitButton.dataset.originalText;
              } else {
                submitButton.value = submitButton.dataset.originalText;
              }
            }
          }, 10000);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormLoadingStates);
  } else {
    initFormLoadingStates();
  }

  // Re-initialize on browser back button
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      const submitButtons = document.querySelectorAll('button[type="submit"][disabled], input[type="submit"][disabled]');
      submitButtons.forEach(function(button) {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        if (button.dataset.originalText) {
          if (button.tagName === 'BUTTON') {
            button.innerHTML = button.dataset.originalText;
          } else {
            button.value = button.dataset.originalText;
          }
        }
      });
    }
  });
})();
