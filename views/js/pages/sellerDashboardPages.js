import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function getToken() {
  return localStorage.getItem("craftify_user") || "";
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

export function wireArtisanDashboardPage() {
  var productsBodyEl = document.getElementById("artisan-dashboard-products-body");
  if (!productsBodyEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var revenueEl = document.getElementById("artisan-dashboard-revenue");
  var productCountEl = document.getElementById("artisan-dashboard-product-count");
  var ordersCountEl = document.getElementById("artisan-dashboard-orders-count");
  var ordersBodyEl = document.getElementById("artisan-dashboard-orders-body");
  var addProductBtn = document.getElementById("artisan-dashboard-add-product-btn");

  if (addProductBtn) {
    addProductBtn.addEventListener("click", function () {
      window.location.href = "../products/add-product.html";
    });
  }

  var currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem("craftify_user") || "{}");
  } catch (_error) {
    currentUser = {};
  }

  Promise.all([api("/artisan/dashboard"), api("/artisan/analytics"), api("/products?page=1&pageSize=100"), api("/artisan/orders")])
    .then(function (results) {
      var dashboard = results[0].stats || {};
      var analytics = results[1].analytics || {};
      var products = (results[2].items || []).filter(function (item) {
        return item.artisan && item.artisan.id === currentUser.id;
      });
      var orderItems = results[3].items || [];

      if (revenueEl) {
        revenueEl.textContent = money(analytics.grossSales || 0);
      }
      if (productCountEl) {
        productCountEl.textContent = String(dashboard.productCount || products.length || 0);
      }
      if (ordersCountEl) {
        ordersCountEl.textContent = String(dashboard.ordersCount || orderItems.length || 0);
      }

      if (productsBodyEl) {
        if (!products.length) {
          productsBodyEl.innerHTML = "<tr><td class=\"px-8 py-6 text-sm text-secondary\" colspan=\"6\">No products yet.</td></tr>";
        } else {
          productsBodyEl.innerHTML = products
            .slice(0, 8)
            .map(function (product) {
              var image = product.imageUrls && product.imageUrls[0] ? product.imageUrls[0] : "https://via.placeholder.com/80?text=Product";
              return (
                "<tr class=\"hover:bg-surface/50 transition-colors\">" +
                "<td class=\"px-8 py-4 flex items-center gap-4\"><div class=\"w-12 h-12 rounded-lg overflow-hidden shrink-0\"><img class=\"w-full h-full object-cover\" src=\"" +
                image +
                "\" alt=\"" +
                escapeHtml(product.name) +
                "\"/></div><span class=\"font-medium text-on-surface\">" +
                escapeHtml(product.name) +
                "</span></td>" +
                "<td class=\"px-4 py-4 text-secondary text-sm\">" +
                escapeHtml((product.category && product.category.name) || "Craft") +
                "</td>" +
                "<td class=\"px-4 py-4 font-serif font-bold\">" +
                money(product.price) +
                "</td>" +
                "<td class=\"px-4 py-4 text-secondary\">" +
                String(product.stock || 0) +
                "</td>" +
                "<td class=\"px-4 py-4\">" +
                statusBadge(product.status || "ACTIVE") +
                "</td>" +
                "<td class=\"px-8 py-4 text-right\"><a href=\"../products/edit-product.html?id=" +
                encodeURIComponent(product.id) +
                "\" class=\"text-xs font-bold bg-surface-container text-on-surface px-4 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all\">Edit</a></td></tr>"
              );
            })
            .join("");
        }
      }

      if (ordersBodyEl) {
        if (!orderItems.length) {
          ordersBodyEl.innerHTML = "<tr><td class=\"px-8 py-6 text-sm text-secondary\" colspan=\"7\">No artisan orders yet.</td></tr>";
        } else {
          ordersBodyEl.innerHTML = orderItems
            .slice(0, 8)
            .map(function (item) {
              var order = item.order || {};
              return (
                "<tr class=\"hover:bg-surface/50 transition-colors\">" +
                "<td class=\"px-8 py-4 font-mono text-sm text-secondary\">" +
                escapeHtml(order.id ? "#" + order.id.slice(-6).toUpperCase() : "-") +
                "</td><td class=\"px-4 py-4 font-medium\">" +
                escapeHtml(order.shippingName || "Customer") +
                "</td><td class=\"px-4 py-4 text-secondary text-sm\">" +
                escapeHtml((item.product && item.product.name) || "Product") +
                "</td><td class=\"px-4 py-4 text-secondary text-sm\">" +
                formatDate(order.createdAt) +
                "</td><td class=\"px-4 py-4\">" +
                statusBadge(order.status || "PENDING") +
                "</td><td class=\"px-4 py-4 font-serif font-bold\">" +
                money(item.unitPrice * item.quantity) +
                "</td><td class=\"px-8 py-4 text-right\"><a class=\"text-xs font-bold bg-surface-container text-on-surface px-4 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all\" href=\"../orders/order-tracking.html?id=" +
                encodeURIComponent(order.id || "") +
                "\">View</a></td></tr>"
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

export function wireArtisanManageOrdersPage() {
  var bodyEl = document.getElementById("artisan-manage-orders-body");
  if (!bodyEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var searchEl = document.getElementById("artisan-manage-orders-search");
  var sortEl = document.getElementById("artisan-manage-orders-sort");
  var newEl = document.getElementById("artisan-manage-orders-new");
  var processingEl = document.getElementById("artisan-manage-orders-processing");
  var shippedEl = document.getElementById("artisan-manage-orders-shipped");
  var deliveredEl = document.getElementById("artisan-manage-orders-delivered");

  var orderItems = [];

  function render() {
    var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    var rows = orderItems.slice();

    if (query) {
      rows = rows.filter(function (item) {
        var order = item.order || {};
        var bag = [order.id, order.shippingName, item.product && item.product.name].join(" ").toLowerCase();
        return bag.indexOf(query) >= 0;
      });
    }

    if (sortEl && sortEl.value === "Oldest First") {
      rows.sort(function (a, b) {
        return new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime();
      });
    } else if (sortEl && sortEl.value === "Highest Value") {
      rows.sort(function (a, b) {
        return b.unitPrice * b.quantity - a.unitPrice * a.quantity;
      });
    } else {
      rows.sort(function (a, b) {
        return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
      });
    }

    if (!rows.length) {
      bodyEl.innerHTML = "<tr><td class=\"px-6 py-8 text-sm text-secondary\" colspan=\"8\">No orders found.</td></tr>";
      return;
    }

    bodyEl.innerHTML = rows
      .map(function (item) {
        var order = item.order || {};
        return (
          "<tr class=\"hover:bg-surface-container-low transition-colors\">" +
          "<td class=\"px-6 py-4\"><input type=\"checkbox\" class=\"rounded text-primary focus:ring-primary\"/></td>" +
          "<td class=\"px-6 py-4 font-mono text-sm\">#" +
          escapeHtml(order.id ? order.id.slice(-6).toUpperCase() : "-") +
          "</td><td class=\"px-6 py-4 text-sm font-medium\">" +
          escapeHtml(order.shippingName || "Customer") +
          "</td><td class=\"px-6 py-4 text-xs text-secondary\">" +
          escapeHtml((item.product && item.product.name) || "Product") +
          "</td><td class=\"px-6 py-4 text-sm\">" +
          formatDate(order.createdAt) +
          "</td><td class=\"px-6 py-4 font-headline font-bold\">" +
          money(item.unitPrice * item.quantity) +
          "</td><td class=\"px-6 py-4\"><select class=\"bg-surface-container-low border-none rounded-lg py-1 px-2 text-xs font-bold\" data-order-id=\"" +
          order.id +
          "\"><option" +
          (order.status === "PENDING" ? " selected" : "") +
          ">PENDING</option><option" +
          (order.status === "PROCESSING" ? " selected" : "") +
          ">PROCESSING</option><option" +
          (order.status === "SHIPPED" ? " selected" : "") +
          ">SHIPPED</option><option" +
          (order.status === "DELIVERED" ? " selected" : "") +
          ">DELIVERED</option><option" +
          (order.status === "CANCELLED" ? " selected" : "") +
          ">CANCELLED</option></select></td>" +
          "<td class=\"px-6 py-4 text-right\"><button class=\"px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg\" data-action=\"update-status\" data-order-id=\"" +
          order.id +
          "\">Update</button></td></tr>"
        );
      })
      .join("");

    bodyEl.querySelectorAll("[data-action='update-status']").forEach(function (button) {
      button.addEventListener("click", function () {
        var orderId = button.getAttribute("data-order-id");
        var select = bodyEl.querySelector("select[data-order-id='" + orderId + "']");
        var nextStatus = select ? select.value : "PENDING";
        api("/orders/" + encodeURIComponent(orderId) + "/status", {
          method: "PUT",
          body: JSON.stringify({ status: nextStatus }),
        })
          .then(function () {
            orderItems = orderItems.map(function (entry) {
              if (entry.order && entry.order.id === orderId) {
                return { ...entry, order: { ...entry.order, status: nextStatus } };
              }
              return entry;
            });
            showMessage("Order status updated", "success");
            render();
          })
          .catch(function (error) {
            showMessage(error.message, "error");
          });
      });
    });
  }

  api("/artisan/orders")
    .then(function (data) {
      orderItems = data.items || [];
      var counts = orderItems.reduce(
        function (acc, item) {
          var status = ((item.order && item.order.status) || "PENDING").toUpperCase();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {},
      );

      if (newEl) {
        newEl.textContent = String(counts.PENDING || 0);
      }
      if (processingEl) {
        processingEl.textContent = String(counts.PROCESSING || 0);
      }
      if (shippedEl) {
        shippedEl.textContent = String(counts.SHIPPED || 0);
      }
      if (deliveredEl) {
        deliveredEl.textContent = String(counts.DELIVERED || 0);
      }

      render();
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });

  if (searchEl) {
    searchEl.addEventListener("input", render);
  }
  if (sortEl) {
    sortEl.addEventListener("change", render);
  }
}

export function wireArtisanSalesAnalyticsPage() {
  var grossSalesEl = document.getElementById("artisan-analytics-gross-sales");
  if (!grossSalesEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var totalOrdersEl = document.getElementById("artisan-analytics-total-orders");
  var aovEl = document.getElementById("artisan-analytics-aov");
  var customersEl = document.getElementById("artisan-analytics-customers");
  var topProductsBodyEl = document.getElementById("artisan-analytics-top-products-body");

  Promise.all([api("/artisan/analytics"), api("/artisan/orders")])
    .then(function (results) {
      var analytics = results[0].analytics || {};
      var items = results[1].items || [];
      var totalOrders = items.length;
      var totalRevenue = Number(analytics.grossSales || 0);
      var customers = {};
      var byProduct = {};

      items.forEach(function (item) {
        var order = item.order || {};
        if (order.userId) {
          customers[order.userId] = true;
        }

        var pid = item.productId || (item.product && item.product.id) || "unknown";
        if (!byProduct[pid]) {
          byProduct[pid] = {
            name: (item.product && item.product.name) || "Product",
            units: 0,
            revenue: 0,
          };
        }
        byProduct[pid].units += Number(item.quantity || 0);
        byProduct[pid].revenue += Number(item.unitPrice || 0) * Number(item.quantity || 0);
      });

      grossSalesEl.textContent = money(totalRevenue);
      if (totalOrdersEl) {
        totalOrdersEl.textContent = String(totalOrders);
      }
      if (aovEl) {
        aovEl.textContent = money(totalOrders ? totalRevenue / totalOrders : 0);
      }
      if (customersEl) {
        customersEl.textContent = String(Object.keys(customers).length);
      }

      if (topProductsBodyEl) {
        var ranked = Object.values(byProduct)
          .sort(function (a, b) {
            return b.revenue - a.revenue;
          })
          .slice(0, 5);

        if (!ranked.length) {
          topProductsBodyEl.innerHTML = "<tr><td class=\"py-5 text-sm text-secondary\" colspan=\"5\">No sales data yet.</td></tr>";
        } else {
          topProductsBodyEl.innerHTML = ranked
            .map(function (product, index) {
              return (
                "<tr class=\"border-b border-outline-variant/10\"><td class=\"py-5 font-headline font-bold text-lg text-primary\">" +
                String(index + 1).padStart(2, "0") +
                "</td><td class=\"py-5\"><p class=\"font-bold text-on-surface\">" +
                escapeHtml(product.name) +
                "</p></td><td class=\"py-5\"><span class=\"text-xs\">" +
                String(product.units) +
                " units</span></td><td class=\"py-5 font-bold\">" +
                money(product.revenue) +
                "</td><td class=\"py-5\"><div class=\"flex items-center gap-1 text-primary\"><span class=\"material-symbols-outlined text-[16px]\" style=\"font-variation-settings: 'FILL' 1;\">star</span><span class=\"font-bold\">-</span></div></td></tr>"
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

