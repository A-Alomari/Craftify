import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_user") || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseImageUrls(raw) {
  return String(raw || "")
    .split(/\n|,/)
    .map(function (item) {
      return item.trim();
    })
    .filter(function (item) {
      return /^https?:\/\//i.test(item);
    });
}

function ensureUploadPanel(textareaEl) {
  if (!textareaEl) {
    return null;
  }

  var existing = document.getElementById(textareaEl.id + "-upload-panel");
  if (existing) {
    return {
      input: existing.querySelector("input[type='file']"),
      button: existing.querySelector("button[data-action='upload-image']"),
      status: existing.querySelector("[data-upload-status]"),
    };
  }

  var panel = document.createElement("div");
  panel.id = textareaEl.id + "-upload-panel";
  panel.className = "mt-3 flex flex-col sm:flex-row sm:items-center gap-3";
  panel.innerHTML =
    "<input type=\"file\" accept=\"image/png,image/jpeg,image/webp,image/gif\" class=\"block w-full text-sm\"/>" +
    "<button type=\"button\" data-action=\"upload-image\" class=\"px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-bold text-xs uppercase tracking-wider\">Upload Image</button>" +
    "<span data-upload-status class=\"text-xs text-secondary\"></span>";

  textareaEl.parentElement.appendChild(panel);
  return {
    input: panel.querySelector("input[type='file']"),
    button: panel.querySelector("button[data-action='upload-image']"),
    status: panel.querySelector("[data-upload-status]"),
  };
}

function bindImageUploader(textareaEl) {
  var panel = ensureUploadPanel(textareaEl);
  if (!panel || !panel.input || !panel.button) {
    return;
  }

  panel.button.addEventListener("click", function () {
    var file = panel.input.files && panel.input.files[0] ? panel.input.files[0] : null;
    if (!file) {
      showMessage("Choose an image first", "error");
      return;
    }

    var form = new FormData();
    form.append("image", file);

    panel.button.disabled = true;
    if (panel.status) {
      panel.status.textContent = "Uploading...";
    }

    api("/products/upload", {
      method: "POST",
      body: form,
    })
      .then(function (data) {
        var imageUrl = data.file && data.file.imageUrl ? data.file.imageUrl : "";
        if (!imageUrl) {
          throw new Error("Upload succeeded but no URL was returned");
        }

        var current = textareaEl.value ? textareaEl.value.trim() : "";
        textareaEl.value = current ? current + "\n" + imageUrl : imageUrl;
        panel.input.value = "";
        if (panel.status) {
          panel.status.textContent = "Uploaded";
        }
        showMessage("Image uploaded", "success");
      })
      .catch(function (error) {
        if (panel.status) {
          panel.status.textContent = "Upload failed";
        }
        showMessage(error.message, "error");
      })
      .finally(function () {
        panel.button.disabled = false;
      });
  });
}

function discoverCategories() {
  return api("/products?page=1&pageSize=100")
    .then(function (data) {
      var map = {};
      (data.items || []).forEach(function (item) {
        if (item.category && item.category.id && item.category.name) {
          map[item.category.id] = item.category.name;
        }
      });
      return Object.keys(map).map(function (id) {
        return { id: id, name: map[id] };
      });
    })
    .catch(function () {
      return [];
    });
}

export function wireAddProductPage() {
  var primaryBtn = document.getElementById("add-product-publish-btn");
  var secondaryBtn = document.getElementById("add-product-publish-btn-secondary");
  if (!primaryBtn && !secondaryBtn) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan to add products", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var nameEl = document.getElementById("add-product-name-input");
  var categoryEl = document.getElementById("add-product-category-select");
  var descriptionEl = document.getElementById("add-product-description-input");
  var priceEl = document.getElementById("add-product-price-input");
  var stockEl = document.getElementById("add-product-stock-input");
  var imageUrlsEl = document.getElementById("add-product-image-urls-input");
  bindImageUploader(imageUrlsEl);

  function setBusy(busy) {
    [primaryBtn, secondaryBtn].forEach(function (btn) {
      if (!btn) {
        return;
      }
      btn.disabled = busy;
      btn.style.opacity = busy ? "0.7" : "1";
    });
  }

  function submitCreate() {
    var payload = {
      name: nameEl ? nameEl.value.trim() : "",
      categoryId: categoryEl ? categoryEl.value : "",
      description: descriptionEl ? descriptionEl.value.trim() : "",
      price: Number(priceEl ? priceEl.value : 0),
      stock: Number(stockEl ? stockEl.value : 0),
      imageUrls: parseImageUrls(imageUrlsEl ? imageUrlsEl.value : ""),
    };

    if (!payload.name || payload.name.length < 2) {
      showMessage("Product name must be at least 2 characters", "error");
      return;
    }
    if (!payload.categoryId) {
      showMessage("Select a category", "error");
      return;
    }
    if (!payload.description || payload.description.length < 8) {
      showMessage("Description must be at least 8 characters", "error");
      return;
    }
    if (!payload.price || payload.price <= 0) {
      showMessage("Enter a valid price", "error");
      return;
    }
    if (payload.stock < 0) {
      showMessage("Stock cannot be negative", "error");
      return;
    }
    if (!payload.imageUrls.length) {
      showMessage("Add at least one valid image URL", "error");
      return;
    }

    setBusy(true);
    api("/products", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(function (data) {
        showMessage("Product published", "success");
        window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(data.product.id);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      })
      .finally(function () {
        setBusy(false);
      });
  }

  [primaryBtn, secondaryBtn].forEach(function (btn) {
    if (!btn) {
      return;
    }
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      submitCreate();
    });
  });

  discoverCategories().then(function (categories) {
    if (!categoryEl || !categories.length) {
      return;
    }

    categoryEl.innerHTML =
      "<option value=\"\">Select category</option>" +
      categories
        .map(function (category) {
          return "<option value=\"" + category.id + "\">" + escapeHtml(category.name) + "</option>";
        })
        .join("");
  });
}

export function wireEditProductPage() {
  var saveBtn = document.getElementById("edit-product-save-btn");
  if (!saveBtn) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan to edit products", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var productId = params.get("id") || "";
  if (!productId) {
    showMessage("Missing product ID in URL", "error");
    return;
  }

  var nameEl = document.getElementById("edit-product-name-input");
  var categoryEl = document.getElementById("edit-product-category-select");
  var descriptionEl = document.getElementById("edit-product-description-input");
  var priceEl = document.getElementById("edit-product-price-input");
  var stockEl = document.getElementById("edit-product-stock-input");
  var imageUrlsEl = document.getElementById("edit-product-image-urls-input");
  bindImageUploader(imageUrlsEl);
  var deleteBtn = document.getElementById("edit-product-delete-btn");

  function loadProduct() {
    return api("/products/" + encodeURIComponent(productId))
      .then(function (data) {
        var product = data.product || {};
        if (nameEl) {
          nameEl.value = product.name || "";
        }
        if (descriptionEl) {
          descriptionEl.value = product.description || "";
        }
        if (priceEl) {
          priceEl.value = String(Number(product.price || 0));
        }
        if (stockEl) {
          stockEl.value = String(Number(product.stock || 0));
        }
        if (imageUrlsEl) {
          imageUrlsEl.value = (product.imageUrls || []).join("\n");
        }

        return discoverCategories().then(function (categories) {
          if (!categoryEl || !categories.length) {
            return;
          }

          categoryEl.innerHTML = categories
            .map(function (category) {
              var selected = product.categoryId === category.id ? " selected" : "";
              return "<option value=\"" + category.id + "\"" + selected + ">" + escapeHtml(category.name) + "</option>";
            })
            .join("");
        });
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  saveBtn.addEventListener("click", function (event) {
    event.preventDefault();

    var payload = {
      name: nameEl ? nameEl.value.trim() : "",
      categoryId: categoryEl ? categoryEl.value : "",
      description: descriptionEl ? descriptionEl.value.trim() : "",
      price: Number(priceEl ? priceEl.value : 0),
      stock: Number(stockEl ? stockEl.value : 0),
      imageUrls: parseImageUrls(imageUrlsEl ? imageUrlsEl.value : ""),
    };

    api("/products/" + encodeURIComponent(productId), {
      method: "PUT",
      body: JSON.stringify(payload),
    })
      .then(function () {
        showMessage("Product updated", "success");
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  });

  if (deleteBtn) {
    deleteBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!window.confirm("Delete this product permanently?")) {
        return;
      }

      api("/products/" + encodeURIComponent(productId), { method: "DELETE" })
        .then(function () {
          showMessage("Product deleted", "success");
          window.location.href = "../products/product-browsing.html";
        })
        .catch(function (error) {
          showMessage(error.message, "error");
        });
    });
  }

  loadProduct();
}

