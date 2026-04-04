// Craftify - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // CSRF Protection: inject hidden token into all POST forms
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  if (csrfMeta && csrfMeta.content) {
    const csrfToken = csrfMeta.content;
    document.querySelectorAll('form[method="POST"]').forEach(function(form) {
      // Skip if form already has a _csrf hidden input
      if (form.querySelector('input[name="_csrf"]')) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      input.value = csrfToken;
      form.appendChild(input);
    });
  }

  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

  // Cart functionality
  initCart();
  
  // Wishlist functionality
  initWishlist();
  
  // Quantity buttons
  initQuantityButtons();
  
  // Search functionality
  initSearch();
});

function getCsrfToken() {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  return csrfMeta && csrfMeta.content ? csrfMeta.content : '';
}

function getRequestHeaders(method, baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const normalizedMethod = (method || 'GET').toUpperCase();

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    const token = getCsrfToken();
    if (token) {
      headers['CSRF-Token'] = token;
    }
    headers['X-Requested-With'] = 'XMLHttpRequest';
    if (!headers.Accept) {
      headers.Accept = 'application/json';
    }
  }

  return headers;
}

function parseJsonResponse(response) {
  if (response.redirected && response.url) {
    window.location.href = response.url;
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response format');
  }

  return response.json();
}

// Cart Functions
function initCart() {
  // Add to cart buttons
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      const quantity = this.dataset.quantity || 1;
      addToCart(productId, quantity, this);
    });
  });

  // Remove from cart
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.dataset.productId;
      removeFromCart(productId);
    });
  });
}

function addToCart(productId, quantity, btn) {
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.disabled = true;

  fetch('/cart/add', {
    method: 'POST',
    headers: getRequestHeaders('POST', { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId, quantity: parseInt(quantity, 10) || 1 })
  })
  .then(parseJsonResponse)
  .then(data => {
    if (!data) return;

    if (data.success) {
      btn.innerHTML = '<i class="bi bi-check"></i> Added!';
      btn.classList.remove('btn-primary', 'btn-outline-primary');
      btn.classList.add('btn-success');
      updateCartBadge(data.cartCount);
      showToast('Added to cart!', 'success');
      
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        btn.disabled = false;
      }, 2000);
    } else {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      showToast(data.message || 'Failed to add to cart', 'danger');
    }
  })
  .catch(err => {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    showToast('Error adding to cart', 'danger');
  });
}

function removeFromCart(productId) {
  fetch('/cart/remove', {
    method: 'POST',
    headers: getRequestHeaders('POST', { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId })
  })
  .then(parseJsonResponse)
  .then(data => {
    if (!data) return;

    if (data.success) {
      const item = document.querySelector(`.cart-item[data-product-id="${productId}"]`);
      if (item) {
        item.style.opacity = '0';
        setTimeout(() => {
          item.remove();
          updateCartTotals(data);
        }, 300);
      }
      updateCartBadge(data.cartCount);
    }
  });
}

function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

function updateCartTotals(data) {
  if (data.subtotal !== undefined) {
    const subtotalEl = document.querySelector('.cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = '$' + data.subtotal.toFixed(2);
  }
  if (data.total !== undefined) {
    const totalEl = document.querySelector('.cart-total');
    if (totalEl) totalEl.textContent = '$' + data.total.toFixed(2);
  }
}

// Wishlist Functions
function initWishlist() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const productId = this.dataset.productId;
      toggleWishlist(productId, this);
    });
  });
}

function toggleWishlist(productId, btn) {
  fetch('/user/wishlist/toggle', {
    method: 'POST',
    headers: getRequestHeaders('POST', { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId })
  })
  .then(parseJsonResponse)
  .then(data => {
    if (!data) return;

    if (data.success) {
      const isNowInWishlist = Boolean(data.inWishlist);
      btn.classList.toggle('active', isNowInWishlist);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-heart', !isNowInWishlist);
        icon.classList.toggle('bi-heart-fill', isNowInWishlist);
      }
      showToast(isNowInWishlist ? 'Added to wishlist' : 'Removed from wishlist', 'success');
    } else {
      showToast(data.message || 'Failed to update wishlist', 'danger');
    }
  })
  .catch(() => {
    showToast('Error updating wishlist', 'danger');
  });
}

// Quantity Buttons
function initQuantityButtons() {
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentElement.querySelector('.qty-input');
      const action = this.dataset.action;
      let value = parseInt(input.value) || 1;
      const max = parseInt(input.max) || 999;
      const min = parseInt(input.min) || 1;
      
      if (action === 'increase' && value < max) {
        input.value = value + 1;
      } else if (action === 'decrease' && value > min) {
        input.value = value - 1;
      }
      
      // Trigger update
      const productId = this.closest('.cart-item')?.dataset.productId;
      if (productId) {
        updateCartQuantity(productId, input.value);
      }
    });
  });

  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', function() {
      const productId = this.closest('.cart-item')?.dataset.productId;
      if (productId) {
        updateCartQuantity(productId, this.value);
      }
    });
  });
}

function updateCartQuantity(productId, quantity) {
  fetch('/cart/update', {
    method: 'POST',
    headers: getRequestHeaders('POST', { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ productId, quantity: parseInt(quantity, 10) || 1 })
  })
  .then(parseJsonResponse)
  .then(data => {
    if (!data) return;

    if (data.success) {
      // Update item subtotal
      const item = document.querySelector(`.cart-item[data-product-id="${productId}"]`);
      if (item && data.itemSubtotal) {
        const subtotalEl = item.querySelector('.item-subtotal');
        if (subtotalEl) subtotalEl.textContent = '$' + data.itemSubtotal.toFixed(2);
      }
      updateCartTotals(data);
      updateCartBadge(data.cartCount);
    }
  });
}

// Search
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const hideResults = () => {
    searchResults.style.display = 'none';
    searchResults.classList.add('hidden');
  };
  const showResults = () => {
    searchResults.style.display = 'block';
    searchResults.classList.remove('hidden');
  };
  
  if (searchInput && searchResults) {
    let debounceTimer;
    
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      const query = this.value.trim();
      
      if (query.length < 2) {
        hideResults();
        return;
      }
      
      debounceTimer = setTimeout(() => {
        fetch('/api/search/suggestions?q=' + encodeURIComponent(query))
        .then(parseJsonResponse)
        .then(data => {
          if (!data) return;

          const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
          if (suggestions.length > 0) {
            searchResults.innerHTML = suggestions.map(item => {
              const name = escapeHtml(item.name || 'Untitled');
              const type = escapeHtml((item.type || 'item').toString());
              const link = item.link || '#';

              if (item.type === 'product') {
                const image = escapeHtml(item.image || '/images/placeholder-product.jpg');
                const price = Number(item.price);
                const priceLabel = Number.isFinite(price) ? `$${price.toFixed(2)}` : '';

                return `
                  <a href="${link}" class="list-group-item list-group-item-action d-flex align-items-center">
                    <img src="${image}" alt="${name}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                    <div class="flex-grow-1">
                      <strong>${name}</strong>
                      <small class="text-muted d-block">${priceLabel}</small>
                    </div>
                  </a>
                `;
              }

              return `
                <a href="${link}" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
                  <strong>${name}</strong>
                  <small class="text-muted text-uppercase">${type}</small>
                </a>
              `;
            }).join('');
            showResults();
          } else {
            searchResults.innerHTML = '<div class="list-group-item text-muted">No products found</div>';
            showResults();
          }
        })
        .catch(() => {
          searchResults.innerHTML = '<div class="list-group-item text-muted">Unable to load suggestions</div>';
          showResults();
        });
      }, 300);
    });

    searchInput.addEventListener('focus', function() {
      if (this.value.trim().length >= 2 && searchResults.innerHTML.trim()) {
        showResults();
      }
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        hideResults();
      }
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Image Gallery
function initGallery() {
  const mainImage = document.getElementById('mainProductImage');
  const thumbnails = document.querySelectorAll('.product-thumbnails img');
  
  thumbnails.forEach(thumb => {
    thumb.addEventListener('click', function() {
      thumbnails.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      mainImage.src = this.dataset.fullImage || this.src;
    });
  });
}

// Form Validation
function validateForm(form) {
  let isValid = true;
  
  form.querySelectorAll('[required]').forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });
  
  return isValid;
}

// Price Formatting
function formatPrice(price) {
  return '$' + parseFloat(price).toFixed(2);
}

// Time Ago
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'Just now';
}

// Form Submit Helpers with Loading States
function handleFormSubmit(form, options = {}) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;

  const originalBtnText = submitBtn.innerHTML;
  const loadingText = options.loadingText || 'Processing...';
  
  // Disable submit button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin inline-block">progress_activity</span> ${loadingText}`;
  
  // Return cleanup function
  return {
    success: (message) => {
      submitBtn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Success!`;
      submitBtn.classList.add('bg-green-600');
      if (message) showToast(message, 'success');
      setTimeout(() => {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-green-600');
      }, 2000);
    },
    error: (message) => {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      if (message) showToast(message, 'danger');
    },
    reset: () => {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  };
}

// Initialize form loading states on auth forms
document.addEventListener('DOMContentLoaded', function() {
  // Login form
  const loginForm = document.querySelector('form[action*="/auth/login"]');
  if (loginForm) {
    loginForm.addEventListener('submit', function() {
      handleFormSubmit(this, { loadingText: 'Signing in...' });
    });
  }

  // Register form
  const registerForm = document.querySelector('form[action*="/auth/register"]');
  if (registerForm) {
    registerForm.addEventListener('submit', function() {
      handleFormSubmit(this, { loadingText: 'Creating account...' });
    });
  }

  // Checkout form
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function(e) {
      const handler = handleFormSubmit(this, { loadingText: 'Processing order...' });
      // The form will submit normally, loading state provides feedback
    });
  }

  // Message send form
  const messageForm = document.querySelector('form[action*="/user/messages"]');
  if (messageForm && messageForm.method.toUpperCase() === 'POST') {
    messageForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const handler = handleFormSubmit(this, { loadingText: 'Sending...' });
      
      fetch(this.action, {
        method: 'POST',
        body: new FormData(this),
        headers: getRequestHeaders('POST')
      })
      .then(response => {
        if (response.ok) {
          handler.success('Message sent!');
          this.reset();
          // Reload page after short delay to show new message
          setTimeout(() => window.location.reload(), 1000);
        } else {
          handler.error('Failed to send message');
        }
      })
      .catch(() => {
        handler.error('Error sending message');
      });
    });
  }

  // Coupon form
  const couponForm = document.querySelector('form[action*="/cart/coupon"]');
  if (couponForm) {
    couponForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const handler = handleFormSubmit(this, { loadingText: 'Applying...' });
      
      fetch(this.action, {
        method: 'POST',
        body: new FormData(this),
        headers: getRequestHeaders('POST')
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          handler.success('Coupon applied!');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          handler.error(data.message || 'Invalid coupon code');
        }
      })
      .catch(() => {
        handler.error('Error applying coupon');
      });
    });
  }
});
