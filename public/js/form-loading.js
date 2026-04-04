/**
 * Form loading states and submission prevention
 * Disables submit buttons and shows loading spinners during form submission
 */

(function() {
  'use strict';

  /**
   * Add loading state to a form during submission
   */
  function initFormLoadingStates() {
    const forms = document.querySelectorAll('form:not([data-no-loading])');
    
    forms.forEach(function(form) {
      form.addEventListener('submit', function(e) {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        
        if (submitButton && !submitButton.disabled) {
          // Disable the button
          submitButton.disabled = true;
          submitButton.style.opacity = '0.6';
          submitButton.style.cursor = 'not-allowed';
          
          // Store original text
          const originalText = submitButton.textContent || submitButton.value;
          submitButton.dataset.originalText = originalText;
          
          // Add loading spinner and text
          if (submitButton.tagName === 'BUTTON') {
            const spinner = document.createElement('span');
            spinner.className = 'loading-spinner';
            spinner.innerHTML = '<svg class="animate-spin inline-block w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            
            submitButton.innerHTML = spinner.outerHTML + ' Processing...';
          } else {
            submitButton.value = 'Processing...';
          }
          
          // Re-enable after 10 seconds as a fallback (in case of network issues)
          setTimeout(function() {
            if (submitButton.disabled) {
              submitButton.disabled = false;
              submitButton.style.opacity = '1';
              submitButton.style.cursor = 'pointer';
              
              if (submitButton.tagName === 'BUTTON') {
                submitButton.innerHTML = submitButton.dataset.originalText || originalText;
              } else {
                submitButton.value = submitButton.dataset.originalText || originalText;
              }
            }
          }, 10000);
        }
      });
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormLoadingStates);
  } else {
    initFormLoadingStates();
  }
  
  // Re-initialize on page show (for browser back button)
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      // Re-enable all buttons
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
