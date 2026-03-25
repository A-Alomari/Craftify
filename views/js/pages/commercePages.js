import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_user") || "";
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function refreshCartBadge() {
  const badge = document.getElementById("cart-count-badge");
  if (!badge || !getToken()) {
    return;
  }

  try {
    const data = await api("/cart");
    const count = (data.cart && data.cart.items ? data.cart.items : []).reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    badge.textContent = String(count);
  } catch (error) {
    // Ignore badge failures for anonymous users or API downtime.
  }
}

async function addToCart(productId, quantity) {
  if (!getToken()) {
    showMessage("Please sign in before adding to cart", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  await api("/cart/add", {
    method: "POST",
    body: JSON.stringify({ productId: productId, quantity: quantity || 1 }),
  });

  await refreshCartBadge();
  showMessage("Added to cart", "success");
}

export function wireProductBrowsing() {
  const grid = document.getElementById("product-grid");
  if (!grid) {
    return;
  }

  api("/products?page=1&pageSize=12")
    .then(function (data) {
      const items = data.items || [];
      if (!items.length) {
        return;
      }

      const cards = Array.from(grid.querySelectorAll("article"));
      for (let i = 0; i < cards.length && i < items.length; i += 1) {
        const card = cards[i];
        const item = items[i];

        card.setAttribute("data-product-id", item.id);

        const image = card.querySelector("img");
        if (image && item.imageUrls && item.imageUrls[0]) {
          image.src = item.imageUrls[0];
          image.alt = item.name;
        }

        const title = card.querySelector("h3");
        if (title) {
          title.textContent = item.name;
        }

        const byline = card.querySelector("p");
        if (byline && item.artisan && item.artisan.fullName) {
          byline.innerHTML = "by <span class=\"underline decoration-outline-variant/50 underline-offset-4\">" + item.artisan.fullName + "</span>";
        }

        const price = card.querySelector(".text-xl.font-headline.font-bold");
        if (price) {
          price.textContent = money(item.price);
        }

        const button = card.querySelector("button.w-full");
        if (button) {
          button.addEventListener("click", function (event) {
            event.preventDefault();
            addToCart(item.id, 1).catch(function (error) {
              showMessage(error.message, "error");
            });
          });
        }

        card.addEventListener("click", function (event) {
          if (event.target.closest("button")) {
            return;
          }
          window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(item.id);
        });
        card.style.cursor = "pointer";
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

export function wireProductDetail() {
  const title = document.getElementById("product-title");
  if (!title) {
    return;
  }

  const price = document.getElementById("product-price");
  const description = document.getElementById("product-description");
  const quantityEl = document.getElementById("product-quantity");
  const addBtn = document.getElementById("add-to-cart-btn");
  const buyNowBtn = document.getElementById("buy-now-btn");
  const image = document.querySelector("main .aspect-square img");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  function updateQuantity(delta) {
    if (!quantityEl) {
      return;
    }
    const next = Math.max(1, Number(quantityEl.textContent || "1") + delta);
    quantityEl.textContent = String(next);
  }

  const qtyWrap = quantityEl ? quantityEl.parentElement : null;
  if (qtyWrap) {
    const minus = qtyWrap.querySelector("button:first-child");
    const plus = qtyWrap.querySelector("button:last-child");
    if (minus) {
      minus.addEventListener("click", function (event) {
        event.preventDefault();
        updateQuantity(-1);
      });
    }
    if (plus) {
      plus.addEventListener("click", function (event) {
        event.preventDefault();
        updateQuantity(1);
      });
    }
  }

  function bindActions(productId) {
    if (addBtn) {
      addBtn.addEventListener("click", function (event) {
        event.preventDefault();
        const qty = quantityEl ? Number(quantityEl.textContent || "1") : 1;
        addToCart(productId, qty).catch(function (error) {
          showMessage(error.message, "error");
        });
      });
    }

    if (buyNowBtn) {
      buyNowBtn.addEventListener("click", function (event) {
        event.preventDefault();
        const qty = quantityEl ? Number(quantityEl.textContent || "1") : 1;
        addToCart(productId, qty)
          .then(function () {
            window.location.href = "../shopping/checkout.html";
          })
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    }
  }

  if (id) {
    api("/products/" + encodeURIComponent(id))
      .then(function (data) {
        const product = data.product;
        title.textContent = product.name;
        if (price) {
          price.textContent = money(product.price);
        }
        if (description) {
          description.textContent = product.description;
        }
        if (image && product.imageUrls && product.imageUrls[0]) {
          image.src = product.imageUrls[0];
          image.alt = product.name;
        }
        bindActions(product.id);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  } else {
    api("/products?page=1&pageSize=1")
      .then(function (data) {
        if (data.items && data.items[0]) {
          bindActions(data.items[0].id);
        }
      })
      .catch(function () {
        // no-op
      });
  }
}

export function wireCartPage() {
  const itemsWrap = document.getElementById("cart-items");
  if (!itemsWrap) {
    return;
  }

  const subtotalEl = document.getElementById("summary-subtotal");
  const totalEl = document.getElementById("summary-total");
  const checkoutBtn = document.getElementById("go-to-checkout-btn");

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = "../shopping/checkout.html";
    });
  }

  if (!getToken()) {
    showMessage("Sign in to view cart", "error");
    return;
  }

  function renderCart() {
    api("/cart")
      .then(function (data) {
        const items = (data.cart && data.cart.items) || [];
        if (!items.length) {
          itemsWrap.innerHTML = "<div class=\"bg-surface-container-lowest p-6 rounded-xl\">Your cart is empty.</div>";
          if (subtotalEl) {
            subtotalEl.textContent = money(0);
          }
          if (totalEl) {
            totalEl.textContent = money(0);
          }
          refreshCartBadge();
          return;
        }

        itemsWrap.innerHTML = items
          .map(function (item) {
            const img = item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "";
            return (
              "<div class=\"bg-surface-container-lowest p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-6 transition-all hover:shadow-md\" data-product-id=\"" +
              item.productId +
              "\">" +
              "<div class=\"w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-low\"><img class=\"w-full h-full object-cover\" src=\"" +
              img +
              "\" alt=\"" +
              item.product.name +
              "\"></div>" +
              "<div class=\"flex-grow space-y-1\"><h3 class=\"font-headline text-lg font-bold text-on-surface\">" +
              item.product.name +
              "</h3><p class=\"text-sm text-on-secondary-container\">" +
              money(item.product.price) +
              " each</p>" +
              "<button class=\"flex items-center gap-1 text-xs text-error mt-4 hover:underline\" data-action=\"remove\">Remove</button></div>" +
              "<div class=\"flex items-center gap-4 bg-surface-container-low px-3 py-1 rounded-full border border-outline-variant/20\">" +
              "<button class=\"w-8 h-8 flex items-center justify-center\" data-action=\"dec\">-</button>" +
              "<span class=\"font-bold w-4 text-center\">" +
              item.quantity +
              "</span>" +
              "<button class=\"w-8 h-8 flex items-center justify-center\" data-action=\"inc\">+</button></div>" +
              "<div class=\"text-right sm:min-w-[80px]\"><span class=\"font-headline text-xl font-bold text-on-surface\">" +
              money(item.product.price * item.quantity) +
              "</span></div></div>"
            );
          })
          .join("");

        if (subtotalEl) {
          subtotalEl.textContent = money(data.total || 0);
        }
        if (totalEl) {
          totalEl.textContent = money(data.total || 0);
        }

        itemsWrap.querySelectorAll("[data-action]").forEach(function (btn) {
          btn.addEventListener("click", function (event) {
            event.preventDefault();
            const row = event.target.closest("[data-product-id]");
            const productId = row ? row.getAttribute("data-product-id") : "";
            const action = event.target.getAttribute("data-action");

            const currentQtyText = row ? row.querySelector(".font-bold.w-4") : null;
            const currentQty = currentQtyText ? Number(currentQtyText.textContent || "1") : 1;

            if (action === "remove") {
              api("/cart/remove?productId=" + encodeURIComponent(productId), { method: "DELETE" })
                .then(renderCart)
                .catch(function (error) {
                  showMessage(error.message, "error");
                });
              return;
            }

            if (action === "inc" || action === "dec") {
              const nextQty = action === "inc" ? currentQty + 1 : Math.max(1, currentQty - 1);
              api("/cart/update", {
                method: "PUT",
                body: JSON.stringify({ productId: productId, quantity: nextQty }),
              })
                .then(renderCart)
                .catch(function (error) {
                  showMessage(error.message, "error");
                });
            }
          });
        });

        refreshCartBadge();
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  renderCart();
}

export function wireCheckoutPage() {
  const placeOrderBtn = document.getElementById("place-order-btn");
  if (!placeOrderBtn) {
    return;
  }

  const itemsWrap = document.getElementById("checkout-order-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const shippingEl = document.getElementById("checkout-shipping");
  const totalEl = document.getElementById("checkout-total");

  function loadCheckoutItems() {
    if (!getToken()) {
      showMessage("Please sign in before checkout", "error");
      return;
    }

    api("/cart")
      .then(function (data) {
        const items = (data.cart && data.cart.items) || [];
        if (itemsWrap && items.length) {
          itemsWrap.innerHTML = items
            .map(function (item) {
              const img = item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "";
              return (
                "<div class=\"flex gap-4\"><div class=\"w-20 h-20 bg-surface-container rounded-lg overflow-hidden flex-shrink-0\">" +
                "<img class=\"w-full h-full object-cover\" src=\"" +
                img +
                "\" alt=\"" +
                item.product.name +
                "\"></div><div class=\"flex-1 flex flex-col justify-between py-1\"><div class=\"flex justify-between items-start\">" +
                "<span class=\"font-headline font-bold text-on-surface\">" +
                item.product.name +
                "</span><span class=\"font-serif text-amber-700\">" +
                money(item.product.price * item.quantity) +
                "</span></div><span class=\"text-xs text-on-secondary-container font-label uppercase tracking-tighter\">Qty: " +
                item.quantity +
                "</span></div></div>"
              );
            })
            .join("");
        }

        const subtotal = Number(data.total || 0);
        const shipping = subtotal > 0 ? 12 : 0;
        const total = subtotal + shipping;

        if (subtotalEl) {
          subtotalEl.textContent = money(subtotal);
        }
        if (shippingEl) {
          shippingEl.textContent = money(shipping);
        }
        if (totalEl) {
          totalEl.textContent = money(total);
        }
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  placeOrderBtn.addEventListener("click", function (event) {
    event.preventDefault();

    const payload = {
      shippingName: (val("shipping-first-name") + " " + val("shipping-last-name")).trim(),
      shippingEmail: val("shipping-email"),
      shippingStreet: val("shipping-street"),
      shippingCity: val("shipping-city"),
      shippingState: val("shipping-state"),
      shippingZip: val("shipping-zip"),
      paymentMethodToken: val("checkout-payment-method-token"),
    };

    if (!payload.paymentMethodToken) {
      delete payload.paymentMethodToken;
    }

    if (!payload.shippingName || !payload.shippingEmail || !payload.shippingStreet || !payload.shippingCity || !payload.shippingState || !payload.shippingZip) {
      showMessage("Please complete all shipping fields", "error");
      return;
    }

    api("/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(function (data) {
        localStorage.setItem("craftify_last_order_id", data.order.id);
        showMessage("Order placed successfully", "success");
        window.location.href = "../shopping/order-confirmation.html?orderId=" + encodeURIComponent(data.order.id);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  });

  loadCheckoutItems();
}

export function wireWishlistPage() {
  var gridEl = document.getElementById("wishlist-grid");
  if (!gridEl) {
    return;
  }

  var countTextEl = document.getElementById("wishlist-count-text");
  var clearBtn = document.getElementById("wishlist-clear-all-btn");

  if (!getToken()) {
    showMessage("Please sign in to view your wishlist", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  function renderItems(items) {
    if (countTextEl) {
      countTextEl.textContent = items.length + " item" + (items.length === 1 ? "" : "s") + " saved";
    }

    if (!items.length) {
      gridEl.innerHTML =
        "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10\">" +
        "<h3 class=\"text-xl font-bold mb-2\">Your wishlist is empty</h3>" +
        "<p class=\"text-on-surface-variant\">Browse products and save your favorites here.</p></div>";
      return;
    }

    gridEl.innerHTML = items
      .map(function (entry) {
        var product = entry.product || {};
        var imageUrl = product.imageUrls && product.imageUrls[0] ? product.imageUrls[0] : "https://via.placeholder.com/640x800?text=Product";
        return (
          "<div class=\"group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden hover:shadow-xl transition-shadow duration-300\" data-product-id=\"" +
          product.id +
          "\">" +
          "<div class=\"relative aspect-[4/5] overflow-hidden\">" +
          "<img class=\"w-full h-full object-cover group-hover:scale-105 transition-transform duration-500\" src=\"" +
          imageUrl +
          "\" alt=\"" +
          (product.name || "Product") +
          "\"/>" +
          "<button class=\"absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-tertiary shadow-sm\" data-action=\"remove\">" +
          "<span class=\"material-symbols-outlined filled-icon\">favorite</span></button></div>" +
          "<div class=\"p-6 flex flex-col flex-grow\">" +
          "<span class=\"text-[10px] font-bold tracking-[0.2em] text-secondary uppercase mb-2\">CRAFT</span>" +
          "<h3 class=\"text-xl font-bold font-headline mb-1\">" +
          (product.name || "Product") +
          "</h3>" +
          "<p class=\"text-on-surface-variant text-sm mb-3\">Saved item</p>" +
          "<div class=\"mt-auto\"><div class=\"flex justify-between items-center mb-4\">" +
          "<span class=\"text-2xl font-bold font-headline text-on-surface\">" +
          money(product.price || 0) +
          "</span><span class=\"text-xs font-bold text-emerald-600 flex items-center gap-1\">" +
          "<span class=\"w-1.5 h-1.5 rounded-full bg-emerald-600\"></span> In Stock</span></div>" +
          "<button class=\"w-full py-3 bg-primary-container text-on-primary-container font-bold rounded-lg hover:bg-primary transition-colors duration-200\" data-action=\"add-to-cart\">" +
          "Add to Cart</button></div></div></div>"
        );
      })
      .join("");

    gridEl.querySelectorAll("[data-action='remove']").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var card = event.currentTarget.closest("[data-product-id]");
        var productId = card ? card.getAttribute("data-product-id") : "";
        api("/wishlist/remove?productId=" + encodeURIComponent(productId), { method: "DELETE" })
          .then(loadWishlist)
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    });

    gridEl.querySelectorAll("[data-action='add-to-cart']").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var card = event.currentTarget.closest("[data-product-id]");
        var productId = card ? card.getAttribute("data-product-id") : "";
        addToCart(productId, 1).catch(function (error) {
          showMessage(error.message, "error");
        });
      });
    });

    gridEl.querySelectorAll("[data-product-id]").forEach(function (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        var productId = card.getAttribute("data-product-id");
        window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(productId);
      });
    });
  }

  function loadWishlist() {
    api("/wishlist")
      .then(function (data) {
        var items = data.wishlist && data.wishlist.items ? data.wishlist.items : [];
        renderItems(items);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      api("/wishlist")
        .then(function (data) {
          var items = data.wishlist && data.wishlist.items ? data.wishlist.items : [];
          return Promise.all(
            items.map(function (item) {
              return api("/wishlist/remove?productId=" + encodeURIComponent(item.productId), { method: "DELETE" });
            }),
          );
        })
        .then(function () {
          showMessage("Wishlist cleared", "success");
          loadWishlist();
        })
        .catch(function (error) {
          showMessage(error.message, "error");
        });
    });
  }

  loadWishlist();
}

export function wireSearchResultsPage() {
  var gridEl = document.getElementById("search-results-grid");
  if (!gridEl) {
    return;
  }

  var titleEl = document.getElementById("search-results-title");
  var inputEl = document.getElementById("search-results-query-input");
  var sortEl = document.getElementById("search-results-sort-select");
  var clearBtn = document.getElementById("search-results-clear-filters-btn");

  var params = new URLSearchParams(window.location.search);
  var initialQuery = params.get("q") || (inputEl ? inputEl.value : "") || "";
  if (inputEl && initialQuery) {
    inputEl.value = initialQuery;
  }

  function sortProducts(items) {
    var list = items.slice();
    var mode = sortEl ? sortEl.value : "Relevance";
    if (mode === "Newest Arrivals") {
      list.sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (mode === "Price: Low to High") {
      list.sort(function (a, b) {
        return Number(a.price || 0) - Number(b.price || 0);
      });
    } else if (mode === "Price: High to Low") {
      list.sort(function (a, b) {
        return Number(b.price || 0) - Number(a.price || 0);
      });
    }
    return list;
  }

  function render(query, products) {
    var sorted = sortProducts(products);

    if (titleEl) {
      titleEl.innerHTML = "Showing " + sorted.length + " results for <span class=\"italic text-primary\">\"" + (query || "all products") + "\"</span>";
    }

    if (!sorted.length) {
      gridEl.innerHTML =
        "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10\">" +
        "<h3 class=\"text-xl font-bold mb-2\">No products found</h3><p class=\"text-secondary\">Try a different search term.</p></div>";
      return;
    }

    gridEl.innerHTML = sorted
      .map(function (item) {
        var imageUrl = item.imageUrls && item.imageUrls[0] ? item.imageUrls[0] : "https://via.placeholder.com/640?text=Product";
        return (
          "<div class=\"group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 p-4\" data-product-id=\"" +
          item.id +
          "\"><div class=\"relative aspect-square mb-6 overflow-hidden rounded-lg\"><img alt=\"" +
          item.name +
          "\" class=\"w-full h-full object-cover transition-transform duration-500 group-hover:scale-110\" src=\"" +
          imageUrl +
          "\"/><button class=\"absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-full text-secondary hover:text-tertiary transition-all shadow-sm\" data-action=\"wishlist\"><span class=\"material-symbols-outlined\">favorite</span></button>" +
          "<span class=\"absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-secondary shadow-sm\">Products</span></div>" +
          "<div class=\"space-y-1\"><h3 class=\"font-headline text-lg leading-tight\">" +
          item.name +
          "</h3><p class=\"text-xs text-secondary italic\">Search result</p></div><div class=\"flex items-center justify-between mt-6\"><span class=\"font-headline text-xl text-on-surface\">" +
          money(item.price || 0) +
          "</span><button class=\"bg-primary-container text-on-primary-container px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity active:scale-95\" data-action=\"add-to-cart\">Add to Cart</button></div></div>"
        );
      })
      .join("");

    gridEl.querySelectorAll("[data-action='add-to-cart']").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var card = event.currentTarget.closest("[data-product-id]");
        var productId = card ? card.getAttribute("data-product-id") : "";
        addToCart(productId, 1).catch(function (error) {
          showMessage(error.message, "error");
        });
      });
    });

    gridEl.querySelectorAll("[data-action='wishlist']").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!getToken()) {
          showMessage("Please sign in to save wishlist items", "error");
          window.location.href = "../auth/sign-in.html";
          return;
        }

        var card = event.currentTarget.closest("[data-product-id]");
        var productId = card ? card.getAttribute("data-product-id") : "";
        api("/wishlist/add", {
          method: "POST",
          body: JSON.stringify({ productId: productId }),
        })
          .then(function () {
            showMessage("Saved to wishlist", "success");
          })
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    });

    gridEl.querySelectorAll("[data-product-id]").forEach(function (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-product-id");
        window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(id);
      });
    });
  }

  function loadSearch() {
    var query = inputEl ? inputEl.value.trim() : "";
    api("/search?q=" + encodeURIComponent(query))
      .then(function (data) {
        render(query, data.products || []);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadSearch();
      }
    });
  }

  if (sortEl) {
    sortEl.addEventListener("change", loadSearch);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (inputEl) {
        inputEl.value = "";
      }
      if (sortEl) {
        sortEl.value = "Relevance";
      }
      loadSearch();
    });
  }

  loadSearch();
}

export function wireHomePage() {
  var categoriesGridEl = document.getElementById("home-categories-grid");
  var featuredGridEl = document.getElementById("home-featured-products-grid");
  var auctionsGridEl = document.getElementById("home-live-auctions-grid");
  if (!categoriesGridEl && !featuredGridEl && !auctionsGridEl) {
    return;
  }

  Promise.all([api("/products?page=1&pageSize=24"), api("/auctions")])
    .then(function (results) {
      var products = results[0].items || [];
      var auctions = results[1].items || [];

      if (categoriesGridEl) {
        var categoryMap = {};
        products.forEach(function (product) {
          var name = (product.category && product.category.name) || "Craft";
          categoryMap[name] = (categoryMap[name] || 0) + 1;
        });
        var categories = Object.keys(categoryMap)
          .map(function (name) {
            return { name: name, count: categoryMap[name] };
          })
          .sort(function (a, b) {
            return b.count - a.count;
          })
          .slice(0, 6);

        if (categories.length) {
          categoriesGridEl.innerHTML = categories
            .map(function (entry) {
              return (
                "<a class=\"group bg-surface-container-lowest p-8 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:-translate-y-1\" href=\"../products/product-browsing.html\">" +
                "<div class=\"w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4 group-hover:bg-primary-fixed transition-colors\">" +
                "<span class=\"material-symbols-outlined text-3xl text-primary\">category</span></div>" +
                "<span class=\"font-label text-xs uppercase tracking-wider font-semibold text-on-surface\">" +
                escapeHtml(entry.name) +
                "</span><span class=\"text-[10px] text-secondary mt-1\">" +
                String(entry.count) +
                " items</span></a>"
              );
            })
            .join("");
        }
      }

      if (featuredGridEl) {
        var featured = products.slice(0, 4);
        if (!featured.length) {
          featuredGridEl.innerHTML = "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-6\">No featured products available.</div>";
        } else {
          featuredGridEl.innerHTML = featured
            .map(function (item) {
              var image = item.imageUrls && item.imageUrls[0] ? item.imageUrls[0] : "https://via.placeholder.com/800x1000?text=Product";
              return (
                "<div class=\"group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500\" data-product-id=\"" +
                item.id +
                "\"><div class=\"relative h-80 overflow-hidden\"><img class=\"w-full h-full object-cover transition-transform duration-700 group-hover:scale-110\" src=\"" +
                image +
                "\" alt=\"" +
                escapeHtml(item.name) +
                "\"/></div><div class=\"p-6\"><h3 class=\"font-headline text-lg mb-1\">" +
                escapeHtml(item.name) +
                "</h3><p class=\"text-secondary text-sm mb-3\">" +
                money(item.price) +
                "</p><button class=\"w-full bg-surface-container-high text-on-surface py-3 rounded-lg font-bold hover:bg-primary-container hover:text-on-primary-container transition-all\" data-action=\"add-to-cart\">Add to Cart</button></div></div>"
              );
            })
            .join("");

          featuredGridEl.querySelectorAll("[data-action='add-to-cart']").forEach(function (button) {
            button.addEventListener("click", function (event) {
              event.preventDefault();
              event.stopPropagation();
              var card = event.currentTarget.closest("[data-product-id]");
              var productId = card ? card.getAttribute("data-product-id") : "";
              addToCart(productId, 1).catch(function (error) {
                showMessage(error.message, "error");
              });
            });
          });
        }
      }

      if (auctionsGridEl) {
        var topAuctions = auctions.slice(0, 3);
        if (!topAuctions.length) {
          auctionsGridEl.innerHTML = "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-6\">No live auctions right now.</div>";
        } else {
          auctionsGridEl.innerHTML = topAuctions
            .map(function (auction) {
              var image = auction.product && auction.product.imageUrls && auction.product.imageUrls[0] ? auction.product.imageUrls[0] : "https://via.placeholder.com/800x1000?text=Auction";
              return (
                "<a href=\"../auctions/auction-detail.html?id=" +
                encodeURIComponent(auction.id) +
                "\" class=\"bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all\">" +
                "<div class=\"h-60 overflow-hidden\"><img class=\"w-full h-full object-cover\" src=\"" +
                image +
                "\" alt=\"" +
                escapeHtml((auction.product && auction.product.name) || "Auction") +
                "\"/></div>" +
                "<div class=\"p-5\"><p class=\"text-xs uppercase tracking-widest text-secondary mb-2\">Live Auction</p><h3 class=\"font-headline text-xl font-bold mb-2\">" +
                escapeHtml((auction.product && auction.product.name) || "Auction") +
                "</h3><p class=\"text-sm text-secondary\">Current Bid: " +
                money(auction.currentBid) +
                "</p></div></a>"
              );
            })
            .join("");
        }
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

export function wireArtisanProfilePage() {
  var gridEl = document.getElementById("artisan-profile-products-grid");
  if (!gridEl) {
    return;
  }

  var nameEl = document.getElementById("artisan-profile-name");
  var subtitleEl = document.getElementById("artisan-profile-subtitle");
  var bioEl = document.getElementById("artisan-profile-bio");
  var productCountEl = document.getElementById("artisan-profile-product-count");
  var salesCountEl = document.getElementById("artisan-profile-sales-count");
  var ratingEl = document.getElementById("artisan-profile-rating");

  var params = new URLSearchParams(window.location.search);
  var artisanId = params.get("id") || "";
  if (!artisanId) {
    try {
      var me = JSON.parse(localStorage.getItem("craftify_user") || "{}");
      artisanId = me.id || "";
    } catch (_error) {
      artisanId = "";
    }
  }

  if (!artisanId) {
    return;
  }

  api("/artisans/" + encodeURIComponent(artisanId))
    .then(function (data) {
      var artisan = data.artisan || {};
      var products = artisan.products || [];

      if (nameEl) {
        nameEl.textContent = artisan.artisanProfile && artisan.artisanProfile.shopName ? artisan.artisanProfile.shopName : artisan.fullName || "Artisan";
      }
      if (subtitleEl) {
        subtitleEl.textContent = (artisan.fullName || "Artisan") + " · " + ((artisan.artisanProfile && artisan.artisanProfile.location) || "");
      }
      if (bioEl) {
        bioEl.textContent = artisan.bio || "Artisan bio is not available yet.";
      }
      if (productCountEl) {
        productCountEl.textContent = String(products.length);
      }
      if (salesCountEl) {
        salesCountEl.textContent = "-";
      }

      var reviewCount = 0;
      var ratingSum = 0;
      products.forEach(function (product) {
        if (Array.isArray(product.reviews)) {
          product.reviews.forEach(function (review) {
            reviewCount += 1;
            ratingSum += Number(review.rating || 0);
          });
        }
      });
      if (ratingEl) {
        ratingEl.textContent = reviewCount ? (ratingSum / reviewCount).toFixed(1) : "0.0";
      }

      if (!products.length) {
        gridEl.innerHTML = "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-6\">No artisan products available.</div>";
        return;
      }

      gridEl.innerHTML = products
        .slice(0, 9)
        .map(function (product) {
          var image = product.imageUrls && product.imageUrls[0] ? product.imageUrls[0] : "https://via.placeholder.com/600?text=Product";
          return (
            "<div class=\"group bg-surface-container-lowest p-5 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300\" data-product-id=\"" +
            product.id +
            "\"><div class=\"aspect-square rounded-2xl overflow-hidden mb-6 relative\"><img class=\"w-full h-full object-cover group-hover:scale-110 transition-transform duration-500\" src=\"" +
            image +
            "\" alt=\"" +
            escapeHtml(product.name) +
            "\"/></div><div class=\"flex justify-between items-start mb-2\"><h3 class=\"font-headline text-xl font-bold\">" +
            escapeHtml(product.name) +
            "</h3><span class=\"font-headline font-bold text-primary text-lg\">" +
            money(product.price) +
            "</span></div><button class=\"w-full py-3 bg-surface-container-low hover:bg-primary-container hover:text-on-primary-container text-on-surface font-bold rounded-xl transition-colors\" data-action=\"add-to-cart\">Add to Cart</button></div>"
          );
        })
        .join("");

      gridEl.querySelectorAll("[data-action='add-to-cart']").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var card = event.currentTarget.closest("[data-product-id]");
          var productId = card ? card.getAttribute("data-product-id") : "";
          addToCart(productId, 1).catch(function (error) {
            showMessage(error.message, "error");
          });
        });
      });

      gridEl.querySelectorAll("[data-product-id]").forEach(function (card) {
        card.style.cursor = "pointer";
        card.addEventListener("click", function () {
          var productId = card.getAttribute("data-product-id");
          window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(productId);
        });
      });
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

