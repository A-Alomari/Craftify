// Craftify - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
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

  fetch('/api/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, quantity: parseInt(quantity) })
  })
  .then(r => r.json())
  .then(data => {
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
  fetch('/api/cart/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId })
  })
  .then(r => r.json())
  .then(data => {
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
  const isActive = btn.classList.contains('active');
  const method = isActive ? 'DELETE' : 'POST';
  
  fetch('/api/wishlist/' + productId, { method })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      btn.classList.toggle('active');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-heart');
        icon.classList.toggle('bi-heart-fill');
      }
      showToast(isActive ? 'Removed from wishlist' : 'Added to wishlist', 'success');
    } else if (data.redirect) {
      window.location.href = data.redirect;
    }
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
  fetch('/api/cart/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, quantity: parseInt(quantity) })
  })
  .then(r => r.json())
  .then(data => {
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
  
  if (searchInput && searchResults) {
    let debounceTimer;
    
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      const query = this.value.trim();
      
      if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
      }
      
      debounceTimer = setTimeout(() => {
        fetch('/api/search?q=' + encodeURIComponent(query))
        .then(r => r.json())
        .then(data => {
          if (data.products && data.products.length > 0) {
            searchResults.innerHTML = data.products.map(p => `
              <a href="/products/${p.id}" class="list-group-item list-group-item-action d-flex align-items-center">
                <img src="${p.image}" alt="${p.name}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                <div class="flex-grow-1">
                  <strong>${p.name}</strong>
                  <small class="text-muted d-block">$${p.price.toFixed(2)}</small>
                </div>
              </a>
            `).join('');
            searchResults.style.display = 'block';
          } else {
            searchResults.innerHTML = '<div class="list-group-item text-muted">No products found</div>';
            searchResults.style.display = 'block';
          }
        });
      }, 300);
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
  }
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
