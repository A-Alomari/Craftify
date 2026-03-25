import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_user") || "";
}

export function wireArtisanRegistrationSteps() {
  var draftKey = "craftify_artisan_registration_draft";

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "{}");
    } catch (_error) {
      return {};
    }
  }

  function writeDraft(nextData) {
    localStorage.setItem(draftKey, JSON.stringify({ ...readDraft(), ...nextData }));
  }

  function wireStep1() {
    var formEl = document.getElementById("artisan-step-1-form");
    if (!formEl) {
      return;
    }

    var fullNameEl = document.getElementById("artisan-full-name-input");
    var phoneEl = document.getElementById("artisan-phone-input");
    var emailEl = document.getElementById("artisan-email-input");
    var passwordEl = document.getElementById("artisan-password-input");
    var confirmPasswordEl = document.getElementById("artisan-confirm-password-input");
    var draft = readDraft();

    if (fullNameEl) {
      fullNameEl.value = draft.fullName || "";
    }
    if (phoneEl) {
      phoneEl.value = draft.phone || "";
    }
    if (emailEl) {
      emailEl.value = draft.email || "";
    }
    if (passwordEl) {
      passwordEl.value = draft.password || "";
    }
    if (confirmPasswordEl) {
      confirmPasswordEl.value = draft.confirmPassword || "";
    }

    formEl.addEventListener("submit", function (event) {
      event.preventDefault();

      var payload = {
        fullName: fullNameEl ? fullNameEl.value.trim() : "",
        phone: phoneEl ? phoneEl.value.trim() : "",
        email: emailEl ? emailEl.value.trim() : "",
        password: passwordEl ? passwordEl.value : "",
        confirmPassword: confirmPasswordEl ? confirmPasswordEl.value : "",
      };

      if (!payload.fullName || payload.fullName.length < 2) {
        showMessage("Enter a valid full name", "error");
        return;
      }
      if (!payload.email || payload.email.indexOf("@") < 1) {
        showMessage("Enter a valid email", "error");
        return;
      }
      if (!payload.password || payload.password.length < 8) {
        showMessage("Password must be at least 8 characters", "error");
        return;
      }
      if (payload.password !== payload.confirmPassword) {
        showMessage("Passwords do not match", "error");
        return;
      }

      writeDraft(payload);
      window.location.href = "./artisan-registration-step-2.html";
    });
  }

  function wireStep2() {
    var formEl = document.getElementById("artisan-step-2-form");
    if (!formEl) {
      return;
    }

    var shopNameEl = document.getElementById("artisan-shop-name-input");
    var categoryEl = document.getElementById("artisan-category-select");
    var bioEl = document.getElementById("artisan-bio-input");
    var locationEl = document.getElementById("artisan-location-input");
    var backBtn = document.getElementById("artisan-step-2-back-btn");
    var draft = readDraft();

    if (shopNameEl) {
      shopNameEl.value = draft.shopName || "";
    }
    if (categoryEl) {
      categoryEl.value = draft.category || "Select a craft...";
    }
    if (bioEl) {
      bioEl.value = draft.bio || "";
    }
    if (locationEl) {
      locationEl.value = draft.location || "";
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        window.location.href = "./artisan-registration-step-1.html";
      });
    }

    formEl.addEventListener("submit", function (event) {
      event.preventDefault();

      var payload = {
        shopName: shopNameEl ? shopNameEl.value.trim() : "",
        category: categoryEl ? categoryEl.value : "",
        bio: bioEl ? bioEl.value.trim() : "",
        location: locationEl ? locationEl.value.trim() : "",
      };

      if (!payload.shopName || payload.shopName.length < 2) {
        showMessage("Enter a valid shop name", "error");
        return;
      }

      writeDraft(payload);
      window.location.href = "./artisan-registration-step-3.html";
    });
  }

  function wireStep3() {
    var submitBtn = document.getElementById("artisan-step-3-submit-btn");
    if (!submitBtn) {
      return;
    }

    var backBtn = document.getElementById("artisan-step-3-back-btn");
    var termsEl = document.getElementById("artisan-confirm-terms-checkbox");
    var handmadeEl = document.getElementById("artisan-confirm-handmade-checkbox");

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        window.location.href = "./artisan-registration-step-2.html";
      });
    }

    submitBtn.addEventListener("click", function () {
      var draft = readDraft();

      if (!termsEl || !termsEl.checked || !handmadeEl || !handmadeEl.checked) {
        showMessage("Please confirm both declarations", "error");
        return;
      }

      if (!draft.shopName || draft.shopName.length < 2) {
        showMessage("Missing shop details. Please complete previous steps.", "error");
        window.location.href = "./artisan-registration-step-2.html";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";

      var pipeline = Promise.resolve();

      if (!getToken()) {
        if (!draft.fullName || !draft.email || !draft.password) {
          showMessage("Missing account details. Please complete step 1.", "error");
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          window.location.href = "./artisan-registration-step-1.html";
          return;
        }

        pipeline = pipeline.then(function () {
          return api("/auth/register", {
            method: "POST",
            body: JSON.stringify({
              fullName: draft.fullName,
              email: draft.email,
              password: draft.password,
              role: "BUYER",
            }),
          }).then(function (result) {
            localStorage.setItem("craftify_user", JSON.stringify(result.user));
          });
        });
      }

      pipeline
        .then(function () {
          return api("/users/me", {
            method: "PUT",
            body: JSON.stringify({
              fullName: draft.fullName,
              bio: draft.bio || undefined,
            }),
          });
        })
        .then(function () {
          return api("/artisan/register", {
            method: "POST",
            body: JSON.stringify({
              shopName: draft.shopName,
              location: draft.location || undefined,
            }),
          });
        })
        .then(function () {
          localStorage.removeItem(draftKey);
          showMessage("Application submitted successfully", "success");
          window.location.href = "./artisan-registration-success.html";
        })
        .catch(function (error) {
          showMessage(error.message, "error");
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
        });
    });
  }

  wireStep1();
  wireStep2();
  wireStep3();
}

