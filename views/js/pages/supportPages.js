import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function wireFaqPage() {
  var listEl = document.getElementById("faq-list");
  if (!listEl) {
    return;
  }

  var searchEl = document.getElementById("faq-search-input");
  var filterButtons = Array.from(document.querySelectorAll("[data-faq-filter]"));
  var contactBtn = document.getElementById("faq-contact-us-btn");
  var faqs = [];
  var activeFilter = "all";

  function classifyFaq(item) {
    var text = ((item.question || "") + " " + (item.answer || "")).toLowerCase();
    if (text.indexOf("auction") >= 0 || text.indexOf("bid") >= 0) {
      return "auctions";
    }
    if (text.indexOf("payment") >= 0 || text.indexOf("billing") >= 0 || text.indexOf("refund") >= 0) {
      return "payments";
    }
    if (text.indexOf("artisan") >= 0 || text.indexOf("seller") >= 0 || text.indexOf("maker") >= 0) {
      return "artisans";
    }
    return "customers";
  }

  function setActiveFilter(filterName) {
    activeFilter = filterName;
    filterButtons.forEach(function (button) {
      var selected = button.getAttribute("data-faq-filter") === filterName;
      button.classList.toggle("bg-primary", selected);
      button.classList.toggle("text-white", selected);
      if (!selected) {
        button.classList.add("bg-surface-container-lowest", "text-secondary");
      } else {
        button.classList.remove("bg-surface-container-lowest", "text-secondary");
      }
    });
    render();
  }

  function filteredFaqs() {
    var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    return faqs.filter(function (item) {
      var typeOk = activeFilter === "all" || classifyFaq(item) === activeFilter;
      if (!typeOk) {
        return false;
      }
      if (!query) {
        return true;
      }
      var hay = ((item.question || "") + " " + (item.answer || "")).toLowerCase();
      return hay.indexOf(query) >= 0;
    });
  }

  function render() {
    var rows = filteredFaqs();
    if (!rows.length) {
      listEl.innerHTML =
        "<div class=\"bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10\">" +
        "<p class=\"text-secondary\">No FAQ items match your search.</p></div>";
      return;
    }

    listEl.innerHTML = rows
      .map(function (item, index) {
        return (
          "<details class=\"group bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden\"" +
          (index === 0 ? " open" : "") +
          ">" +
          "<summary class=\"flex items-center justify-between p-6 cursor-pointer select-none\">" +
          "<span class=\"font-bold text-lg\">" +
          escapeHtml(item.question || "Question") +
          "</span><span class=\"material-symbols-outlined group-open:hidden transition-transform\">add</span>" +
          "<span class=\"material-symbols-outlined hidden group-open:block transition-transform\">remove</span></summary>" +
          "<div class=\"px-6 pb-6 text-secondary leading-relaxed\">" +
          escapeHtml(item.answer || "") +
          "</div></details>"
        );
      })
      .join("");
  }

  api("/faqs")
    .then(function (data) {
      faqs = data.items || [];
      render();
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setActiveFilter(button.getAttribute("data-faq-filter") || "all");
    });
  });

  if (searchEl) {
    searchEl.addEventListener("input", render);
  }

  if (contactBtn) {
    contactBtn.addEventListener("click", function () {
      window.location.href = "./contact-us.html";
    });
  }

  setActiveFilter("all");
}

export function wireContactPage() {
  var formEl = document.getElementById("contact-form");
  if (!formEl) {
    return;
  }

  var nameEl = document.getElementById("contact-name-input");
  var emailEl = document.getElementById("contact-email-input");
  var messageEl = document.getElementById("contact-message-input");
  var submitBtn = document.getElementById("contact-submit-btn");

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();

    var payload = {
      name: nameEl ? nameEl.value.trim() : "",
      email: emailEl ? emailEl.value.trim() : "",
      message: messageEl ? messageEl.value.trim() : "",
    };

    if (!payload.name || payload.name.length < 2) {
      showMessage("Please enter your name", "error");
      return;
    }
    if (!payload.email || payload.email.indexOf("@") < 1) {
      showMessage("Please enter a valid email", "error");
      return;
    }
    if (!payload.message || payload.message.length < 10) {
      showMessage("Message must be at least 10 characters", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.7";
    }

    api("/contact", {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(function () {
        showMessage("Message sent successfully", "success");
        formEl.reset();
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
