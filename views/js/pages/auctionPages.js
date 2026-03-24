import { API_BASE, apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");

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
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return "-";
  }
  return dt.toLocaleString();
}

function formatCountdown(endAt) {
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (Number.isNaN(end) || diff <= 0) {
    return "Ended";
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return days + "d " + hours + "h";
  }

  return String(hours).padStart(2, "0") + "h : " + String(minutes).padStart(2, "0") + "m : " + String(seconds).padStart(2, "0") + "s";
}

function getCurrentUserName() {
  try {
    const raw = localStorage.getItem("craftify_user");
    if (!raw) {
      return "You";
    }
    const parsed = JSON.parse(raw);
    return parsed.fullName || "You";
  } catch (_error) {
    return "You";
  }
}

export function wireLiveAuctions() {
  const grid = document.getElementById("auction-grid");
  if (!grid) {
    return;
  }

  const countText = document.getElementById("auction-count-text");
  let countdownTimer;
  let socket;

  function attachCountdowns() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    const update = function () {
      grid.querySelectorAll("[data-auction-end-at]").forEach(function (node) {
        node.textContent = formatCountdown(node.getAttribute("data-auction-end-at"));
      });
    };

    update();
    countdownTimer = setInterval(update, 1000);
  }

  function patchCardBid(auctionId, currentBid) {
    const card = grid.querySelector("[data-auction-id='" + auctionId + "']");
    if (!card) {
      return;
    }

    const bidNode = card.querySelector("[data-auction-current-bid]");
    if (bidNode) {
      bidNode.textContent = money(currentBid);
    }

    const countNode = card.querySelector("[data-auction-bid-count]");
    if (countNode) {
      const prev = Number(countNode.getAttribute("data-count") || "0");
      const next = prev + 1;
      countNode.setAttribute("data-count", String(next));
      countNode.textContent = next + " bids placed";
    }
  }

  function setupSocket(items) {
    if (typeof window.io !== "function") {
      return;
    }

    socket = window.io(SOCKET_BASE);
    items.forEach(function (item) {
      socket.emit("join:auction", item.id);
    });

    socket.on("auction:new_bid", function (payload) {
      if (!payload || !payload.auctionId) {
        return;
      }
      patchCardBid(payload.auctionId, payload.currentBid);
    });
  }

  api("/auctions")
    .then(function (data) {
      const items = data.items || [];

      if (countText) {
        countText.textContent = "Showing " + items.length + " active auctions";
      }

      if (!items.length) {
        grid.innerHTML = "<div class=\"col-span-full bg-surface-container-lowest rounded-xl p-6\">No live auctions right now.</div>";
        return;
      }

      grid.innerHTML = items
        .map(function (item) {
          const imageUrl = item.product.imageUrls && item.product.imageUrls[0] ? item.product.imageUrls[0] : "https://via.placeholder.com/800x1000?text=Auction";
          const name = item.product.name || "Untitled Auction";
          const artisan = item.product.artisan && item.product.artisan.fullName ? item.product.artisan.fullName : "Unknown Artisan";
          const category = item.product.category || "Craft";
          const bidCount = item._count && typeof item._count.bids === "number" ? item._count.bids : 0;

          return (
            "<div class=\"group bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col transition-all duration-300\" data-auction-id=\"" +
            item.id +
            "\">" +
            "<div class=\"relative aspect-[4/5] overflow-hidden\">" +
            "<img alt=\"" +
            name +
            "\" class=\"w-full h-full object-cover group-hover:scale-105 transition-transform duration-700\" src=\"" +
            imageUrl +
            "\"/>" +
            "<div class=\"absolute top-4 left-4 bg-tertiary text-white text-[10px] font-bold px-3 py-1 rounded-sm flex items-center gap-1.5 uppercase tracking-tighter\"><span class=\"w-1.5 h-1.5 rounded-full bg-white\"></span>LIVE BID</div>" +
            "</div>" +
            "<div class=\"p-5 flex flex-col flex-grow\">" +
            "<span class=\"font-sans text-[10px] font-extrabold uppercase tracking-[0.2em] text-secondary mb-2\">" +
            category +
            "</span>" +
            "<h3 class=\"font-serif text-xl font-bold mb-1 leading-tight text-on-surface\">" +
            name +
            "</h3>" +
            "<p class=\"text-xs text-secondary mb-6 italic\">by " +
            artisan +
            "</p>" +
            "<div class=\"grid grid-cols-2 gap-4 mb-6\">" +
            "<div><span class=\"block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1\">Current Bid</span><span class=\"text-xl font-serif font-bold text-primary\" data-auction-current-bid>" +
            money(item.currentBid) +
            "</span></div>" +
            "<div><span class=\"block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1\">Time Left</span><div class=\"flex items-center gap-1 text-sm font-bold text-error\" data-auction-end-at=\"" +
            item.endAt +
            "\"></div></div>" +
            "</div>" +
            "<div class=\"mt-auto\">" +
            "<p class=\"text-[11px] text-secondary-container bg-secondary/10 px-2 py-1 inline-block rounded-md font-medium mb-4\" data-auction-bid-count data-count=\"" +
            bidCount +
            "\">" +
            bidCount +
            " bids placed</p>" +
            "<button class=\"w-full bg-primary-container text-on-primary-container py-3 rounded-lg font-bold text-sm uppercase tracking-widest hover:brightness-105 transition-all active:scale-95\" data-auction-open-btn>Place Bid</button>" +
            "</div></div></div>"
          );
        })
        .join("");

      attachCountdowns();
      setupSocket(items);

      grid.querySelectorAll("[data-auction-open-btn]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          const card = event.target.closest("[data-auction-id]");
          const auctionId = card ? card.getAttribute("data-auction-id") : "";
          window.location.href = "../auctions/auction-detail.html?id=" + encodeURIComponent(auctionId);
        });
      });

      grid.querySelectorAll("[data-auction-id]").forEach(function (card) {
        card.style.cursor = "pointer";
        card.addEventListener("click", function () {
          const auctionId = card.getAttribute("data-auction-id");
          window.location.href = "../auctions/auction-detail.html?id=" + encodeURIComponent(auctionId);
        });
      });
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}

export function wireAuctionDetail() {
  const titleEl = document.getElementById("auction-title");
  if (!titleEl) {
    return;
  }

  const breadcrumbTitleEl = document.getElementById("auction-breadcrumb-title");
  const categoryEl = document.getElementById("auction-category");
  const artisanEl = document.getElementById("auction-artisan-name");
  const currentBidEl = document.getElementById("auction-current-bid");
  const bidCountEl = document.getElementById("auction-bid-count");
  const leadingBidderEl = document.getElementById("auction-leading-bidder");
  const timerEl = document.getElementById("auction-time-remaining");
  const inputEl = document.getElementById("auction-bid-input");
  const minimumEl = document.getElementById("auction-minimum-bid");
  const placeBidBtn = document.getElementById("auction-place-bid-btn");
  const startingBidEl = document.getElementById("auction-starting-bid");
  const bidIncrementEl = document.getElementById("auction-bid-increment");
  const startedAtEl = document.getElementById("auction-started-at");
  const endsAtEl = document.getElementById("auction-ends-at");
  const descriptionEl = document.getElementById("auction-description");
  const historyBodyEl = document.getElementById("auction-bid-history-body");
  const imageEl = document.getElementById("auction-main-image");
  const winnerPaymentWrapEl = document.getElementById("auction-winner-payment-wrap");
  const winnerPaymentBtn = document.getElementById("auction-pay-now-btn");

  const params = new URLSearchParams(window.location.search);
  let auctionId = params.get("id");
  let auctionData = null;
  let timerInterval;
  let socket;

  function updateTimer() {
    if (!timerEl || !auctionData) {
      return;
    }
    timerEl.textContent = formatCountdown(auctionData.endAt);
  }

  function renderBidHistory(bids) {
    if (!historyBodyEl) {
      return;
    }

    const rows = (bids || []).slice(0, 25);
    if (!rows.length) {
      historyBodyEl.innerHTML = "<tr><td class=\"px-6 py-4 text-sm text-secondary\" colspan=\"3\">No bids yet.</td></tr>";
      return;
    }

    historyBodyEl.innerHTML = rows
      .map(function (bid, index) {
        const bidderName = bid.user && bid.user.fullName ? bid.user.fullName : "Anonymous";
        const bgClass = index % 2 === 0 ? "bg-white" : "bg-surface-container-low/30";
        return (
          "<tr class=\"" +
          bgClass +
          "\"><td class=\"px-6 py-4 text-sm font-medium\">" +
          bidderName +
          "</td><td class=\"px-6 py-4 font-headline font-bold text-primary\">" +
          money(bid.amount) +
          "</td><td class=\"px-6 py-4 text-xs text-secondary/60\">" +
          formatDate(bid.createdAt) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function isCurrentUserWinner(auction) {
    if (!auction || !auction.winnerId) {
      return false;
    }

    try {
      var user = JSON.parse(localStorage.getItem("craftify_user") || "{}");
      return !!user.id && user.id === auction.winnerId;
    } catch (_error) {
      return false;
    }
  }

  function syncWinnerPaymentCta(auction) {
    if (!winnerPaymentWrapEl || !winnerPaymentBtn) {
      return;
    }

    var ended = new Date(auction.endAt).getTime() <= Date.now();
    var canPay = ended && isCurrentUserWinner(auction) && getToken();

    if (!canPay) {
      winnerPaymentWrapEl.classList.add("hidden");
      return;
    }

    winnerPaymentWrapEl.classList.remove("hidden");
    if (!winnerPaymentBtn.hasAttribute("data-auction-pay-bound")) {
      winnerPaymentBtn.setAttribute("data-auction-pay-bound", "1");
      winnerPaymentBtn.addEventListener("click", function () {
        window.location.href = "../auctions/auction-won-payment.html?auctionId=" + encodeURIComponent(auction.id);
      });
    }
  }

  function renderAuction(auction) {
    auctionData = auction;
    const product = auction.product || {};
    const artisanName = product.artisan && product.artisan.fullName ? product.artisan.fullName : "Unknown Artisan";
    const bids = auction.bids || [];
    const highestBid = Number(auction.currentBid || auction.startingBid || 0);
    const minBid = highestBid + Number(auction.bidIncrement || 0);

    titleEl.textContent = product.name || "Auction Item";
    if (breadcrumbTitleEl) {
      breadcrumbTitleEl.textContent = product.name || "Auction Item";
    }
    if (categoryEl) {
      categoryEl.textContent = (product.category || "Craft").toUpperCase();
    }
    if (artisanEl) {
      artisanEl.textContent = "by " + artisanName;
    }
    if (currentBidEl) {
      currentBidEl.textContent = money(highestBid);
    }
    if (bidCountEl) {
      bidCountEl.textContent = bids.length + " bids";
    }
    if (leadingBidderEl) {
      const leader = bids[0] && bids[0].user && bids[0].user.fullName ? bids[0].user.fullName : "No bidder yet";
      leadingBidderEl.innerHTML = leader + " <span class=\"text-secondary/50 font-normal ml-1\">leading</span>";
    }
    if (minimumEl) {
      minimumEl.textContent = money(minBid);
    }
    if (inputEl) {
      inputEl.min = String(minBid);
      inputEl.placeholder = "Enter " + money(minBid) + " or more";
    }
    if (startingBidEl) {
      startingBidEl.textContent = money(auction.startingBid);
    }
    if (bidIncrementEl) {
      bidIncrementEl.textContent = money(auction.bidIncrement);
    }
    if (startedAtEl) {
      startedAtEl.textContent = formatDate(auction.startAt);
    }
    if (endsAtEl) {
      endsAtEl.textContent = formatDate(auction.endAt);
    }
    if (descriptionEl && product.description) {
      descriptionEl.textContent = product.description;
    }
    if (imageEl && product.imageUrls && product.imageUrls[0]) {
      imageEl.src = product.imageUrls[0];
      imageEl.alt = product.name || "Auction image";
    }

    renderBidHistory(bids);
    syncWinnerPaymentCta(auction);
    updateTimer();
  }

  function setupSocketForAuction(id) {
    if (typeof window.io !== "function") {
      return;
    }

    socket = window.io(SOCKET_BASE);
    socket.emit("join:auction", id);
    socket.on("auction:new_bid", function (payload) {
      if (!payload || payload.auctionId !== id) {
        return;
      }

      if (currentBidEl) {
        currentBidEl.textContent = money(payload.currentBid);
      }
      if (bidCountEl) {
        const current = Number((bidCountEl.textContent || "0").replace(/\D/g, "") || "0");
        bidCountEl.textContent = current + 1 + " bids";
      }
      if (leadingBidderEl) {
        leadingBidderEl.innerHTML = getCurrentUserName() + " <span class=\"text-secondary/50 font-normal ml-1\">leading</span>";
      }
      if (minimumEl) {
        minimumEl.textContent = money(Number(payload.currentBid || 0) + Number(auctionData ? auctionData.bidIncrement : 0));
      }

      if (auctionData) {
        auctionData.currentBid = payload.currentBid;
      }

      if (payload.bid && historyBodyEl) {
        const existing = historyBodyEl.innerHTML;
        const row =
          "<tr class=\"bg-white\"><td class=\"px-6 py-4 text-sm font-medium\">" +
          getCurrentUserName() +
          "</td><td class=\"px-6 py-4 font-headline font-bold text-primary\">" +
          money(payload.bid.amount) +
          "</td><td class=\"px-6 py-4 text-xs text-secondary/60\">" +
          formatDate(payload.bid.createdAt || new Date().toISOString()) +
          "</td></tr>";
        historyBodyEl.innerHTML = row + existing;
      }
    });
  }

  function loadAuction(id) {
    return api("/auctions/" + encodeURIComponent(id)).then(function (data) {
      renderAuction(data.auction);
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      timerInterval = setInterval(updateTimer, 1000);
      setupSocketForAuction(id);
    });
  }

  if (!auctionId) {
    api("/auctions")
      .then(function (data) {
        const first = data.items && data.items[0] ? data.items[0] : null;
        if (!first) {
          showMessage("No live auctions found", "error");
          return;
        }
        auctionId = first.id;
        loadAuction(auctionId).catch(function (error) {
          showMessage(error.message, "error");
        });
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      });
  } else {
    loadAuction(auctionId).catch(function (error) {
      showMessage(error.message, "error");
    });
  }

  if (placeBidBtn) {
    placeBidBtn.addEventListener("click", function (event) {
      event.preventDefault();

      if (!auctionId) {
        showMessage("Auction not loaded", "error");
        return;
      }

      if (!getToken()) {
        showMessage("Please sign in to place a bid", "error");
        window.location.href = "../auth/sign-in.html";
        return;
      }

      const value = inputEl ? Number(inputEl.value) : 0;
      if (!value || value <= 0) {
        showMessage("Enter a valid bid amount", "error");
        return;
      }

      api("/auctions/" + encodeURIComponent(auctionId) + "/bid", {
        method: "POST",
        body: JSON.stringify({ amount: value }),
      })
        .then(function (data) {
          showMessage("Bid placed successfully", "success");
          if (currentBidEl) {
            currentBidEl.textContent = money(data.auction.currentBid);
          }
          if (minimumEl) {
            minimumEl.textContent = money(Number(data.auction.currentBid || 0) + Number(auctionData ? auctionData.bidIncrement : 0));
          }
          if (inputEl) {
            inputEl.value = "";
          }
        })
        .catch(function (error) {
          showMessage(error.message, "error");
        });
    });
  }
}

export function wireAuctionWonPaymentPage() {
  var formEl = document.getElementById("auction-payment-form");
  if (!formEl) {
    return;
  }

  var statusEl = document.getElementById("auction-payment-status");
  var titleEl = document.getElementById("auction-payment-title");
  var artisanEl = document.getElementById("auction-payment-artisan");
  var amountEl = document.getElementById("auction-payment-amount");
  var submitBtn = document.getElementById("auction-payment-submit");
  var params = new URLSearchParams(window.location.search);
  var auctionId = params.get("auctionId") || "";
  var auction = null;

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) {
      return;
    }
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? "Processing Payment..." : "Pay Winning Bid";
  }

  if (!getToken()) {
    showMessage("Please sign in to continue", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  if (!auctionId) {
    showMessage("Missing auction ID", "error");
    if (statusEl) {
      statusEl.textContent = "Auction ID is missing.";
    }
    return;
  }

  api("/auctions/" + encodeURIComponent(auctionId))
    .then(function (data) {
      auction = data.auction;
      var product = auction.product || {};
      var isEnded = new Date(auction.endAt).getTime() <= Date.now();
      var user = {};
      try {
        user = JSON.parse(localStorage.getItem("craftify_user") || "{}");
      } catch (_error) {
        user = {};
      }

      var isWinner = user.id && auction.winnerId && user.id === auction.winnerId;

      if (titleEl) {
        titleEl.textContent = product.name || "Auction item";
      }
      if (artisanEl) {
        var artisanName = product.artisan && product.artisan.fullName ? product.artisan.fullName : "Unknown artisan";
        artisanEl.textContent = "by " + artisanName;
      }
      if (amountEl) {
        amountEl.textContent = money(auction.currentBid || auction.startingBid || 0);
      }

      if (!isEnded) {
        if (statusEl) {
          statusEl.textContent = "This auction is still active. Payment unlocks after it ends.";
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        return;
      }

      if (!isWinner) {
        if (statusEl) {
          statusEl.textContent = "Only the winning bidder can complete payment for this auction.";
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = "Winner verified. Submit shipping details to complete payment.";
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
      if (statusEl) {
        statusEl.textContent = "Unable to load auction details.";
      }
    });

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!auction) {
      showMessage("Auction details are not loaded yet", "error");
      return;
    }

    var payload = {
      shippingName: (val("auction-shipping-first-name") + " " + val("auction-shipping-last-name")).trim(),
      shippingEmail: val("auction-shipping-email"),
      shippingStreet: val("auction-shipping-street"),
      shippingCity: val("auction-shipping-city"),
      shippingState: val("auction-shipping-state"),
      shippingZip: val("auction-shipping-zip"),
    };

    if (!payload.shippingName || !payload.shippingEmail || !payload.shippingStreet || !payload.shippingCity || !payload.shippingState || !payload.shippingZip) {
      showMessage("Please complete all shipping fields", "error");
      return;
    }

    setSubmitting(true);
    api("/auctions/" + encodeURIComponent(auction.id) + "/pay", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(function (data) {
        localStorage.setItem("craftify_last_order_id", data.order.id);
        showMessage("Payment completed", "success");
        window.location.href = "../shopping/order-confirmation.html?orderId=" + encodeURIComponent(data.order.id);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      })
      .finally(function () {
        setSubmitting(false);
      });
  });
}

export function wireCreateAuctionPage() {
  var formEl = document.getElementById("create-auction-form");
  if (!formEl) {
    return;
  }

  if (!getToken()) {
    showMessage("Please sign in as an artisan", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var productSelect = document.getElementById("create-auction-product-select");
  var productNameInput = document.getElementById("create-auction-product-name-input");
  var startingBidInput = document.getElementById("create-auction-starting-bid-input");
  var bidIncrementInput = document.getElementById("create-auction-bid-increment-input");
  var reservePriceInput = document.getElementById("create-auction-reserve-price-input");
  var startAtInput = document.getElementById("create-auction-start-at-input");
  var endAtInput = document.getElementById("create-auction-end-at-input");
  var submitBtn = document.getElementById("create-auction-submit-btn");

  var currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem("craftify_user") || "{}");
  } catch (_error) {
    currentUser = {};
  }

  api("/products?page=1&pageSize=100")
    .then(function (data) {
      var products = (data.items || []).filter(function (item) {
        return !currentUser.id || (item.artisan && item.artisan.id === currentUser.id);
      });
      if (productSelect) {
        productSelect.innerHTML = "<option value=\"\">Select product</option>";
        products.forEach(function (product) {
          var option = document.createElement("option");
          option.value = product.id;
          option.textContent = product.name;
          productSelect.appendChild(option);
        });

        productSelect.addEventListener("change", function () {
          var selected = products.find(function (item) {
            return item.id === productSelect.value;
          });
          if (productNameInput && selected) {
            productNameInput.value = selected.name;
          }
        });
      }
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();
    var payload = {
      productId: productSelect ? productSelect.value : "",
      startingBid: Number(startingBidInput ? startingBidInput.value : 0),
      bidIncrement: Number(bidIncrementInput ? bidIncrementInput.value : 0),
      reservePrice: Number(reservePriceInput ? reservePriceInput.value : 0),
      startAt: startAtInput && startAtInput.value ? new Date(startAtInput.value).toISOString() : "",
      endAt: endAtInput && endAtInput.value ? new Date(endAtInput.value).toISOString() : "",
    };

    if (!payload.productId) {
      showMessage("Select a product for this auction", "error");
      return;
    }
    if (!payload.startingBid || payload.startingBid <= 0) {
      showMessage("Enter a valid starting bid", "error");
      return;
    }
    if (!payload.bidIncrement || payload.bidIncrement <= 0) {
      showMessage("Enter a valid bid increment", "error");
      return;
    }
    if (!payload.startAt || !payload.endAt) {
      showMessage("Select auction start and end date", "error");
      return;
    }

    if (!reservePriceInput || !reservePriceInput.value) {
      delete payload.reservePrice;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";
    }

    api("/auctions", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(function (data) {
        showMessage("Auction published", "success");
        window.location.href = "../auctions/auction-detail.html?id=" + encodeURIComponent(data.auction.id);
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
        }
      });
  });
}
