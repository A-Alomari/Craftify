import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_user") || "";
}

export function wireReviewSubmissionPage() {
  var formEl = document.getElementById("review-form");
  if (!formEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in to submit a review", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var nameEl = document.getElementById("review-product-name");
  var artisanEl = document.getElementById("review-product-artisan");
  var ratingLabelEl = document.getElementById("review-rating-label");
  var titleInput = document.getElementById("review-title-input");
  var bodyInput = document.getElementById("review-body-input");
  var confirmInput = document.getElementById("review-confirm-checkbox");
  var stars = Array.from(document.querySelectorAll("[data-review-star]"));

  var params = new URLSearchParams(window.location.search);
  var productId = params.get("productId") || "";
  var rating = 4;

  function ratingText(value) {
    if (value >= 5) {
      return "Excellent";
    }
    if (value === 4) {
      return "Very Good";
    }
    if (value === 3) {
      return "Good";
    }
    if (value === 2) {
      return "Fair";
    }
    return "Poor";
  }

  function paintStars(value) {
    stars.forEach(function (starEl) {
      var starValue = Number(starEl.getAttribute("data-review-star") || "0");
      if (starValue <= value) {
        starEl.style.fontVariationSettings = "'FILL' 1";
      } else {
        starEl.style.fontVariationSettings = "'FILL' 0";
      }
    });
    if (ratingLabelEl) {
      ratingLabelEl.textContent = ratingText(value);
    }
  }

  paintStars(rating);

  stars.forEach(function (starEl) {
    starEl.addEventListener("click", function () {
      rating = Number(starEl.getAttribute("data-review-star") || "4");
      paintStars(rating);
    });
  });

  function loadProductContext(id) {
    if (!id) {
      return Promise.resolve();
    }

    return api("/products/" + encodeURIComponent(id))
      .then(function (data) {
        var product = data.product;
        if (nameEl) {
          nameEl.textContent = product.name;
        }
        if (artisanEl) {
          artisanEl.textContent = "by " + (product.artisan && product.artisan.fullName ? product.artisan.fullName : "Artisan");
        }
      })
      .catch(function () {
        // keep static fallback data
      });
  }

  var loadPromise;
  if (productId) {
    loadPromise = loadProductContext(productId);
  } else {
    loadPromise = api("/products?page=1&pageSize=1")
      .then(function (data) {
        if (data.items && data.items[0]) {
          productId = data.items[0].id;
          if (nameEl) {
            nameEl.textContent = data.items[0].name;
          }
        }
      })
      .catch(function () {
        // no-op
      });
  }

  loadPromise.finally(function () {
    formEl.addEventListener("submit", function (event) {
      event.preventDefault();

      var title = titleInput ? titleInput.value.trim() : "";
      var body = bodyInput ? bodyInput.value.trim() : "";

      if (!productId) {
        showMessage("Missing product information for review", "error");
        return;
      }

      if (!confirmInput || !confirmInput.checked) {
        showMessage("Please confirm your review is genuine", "error");
        return;
      }

      if (body.length < 10) {
        showMessage("Review text must be at least 10 characters", "error");
        return;
      }

      api("/reviews", {
        method: "POST",
        body: JSON.stringify({
          productId: productId,
          rating: rating,
          title: title || undefined,
          body: body,
        }),
      })
        .then(function () {
          showMessage("Review submitted successfully", "success");
          window.location.href = "../products/product-detail.html?id=" + encodeURIComponent(productId);
        })
        .catch(function (error) {
          showMessage(error.message, "error");
        });
    });
  });
}

