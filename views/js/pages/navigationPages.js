import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_access_token") || "";
}

export function wireNotificationNav() {
  var buttons = Array.from(document.querySelectorAll("[data-icon='notifications']"));
  if (!buttons.length) {
    return;
  }

  buttons.forEach(function (button) {
    var target = button.closest("button") || button;
    target.style.cursor = "pointer";
    if (target.hasAttribute("data-notification-nav-bound")) {
      return;
    }

    target.setAttribute("data-notification-nav-bound", "1");
    target.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = new URL("../user/notification-center.html", window.location.href).href;
    });
  });
}

export function wireGlobalNavigationAndFooter() {
  var user = {};
  try {
    user = JSON.parse(localStorage.getItem("craftify_user") || "{}");
  } catch (_error) {
    user = {};
  }

  var role = (user.role || "").toUpperCase();

  document.querySelectorAll("a").forEach(function (link) {
    var text = (link.textContent || "").trim().toLowerCase();
    if (!text) {
      return;
    }

    if (text === "home") {
      link.setAttribute("href", "../home/index.html");
    } else if (text === "auctions") {
      link.setAttribute("href", "../auctions/live-auctions.html");
    } else if (text === "dashboard") {
      if (role === "ADMIN") {
        link.setAttribute("href", "../admin/admin-panel.html");
      } else if (role === "ARTISAN") {
        link.setAttribute("href", "../seller/artisan-dashboard.html");
      } else {
        link.setAttribute("href", "../orders/order-history.html");
      }
    } else if (text === "admin") {
      if (role === "ADMIN") {
        link.setAttribute("href", "../admin/admin-panel.html");
      } else {
        link.style.display = "none";
      }
    } else if (text.indexOf("help center") >= 0) {
      link.setAttribute("href", "../help/faq.html");
    } else if (text.indexOf("contact us") >= 0) {
      link.setAttribute("href", "../help/contact-us.html");
    } else if (text.indexOf("privacy") >= 0) {
      link.setAttribute("href", "../info/privacy-policy.html");
    } else if (text.indexOf("terms") >= 0) {
      link.setAttribute("href", "../info/terms-of-service.html");
    } else if (text.indexOf("about") >= 0) {
      link.setAttribute("href", "../info/about-us.html");
    }
  });

  var accountIcons = Array.from(document.querySelectorAll("[data-icon='account_circle'], .material-symbols-outlined"))
    .filter(function (icon) {
      return (icon.textContent || "").trim() === "account_circle";
    })
    .map(function (icon) {
      return icon.closest("button") || icon;
    });

  accountIcons.forEach(function (node) {
    if (node.hasAttribute("data-account-nav-bound")) {
      return;
    }
    node.setAttribute("data-account-nav-bound", "1");
    node.style.cursor = "pointer";
    node.addEventListener("click", function (event) {
      event.preventDefault();
      if (!getToken()) {
        window.location.href = "../auth/sign-in.html";
        return;
      }
      window.location.href = "../user/profile-settings.html";
    });
  });

  ["shopping_cart", "gavel", "search"].forEach(function (iconName) {
    Array.from(document.querySelectorAll(".material-symbols-outlined")).forEach(function (icon) {
      if ((icon.textContent || "").trim() !== iconName) {
        return;
      }
      var target = icon.closest("button") || icon;
      if (target.hasAttribute("data-nav-bound-" + iconName)) {
        return;
      }
      target.setAttribute("data-nav-bound-" + iconName, "1");
      target.style.cursor = "pointer";
      target.addEventListener("click", function (event) {
        event.preventDefault();
        if (iconName === "shopping_cart") {
          window.location.href = "../shopping/shopping-cart.html";
        } else if (iconName === "gavel") {
          window.location.href = "../auctions/live-auctions.html";
        } else {
          window.location.href = "../products/search-results.html";
        }
      });
    });
  });

  if (getToken()) {
    api("/notifications")
      .then(function (data) {
        var unread = (data.items || []).filter(function (item) {
          return !item.readAt;
        }).length;
        Array.from(document.querySelectorAll(".material-symbols-outlined")).forEach(function (icon) {
          if ((icon.textContent || "").trim() !== "notifications") {
            return;
          }

          var host = icon.parentElement;
          if (!host) {
            return;
          }

          var badge = host.querySelector("[data-notification-count-badge]");
          if (!badge) {
            badge = document.createElement("span");
            badge.setAttribute("data-notification-count-badge", "1");
            badge.style.position = "absolute";
            badge.style.top = "2px";
            badge.style.right = "2px";
            badge.style.minWidth = "16px";
            badge.style.height = "16px";
            badge.style.borderRadius = "999px";
            badge.style.fontSize = "10px";
            badge.style.display = "none";
            badge.style.alignItems = "center";
            badge.style.justifyContent = "center";
            badge.style.background = "#dc2626";
            badge.style.color = "#ffffff";
            host.style.position = "relative";
            host.appendChild(badge);
          }

          if (unread > 0) {
            badge.style.display = "flex";
            badge.textContent = unread > 99 ? "99+" : String(unread);
          } else {
            badge.style.display = "none";
          }
        });
      })
      .catch(function () {
        // no-op
      });
  }

  document.querySelectorAll("form").forEach(function (form) {
    var hasEmailInput = !!form.querySelector("input[type='email']");
    var hasOnlyEmail = hasEmailInput && !form.querySelector("textarea");
    if (!hasOnlyEmail) {
      return;
    }
    if (form.hasAttribute("data-newsletter-bound")) {
      return;
    }
    form.setAttribute("data-newsletter-bound", "1");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showMessage("Thanks for subscribing", "success");
      form.reset();
    });
  });
}
