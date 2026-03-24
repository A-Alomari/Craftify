import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "-";
  }
  return dt.toLocaleString();
}

function getOrderStatusMeta(status) {
  var upper = String(status || "PENDING").toUpperCase();
  if (upper === "DELIVERED") {
    return { label: "Delivered", classes: "bg-green-100 text-green-700" };
  }
  if (upper === "SHIPPED") {
    return { label: "Shipped", classes: "bg-blue-100 text-blue-700" };
  }
  if (upper === "PROCESSING") {
    return { label: "Processing", classes: "bg-purple-100 text-purple-700" };
  }
  if (upper === "CANCELLED") {
    return { label: "Cancelled", classes: "bg-red-100 text-red-700" };
  }
  return { label: "Pending", classes: "bg-amber-100 text-amber-700" };
}

function getOrderIdFromUrl() {
  var params = new URLSearchParams(window.location.search);
  return params.get("orderId") || localStorage.getItem("craftify_last_order_id") || "";
}

export function wireOrderConfirmationPage() {
  var numberEl = document.getElementById("order-confirmation-number");
  if (!numberEl) {
    return;
  }

  var emailEl = document.getElementById("order-confirmation-email");
  var itemsEl = document.getElementById("order-confirmation-items");
  var subtotalEl = document.getElementById("order-confirmation-subtotal");
  var shippingEl = document.getElementById("order-confirmation-shipping");
  var taxEl = document.getElementById("order-confirmation-tax");
  var totalEl = document.getElementById("order-confirmation-total");
  var addressEl = document.getElementById("order-confirmation-shipping-address");
  var trackBtn = document.getElementById("order-confirmation-track-btn");
  var continueBtn = document.getElementById("order-confirmation-continue-btn");
  var receiptBtn = document.getElementById("order-confirmation-receipt-btn");

  var orderId = getOrderIdFromUrl();
  if (!orderId) {
    showMessage("No order selected", "error");
    return;
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", function () {
      window.location.href = "../products/product-browsing.html";
    });
  }

  if (receiptBtn) {
    receiptBtn.addEventListener("click", function () {
      window.print();
    });
  }

  api("/orders/" + encodeURIComponent(orderId))
    .then(function (data) {
      var order = data.order;
      var subtotal = (order.items || []).reduce(function (sum, item) {
        return sum + Number(item.unitPrice || 0) * Number(item.quantity || 0);
      }, 0);
      var shipping = Math.max(0, Number(order.totalAmount || 0) - subtotal);

      numberEl.textContent = "#" + order.id;
      if (emailEl) {
        emailEl.textContent = order.shippingEmail || "-";
      }
      if (subtotalEl) {
        subtotalEl.textContent = money(subtotal);
      }
      if (shippingEl) {
        shippingEl.textContent = money(shipping);
      }
      if (taxEl) {
        taxEl.textContent = money(0);
      }
      if (totalEl) {
        totalEl.textContent = money(order.totalAmount || 0);
      }

      if (addressEl) {
        addressEl.innerHTML =
          "<p class=\"font-bold\">" +
          (order.shippingName || "-") +
          "</p><p>" +
          (order.shippingStreet || "-") +
          "</p><p>" +
          (order.shippingCity || "-") +
          ", " +
          (order.shippingState || "-") +
          " " +
          (order.shippingZip || "") +
          "</p>";
      }

      if (itemsEl) {
        var items = order.items || [];
        itemsEl.innerHTML = items
          .map(function (item) {
            var img = item.product && item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "https://via.placeholder.com/160?text=Product";
            return (
              "<div class=\"flex items-center justify-between\"><div class=\"flex items-center gap-4\"><div class=\"w-16 h-16 bg-surface-container rounded-lg overflow-hidden flex-shrink-0\">" +
              "<img alt=\"" +
              (item.product ? item.product.name : "Product") +
              "\" class=\"w-full h-full object-cover\" src=\"" +
              img +
              "\"/></div><div><h3 class=\"font-medium text-on-surface\">" +
              (item.product ? item.product.name : "Product") +
              "</h3><p class=\"text-sm text-secondary\">Quantity: " +
              item.quantity +
              "</p></div></div><span class=\"font-headline text-on-surface\">" +
              money(Number(item.unitPrice || 0) * Number(item.quantity || 0)) +
              "</span></div>"
            );
          })
          .join("");
      }

      if (trackBtn) {
        trackBtn.addEventListener("click", function () {
          window.location.href = "../orders/order-tracking.html?orderId=" + encodeURIComponent(order.id);
        });
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

export function wireOrderTrackingPage() {
  var orderIdEl = document.getElementById("tracking-order-id");
  if (!orderIdEl) {
    return;
  }

  var orderDateEl = document.getElementById("tracking-order-date");
  var estimateEl = document.getElementById("tracking-delivery-estimate");
  var totalEl = document.getElementById("tracking-total-amount");
  var paymentEl = document.getElementById("tracking-payment-status");
  var eventsEl = document.getElementById("tracking-events");
  var itemsEl = document.getElementById("tracking-items");
  var carrierEl = document.getElementById("tracking-carrier");
  var trackingNumberEl = document.getElementById("tracking-number");
  var addressEl = document.getElementById("tracking-address");
  var backBtn = document.getElementById("tracking-back-history-btn");
  var supportBtn = document.getElementById("tracking-contact-support-btn");

  var orderId = getOrderIdFromUrl();
  if (!orderId) {
    showMessage("No order selected", "error");
    return;
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      window.location.href = "../orders/order-history.html";
    });
  }

  if (supportBtn) {
    supportBtn.addEventListener("click", function () {
      window.location.href = "../user/messaging-chat.html";
    });
  }

  api("/orders/" + encodeURIComponent(orderId))
    .then(function (data) {
      var order = data.order;
      var statusMeta = getOrderStatusMeta(order.status);
      var created = new Date(order.createdAt);
      var estimate = new Date(created.getTime());
      estimate.setDate(estimate.getDate() + 7);

      orderIdEl.textContent = "#" + order.id;
      if (orderDateEl) {
        orderDateEl.textContent = new Date(order.createdAt).toLocaleDateString();
      }
      if (estimateEl) {
        estimateEl.textContent = estimate.toLocaleDateString();
      }
      if (totalEl) {
        totalEl.textContent = money(order.totalAmount || 0);
      }
      if (paymentEl) {
        paymentEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider " + statusMeta.classes;
        paymentEl.textContent = statusMeta.label;
      }

      if (carrierEl) {
        carrierEl.textContent = order.trackingNumber ? "DHL Express" : "Preparing Shipment";
      }
      if (trackingNumberEl) {
        trackingNumberEl.textContent = order.trackingNumber || ("CF-" + order.id.slice(-6).toUpperCase());
      }
      if (addressEl) {
        addressEl.innerHTML =
          "<span class=\"block font-semibold\">" +
          (order.shippingName || "-") +
          "</span>" +
          (order.shippingStreet || "-") +
          "<br/>" +
          (order.shippingCity || "-") +
          ", " +
          (order.shippingState || "-") +
          " " +
          (order.shippingZip || "") +
          "<br/>" +
          (order.shippingEmail || "");
      }

      if (itemsEl) {
        var items = order.items || [];
        itemsEl.innerHTML = items
          .map(function (item) {
            var img = item.product && item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "https://via.placeholder.com/120?text=Product";
            return (
              "<div class=\"flex gap-4\"><div class=\"w-20 h-20 bg-surface-container rounded-lg overflow-hidden flex-shrink-0\"><img alt=\"" +
              (item.product ? item.product.name : "Product") +
              "\" class=\"w-full h-full object-cover\" src=\"" +
              img +
              "\"/></div><div class=\"flex-1\"><p class=\"font-headline font-semibold text-on-surface leading-tight\">" +
              (item.product ? item.product.name : "Product") +
              "</p><p class=\"text-xs text-secondary mt-1 italic\">Qty: " +
              item.quantity +
              "</p><div class=\"flex justify-between items-center mt-2\"><span class=\"text-sm text-on-surface-variant\">" +
              money(item.unitPrice) +
              " each</span><span class=\"font-bold text-on-surface\">" +
              money(Number(item.unitPrice || 0) * Number(item.quantity || 0)) +
              "</span></div></div></div>"
            );
          })
          .join("");
      }

      if (eventsEl) {
        var submitted = formatDate(order.createdAt);
        var updated = formatDate(order.updatedAt || order.createdAt);
        eventsEl.innerHTML =
          "<div class=\"absolute left-[11px] top-2 bottom-0 w-0.5 bg-surface-container-high\"></div>" +
          "<div class=\"relative\"><div class=\"absolute -left-[30px] w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-4 ring-background\"><span class=\"w-2.5 h-2.5 rounded-full bg-white\"></span></div><div><p class=\"text-on-surface font-semibold text-lg\">Current status: " +
          statusMeta.label +
          "</p><p class=\"text-secondary text-sm\">" +
          updated +
          "</p></div></div>" +
          "<div class=\"relative\"><div class=\"absolute -left-[30px] w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center ring-4 ring-background\"><span class=\"w-2.5 h-2.5 rounded-full bg-secondary\"></span></div><div><p class=\"text-on-surface-variant font-medium\">Order submitted</p><p class=\"text-secondary text-sm\">" +
          submitted +
          "</p></div></div>";
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

export function wireOrderHistoryPage() {
  var listEl = document.getElementById("order-history-list");
  if (!listEl) {
    return;
  }

  var statusFilter = document.getElementById("orders-status-filter");
  var sortFilter = document.getElementById("orders-sort-filter");
  var searchInput = document.getElementById("orders-search-input");
  var allOrders = [];

  function getStatusValue() {
    if (!statusFilter) {
      return "ALL";
    }
    var value = String(statusFilter.value || "All Orders").toUpperCase();
    return value.indexOf("ALL") >= 0 ? "ALL" : value;
  }

  function getSortValue() {
    if (!sortFilter) {
      return "NEW";
    }
    return String(sortFilter.value || "Newest First").toUpperCase().indexOf("OLDEST") >= 0 ? "OLD" : "NEW";
  }

  function renderOrders() {
    var status = getStatusValue();
    var sort = getSortValue();
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    var filtered = allOrders.filter(function (order) {
      if (status !== "ALL" && String(order.status || "").toUpperCase() !== status) {
        return false;
      }
      if (!query) {
        return true;
      }

      var text = (
        order.id +
        " " +
        (order.items || [])
          .map(function (item) {
            return item.product ? item.product.name : "";
          })
          .join(" ")
      ).toLowerCase();
      return text.indexOf(query) >= 0;
    });

    filtered.sort(function (a, b) {
      var av = new Date(a.createdAt).getTime();
      var bv = new Date(b.createdAt).getTime();
      return sort === "OLD" ? av - bv : bv - av;
    });

    if (!filtered.length) {
      listEl.innerHTML = "<div class=\"bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10\">No orders match your filters.</div>";
      return;
    }

    listEl.innerHTML = filtered
      .map(function (order) {
        var meta = getOrderStatusMeta(order.status);
        var items = order.items || [];
        var images = items
          .slice(0, 3)
          .map(function (item) {
            var img = item.product && item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "https://via.placeholder.com/160?text=Product";
            return "<img alt=\"\" class=\"inline-block h-20 w-20 rounded-lg ring-4 ring-surface-container-lowest object-cover\" src=\"" + img + "\"/>";
          })
          .join("");

        return (
          "<div class=\"bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 shadow-[0px_20px_40px_rgba(25,28,30,0.04)]\"><div class=\"flex flex-wrap justify-between items-start gap-4 mb-8\"><div class=\"flex gap-8\"><div><p class=\"text-[10px] uppercase tracking-widest font-bold text-outline mb-1\">Order ID</p><p class=\"font-serif font-bold text-on-surface\">#" +
          order.id +
          "</p></div><div><p class=\"text-[10px] uppercase tracking-widest font-bold text-outline mb-1\">Date Placed</p><p class=\"font-medium text-on-surface\">" +
          new Date(order.createdAt).toLocaleDateString() +
          "</p></div></div><span class=\"inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider " +
          meta.classes +
          "\"><span class=\"w-1.5 h-1.5 rounded-full bg-current mr-2\"></span>" +
          meta.label +
          "</span></div><div class=\"flex items-center gap-4 mb-8\"><div class=\"flex -space-x-3 overflow-hidden\">" +
          images +
          "</div><div><p class=\"text-sm font-medium text-on-surface\">" +
          items.length +
          " Items</p><p class=\"text-xs text-outline italic\">" +
          (items[0] && items[0].product ? items[0].product.name : "Order items") +
          "</p></div></div><div class=\"flex flex-col sm:flex-row justify-between items-end sm:items-center pt-8 border-t border-outline-variant/10\"><div><p class=\"text-[10px] uppercase tracking-widest font-bold text-outline mb-1\">Total Amount</p><p class=\"font-serif text-xl font-bold text-primary\">" +
          money(order.totalAmount || 0) +
          "</p></div><div class=\"flex items-center gap-4 mt-4 sm:mt-0\"><button class=\"border-2 border-primary-container text-primary px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary-container/5 transition-all\" data-order-track=\"" +
          order.id +
          "\">Track Order</button><button class=\"bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-all\" data-order-view=\"" +
          order.id +
          "\">View Details</button></div></div></div>"
        );
      })
      .join("");

    listEl.querySelectorAll("[data-order-track], [data-order-view]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        var id = event.currentTarget.getAttribute("data-order-track") || event.currentTarget.getAttribute("data-order-view");
        window.location.href = "../orders/order-tracking.html?orderId=" + encodeURIComponent(id);
      });
    });
  }

  api("/orders")
    .then(function (data) {
      allOrders = data.items || [];
      renderOrders();
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });

  if (statusFilter) {
    statusFilter.addEventListener("change", renderOrders);
  }
  if (sortFilter) {
    sortFilter.addEventListener("change", renderOrders);
  }
  if (searchInput) {
    searchInput.addEventListener("input", renderOrders);
  }
}
