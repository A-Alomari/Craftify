import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_access_token") || "";
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  var dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "-";
  }
  return dt.toLocaleString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusBadge(status) {
  var value = String(status || "PENDING").toUpperCase();
  var classes = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ";
  if (value === "DELIVERED") {
    classes += "bg-green-100 text-green-700";
  } else if (value === "SHIPPED") {
    classes += "bg-blue-100 text-blue-700";
  } else if (value === "PROCESSING") {
    classes += "bg-secondary-container text-on-secondary-container";
  } else if (value === "CANCELLED") {
    classes += "bg-error-container text-on-error-container";
  } else {
    classes += "bg-primary-container text-on-primary-container";
  }
  return "<span class=\"" + classes + "\">" + value + "</span>";
}

export function wireAdminPanelPage() {
  var bodyEl = document.getElementById("admin-panel-body");
  if (!bodyEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as admin", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var usersCountEl = document.getElementById("admin-panel-users-count");
  var productsCountEl = document.getElementById("admin-panel-products-count");
  var ordersCountEl = document.getElementById("admin-panel-orders-count");
  var revenueEl = document.getElementById("admin-panel-revenue");
  var searchEl = document.getElementById("admin-panel-search");
  var tabButtons = Array.from(document.querySelectorAll("[data-admin-tab]"));

  var activeTab = "users";
  var users = [];
  var products = [];
  var orders = [];

  function setActiveTab(tab) {
    activeTab = tab;
    tabButtons.forEach(function (button) {
      var selected = button.getAttribute("data-admin-tab") === tab;
      button.classList.toggle("text-primary", selected);
      button.classList.toggle("font-semibold", selected);
      button.classList.toggle("border-b-2", selected);
      button.classList.toggle("border-primary", selected);
      if (!selected) {
        button.classList.add("text-secondary");
      } else {
        button.classList.remove("text-secondary");
      }
    });
    render();
  }

  function currentRows() {
    if (activeTab === "products") {
      return products;
    }
    if (activeTab === "orders") {
      return orders;
    }
    return users;
  }

  function filteredRows() {
    var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    var rows = currentRows();
    if (!query) {
      return rows;
    }

    return rows.filter(function (row) {
      if (activeTab === "users") {
        return [row.fullName, row.email, row.role].join(" ").toLowerCase().indexOf(query) >= 0;
      }
      if (activeTab === "products") {
        return [row.name, row.category && row.category.name, row.artisan && row.artisan.fullName].join(" ").toLowerCase().indexOf(query) >= 0;
      }
      return [row.id, row.user && row.user.fullName, row.status].join(" ").toLowerCase().indexOf(query) >= 0;
    });
  }

  function renderUsers(rows) {
    if (!rows.length) {
      bodyEl.innerHTML = "<tr><td class=\"px-8 py-6 text-sm text-secondary\" colspan=\"5\">No users found.</td></tr>";
      return;
    }

    bodyEl.innerHTML = rows
      .map(function (user) {
        var initials = ((user.fullName || "U").match(/\b\w/g) || ["U"]).slice(0, 2).join("").toUpperCase();
        return (
          "<tr class=\"hover:bg-surface-container-low/30 transition-colors\">" +
          "<td class=\"px-8 py-6\"><div class=\"flex items-center gap-4\"><div class=\"w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold\">" +
          escapeHtml(initials) +
          "</div><span class=\"font-headline font-semibold text-on-surface\">" +
          escapeHtml(user.fullName || "User") +
          "</span></div></td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          escapeHtml(user.email || "") +
          "</td><td class=\"px-8 py-6\"><select class=\"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container-low\" data-user-role-id=\"" +
          user.id +
          "\"><option" +
          (user.role === "BUYER" ? " selected" : "") +
          ">BUYER</option><option" +
          (user.role === "ARTISAN" ? " selected" : "") +
          ">ARTISAN</option><option" +
          (user.role === "ADMIN" ? " selected" : "") +
          ">ADMIN</option></select></td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          formatDate(user.createdAt) +
          "</td><td class=\"px-8 py-6 text-right\"><button class=\"text-primary font-headline italic hover:underline underline-offset-4 font-medium transition-all\" data-action=\"save-user-role\" data-user-id=\"" +
          user.id +
          "\">Save</button></td></tr>"
        );
      })
      .join("");

    bodyEl.querySelectorAll("[data-action='save-user-role']").forEach(function (button) {
      button.addEventListener("click", function () {
        var userId = button.getAttribute("data-user-id");
        var select = bodyEl.querySelector("select[data-user-role-id='" + userId + "']");
        var role = select ? select.value : "BUYER";
        api("/admin/users/" + encodeURIComponent(userId), {
          method: "PUT",
          body: JSON.stringify({ role: role }),
        })
          .then(function () {
            users = users.map(function (item) {
              return item.id === userId ? { ...item, role: role } : item;
            });
            showMessage("User role updated", "success");
            render();
          })
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    });
  }

  function renderProducts(rows) {
    if (!rows.length) {
      bodyEl.innerHTML = "<tr><td class=\"px-8 py-6 text-sm text-secondary\" colspan=\"5\">No products found.</td></tr>";
      return;
    }

    bodyEl.innerHTML = rows
      .slice(0, 30)
      .map(function (item) {
        return (
          "<tr class=\"hover:bg-surface-container-low/30 transition-colors\"><td class=\"px-8 py-6\"><span class=\"font-headline font-semibold text-on-surface\">" +
          escapeHtml(item.name || "Product") +
          "</span></td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          escapeHtml((item.artisan && item.artisan.fullName) || "-") +
          "</td><td class=\"px-8 py-6\"><span class=\"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container\">" +
          escapeHtml((item.category && item.category.name) || "Craft") +
          "</span></td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          money(item.price || 0) +
          "</td><td class=\"px-8 py-6 text-right\"><a href=\"../products/product-detail.html?id=" +
          encodeURIComponent(item.id) +
          "\" class=\"text-primary font-headline italic hover:underline underline-offset-4 font-medium transition-all\">View</a></td></tr>"
        );
      })
      .join("");
  }

  function renderOrders(rows) {
    if (!rows.length) {
      bodyEl.innerHTML = "<tr><td class=\"px-8 py-6 text-sm text-secondary\" colspan=\"5\">No orders found.</td></tr>";
      return;
    }

    bodyEl.innerHTML = rows
      .slice(0, 30)
      .map(function (order) {
        return (
          "<tr class=\"hover:bg-surface-container-low/30 transition-colors\"><td class=\"px-8 py-6\"><span class=\"font-headline font-semibold text-on-surface\">#" +
          escapeHtml(order.id ? order.id.slice(-6).toUpperCase() : "-") +
          "</span></td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          escapeHtml((order.user && order.user.email) || "") +
          "</td><td class=\"px-8 py-6\">" +
          statusBadge(order.status || "PENDING") +
          "</td><td class=\"px-8 py-6 font-body text-sm text-secondary\">" +
          formatDate(order.createdAt) +
          "</td><td class=\"px-8 py-6 text-right\"><a href=\"../orders/order-tracking.html?id=" +
          encodeURIComponent(order.id || "") +
          "\" class=\"text-primary font-headline italic hover:underline underline-offset-4 font-medium transition-all\">Open</a></td></tr>"
        );
      })
      .join("");
  }

  function render() {
    var rows = filteredRows();
    if (activeTab === "products") {
      renderProducts(rows);
    } else if (activeTab === "orders") {
      renderOrders(rows);
    } else {
      renderUsers(rows);
    }
  }

  Promise.all([api("/admin/dashboard"), api("/admin/users"), api("/admin/orders"), api("/products?page=1&pageSize=100")])
    .then(function (results) {
      var stats = results[0].stats || {};
      users = results[1].items || [];
      orders = results[2].items || [];
      products = results[3].items || [];

      if (usersCountEl) {
        usersCountEl.textContent = String(stats.users || users.length || 0);
      }
      if (productsCountEl) {
        productsCountEl.textContent = String(stats.products || products.length || 0);
      }
      if (ordersCountEl) {
        ordersCountEl.textContent = String(stats.orders || orders.length || 0);
      }
      if (revenueEl) {
        revenueEl.textContent = money(stats.revenue || 0);
      }

      setActiveTab("users");
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });

  tabButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setActiveTab(button.getAttribute("data-admin-tab") || "users");
    });
  });

  if (searchEl) {
    searchEl.addEventListener("input", render);
  }
}
