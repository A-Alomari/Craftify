/**
 * Form loading states and submission prevention
 * Disables submit buttons during form submission to prevent double-submits
 */

(function() {
  'use strict';

  function restoreSubmitButton(btn) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    if (btn.dataset.originalText) {
      if (btn.tagName === 'BUTTON') btn.innerHTML = btn.dataset.originalText;
      else btn.value = btn.dataset.originalText;
    }
  }

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

          // Re-enable after 8 seconds as a fallback (in case JS handler doesn't restore it)
          setTimeout(function() {
            restoreSubmitButton(submitButton);
          }, 8000);
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
      document.querySelectorAll('button[type="submit"][disabled], input[type="submit"][disabled]').forEach(restoreSubmitButton);
    }
  });
})();
