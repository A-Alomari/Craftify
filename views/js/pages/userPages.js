import { API_BASE, apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");

function getToken() {
  return localStorage.getItem("craftify_access_token") || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function wireNotificationCenterPage() {
  var listEl = document.getElementById("notification-list");
  if (!listEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in to view notifications", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var unreadCountEl = document.getElementById("notification-unread-count");
  var markAllBtn = document.getElementById("notification-mark-all-btn");
  var filterButtons = Array.from(document.querySelectorAll("[data-notification-filter]"));
  var currentFilter = "all";
  var items = [];
  var socket = null;

  function inferType(notification) {
    var text = ((notification.title || "") + " " + (notification.body || "")).toLowerCase();
    if (text.indexOf("order") >= 0 || text.indexOf("ship") >= 0 || text.indexOf("deliver") >= 0) {
      return "orders";
    }
    if (text.indexOf("bid") >= 0 || text.indexOf("auction") >= 0 || text.indexOf("won") >= 0) {
      return "auctions";
    }
    if (text.indexOf("message") >= 0 || text.indexOf("chat") >= 0) {
      return "messages";
    }
    return "other";
  }

  function iconForType(type) {
    if (type === "orders") {
      return "local_shipping";
    }
    if (type === "auctions") {
      return "gavel";
    }
    if (type === "messages") {
      return "chat";
    }
    return "notifications";
  }

  function relativeTime(value) {
    var created = new Date(value).getTime();
    if (Number.isNaN(created)) {
      return "Now";
    }

    var seconds = Math.floor((Date.now() - created) / 1000);
    if (seconds < 60) {
      return "Just now";
    }
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes + "m ago";
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours + "h ago";
    }
    var days = Math.floor(hours / 24);
    return days + "d ago";
  }

  function setActiveFilter(nextFilter) {
    currentFilter = nextFilter;
    filterButtons.forEach(function (button) {
      var selected = button.getAttribute("data-notification-filter") === nextFilter;
      if (selected) {
        button.classList.add("bg-primary-container", "text-on-primary-container");
        button.classList.remove("bg-surface-container-low", "text-on-secondary-container");
      } else {
        button.classList.remove("bg-primary-container", "text-on-primary-container");
        button.classList.add("bg-surface-container-low", "text-on-secondary-container");
      }
    });
    render();
  }

  function filteredItems() {
    if (currentFilter === "all") {
      return items;
    }
    return items.filter(function (item) {
      return inferType(item) === currentFilter;
    });
  }

  function render() {
    var unreadCount = items.filter(function (item) {
      return !item.readAt;
    }).length;

    if (unreadCountEl) {
      unreadCountEl.textContent = String(unreadCount);
    }

    var visible = filteredItems();
    if (!visible.length) {
      listEl.innerHTML =
        "<div class=\"bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/15\">" +
        "<h3 class=\"text-xl font-bold mb-2\">No notifications</h3>" +
        "<p class=\"text-on-surface-variant\">You're all caught up for this filter.</p></div>";
      return;
    }

    listEl.innerHTML = visible
      .map(function (item) {
        var type = inferType(item);
        var isUnread = !item.readAt;
        var wrapperClasses = isUnread
          ? "group relative bg-[#FFF7ED] p-6 rounded-xl border-l-4 border-primary transition-all hover:scale-[1.01] hover:shadow-[0px_20px_40px_rgba(25,28,30,0.06)]"
          : "group relative bg-surface-container-lowest p-6 rounded-xl border-l-4 border-transparent transition-all hover:bg-surface-container-low";

        return (
          "<article class=\"" +
          wrapperClasses +
          "\" data-notification-id=\"" +
          item.id +
          "\">" +
          "<div class=\"flex gap-5\">" +
          "<div class=\"w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center shrink-0\">" +
          "<span class=\"material-symbols-outlined text-primary\">" +
          iconForType(type) +
          "</span></div>" +
          "<div class=\"flex-grow\"><div class=\"flex justify-between items-start mb-1 gap-4\">" +
          "<h3 class=\"font-headline text-lg font-bold text-on-surface\">" +
          escapeHtml(item.title || "Notification") +
          "</h3><span class=\"text-xs font-medium text-on-secondary-container/60 whitespace-nowrap\">" +
          relativeTime(item.createdAt) +
          "</span></div>" +
          "<p class=\"text-on-surface-variant mb-4 leading-relaxed\">" +
          escapeHtml(item.body || "") +
          "</p>" +
          (isUnread
            ? "<button class=\"px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all\" data-action=\"mark-read\">Mark as Read</button>"
            : "<span class=\"text-xs text-secondary uppercase tracking-widest\">Read</span>") +
          "</div></div>" +
          (isUnread ? "<div class=\"absolute top-6 right-6 w-2 h-2 rounded-full bg-primary-container animate-pulse\"></div>" : "") +
          "</article>"
        );
      })
      .join("");

    listEl.querySelectorAll("[data-action='mark-read']").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        var card = event.currentTarget.closest("[data-notification-id]");
        var id = card ? card.getAttribute("data-notification-id") : "";
        api("/notifications/" + encodeURIComponent(id) + "/read", { method: "PUT" })
          .then(function () {
            items = items.map(function (item) {
              if (item.id === id) {
                return { ...item, readAt: new Date().toISOString() };
              }
              return item;
            });
            render();
          })
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    });
  }

  function loadNotifications() {
    return api("/notifications")
      .then(function (data) {
        items = data.items || [];
        render();
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener("click", function (event) {
      event.preventDefault();
      var unread = items.filter(function (item) {
        return !item.readAt;
      });
      if (!unread.length) {
        return;
      }

      Promise.allSettled(
        unread.map(function (item) {
          return api("/notifications/" + encodeURIComponent(item.id) + "/read", { method: "PUT" });
        }),
      ).then(function () {
        loadNotifications().then(function () {
          showMessage("Notifications marked as read", "success");
        });
      });
    });
  }

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setActiveFilter(button.getAttribute("data-notification-filter") || "all");
    });
  });

  if (typeof window.io === "function") {
    var currentUser = {};
    try {
      currentUser = JSON.parse(localStorage.getItem("craftify_user") || "{}");
    } catch (_error) {
      currentUser = {};
    }

    socket = window.io(SOCKET_BASE);
    if (currentUser.id) {
      socket.emit("join:user", currentUser.id);
    }
    socket.on("notification:new", function () {
      loadNotifications();
    });
  }

  setActiveFilter("all");
  loadNotifications();
}

export function wireUserProfileSettingsPage() {
  var formEl = document.getElementById("profile-settings-form");
  if (!formEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in to manage your profile", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var fullNameEl = document.getElementById("profile-full-name-input");
  var emailEl = document.getElementById("profile-email-input");
  var roleEl = document.getElementById("profile-role-input");
  var avatarEl = document.getElementById("profile-avatar-url-input");
  var bioEl = document.getElementById("profile-bio-input");
  var saveBtn = document.getElementById("profile-save-btn");

  function setSaving(saving) {
    if (!saveBtn) {
      return;
    }
    saveBtn.disabled = saving;
    saveBtn.textContent = saving ? "Saving..." : "Save Changes";
    saveBtn.style.opacity = saving ? "0.7" : "1";
    saveBtn.style.cursor = saving ? "not-allowed" : "pointer";
  }

  function applyUser(user) {
    if (!user) {
      return;
    }
    if (fullNameEl) {
      fullNameEl.value = user.fullName || "";
    }
    if (emailEl) {
      emailEl.value = user.email || "";
    }
    if (roleEl) {
      roleEl.value = user.role || "";
    }
    if (avatarEl) {
      avatarEl.value = user.avatarUrl || "";
    }
    if (bioEl) {
      bioEl.value = user.bio || "";
    }
  }

  function loadProfile() {
    return api("/users/me")
      .then(function (data) {
        applyUser(data.user || {});
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  }

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();

    var payload = {
      fullName: fullNameEl ? fullNameEl.value.trim() : "",
      avatarUrl: avatarEl ? avatarEl.value.trim() : "",
      bio: bioEl ? bioEl.value.trim() : "",
    };

    if (!payload.fullName || payload.fullName.length < 2) {
      showMessage("Full name must be at least 2 characters", "error");
      return;
    }

    if (!payload.avatarUrl) {
      delete payload.avatarUrl;
    }

    if (!payload.bio) {
      delete payload.bio;
    }

    setSaving(true);
    api("/users/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    })
      .then(function (data) {
        var user = data.user || {};
        localStorage.setItem("craftify_user", JSON.stringify(user));
        applyUser(user);
        showMessage("Profile updated", "success");
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      })
      .finally(function () {
        setSaving(false);
      });
  });

  loadProfile();
}
