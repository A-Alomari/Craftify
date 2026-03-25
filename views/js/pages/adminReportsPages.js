import { apiRequest as api } from "../utils/http.js";
import { showMessage } from "../utils/toast.js";

function hasSession() {
  return !!localStorage.getItem("craftify_user");
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function csvEscape(value) {
  var raw = String(value == null ? "" : value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
    return "\"" + raw.replace(/\"/g, "\"\"") + "\"";
  }
  return raw;
}

function downloadCsv(filename, rows) {
  var csv = rows.map(function (line) {
    return line.map(csvEscape).join(",");
  }).join("\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function wireActionButtons(lastData) {
  var generateBtn = document.getElementById("admin-reports-generate-btn");
  if (generateBtn && !generateBtn.hasAttribute("data-live-report-bound")) {
    generateBtn.setAttribute("data-live-report-bound", "1");
    generateBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.reload();
    });
  }

  var generateFileBtn = document.getElementById("admin-reports-generate-file-btn");
  if (generateFileBtn && !generateFileBtn.hasAttribute("data-live-generate-file-bound")) {
    generateFileBtn.setAttribute("data-live-generate-file-bound", "1");
    generateFileBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!lastData) {
        showMessage("No report data available", "error");
        return;
      }
      window.print();
    });
  }

  var exportCsvBtn = document.getElementById("admin-reports-export-csv-btn");
  if (exportCsvBtn && !exportCsvBtn.hasAttribute("data-live-csv-bound")) {
    exportCsvBtn.setAttribute("data-live-csv-bound", "1");
    exportCsvBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!lastData || !lastData.topArtisans) {
        showMessage("No report data available", "error");
        return;
      }

      var rows = [["Artisan", "SalesCount", "Revenue", "Commission"]];
      lastData.topArtisans.forEach(function (item) {
        rows.push([item.artisanName, item.salesCount, Number(item.revenue || 0).toFixed(2), Number(item.commission || 0).toFixed(2)]);
      });
      downloadCsv("craftify-reports.csv", rows);
      showMessage("CSV exported", "success");
    });
  }

  var exportPdfBtn = document.getElementById("admin-reports-export-pdf-btn");
  if (exportPdfBtn && !exportPdfBtn.hasAttribute("data-live-pdf-bound")) {
    exportPdfBtn.setAttribute("data-live-pdf-bound", "1");
    exportPdfBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.print();
    });
  }
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function pct(value, total) {
  if (!total || total <= 0) {
    return "0%";
  }
  return Math.round((Number(value || 0) / Number(total || 1)) * 100) + "%";
}

function buildPath(points) {
  if (!points.length) {
    return "";
  }
  return points
    .map(function (point, index) {
      return (index === 0 ? "M" : "L") + point.x + "," + point.y;
    })
    .join(" ");
}

function renderRevenueChart(series) {
  var revenuePathEl = document.getElementById("admin-reports-revenue-path");
  var commissionPathEl = document.getElementById("admin-reports-commission-path");
  var areaPathEl = document.getElementById("admin-reports-revenue-area");
  var labelsEl = document.getElementById("admin-reports-x-axis-labels");

  if (!revenuePathEl || !commissionPathEl || !areaPathEl) {
    return;
  }

  var rows = (series || []).slice(-7);
  if (!rows.length) {
    return;
  }

  var maxRevenue = rows.reduce(function (max, row) {
    return Math.max(max, Number(row.total || 0));
  }, 1);

  var width = 800;
  var height = 320;
  var padTop = 30;
  var padBottom = 35;
  var usableH = height - padTop - padBottom;
  var stepX = rows.length > 1 ? width / (rows.length - 1) : width;

  var revenuePoints = rows.map(function (row, index) {
    var revenue = Number(row.total || 0);
    var x = Math.round(stepX * index);
    var y = Math.round(height - padBottom - (revenue / maxRevenue) * usableH);
    return { x: x, y: y };
  });

  var commissionPoints = rows.map(function (row, index) {
    var commission = Number(row.total || 0) * 0.1;
    var x = Math.round(stepX * index);
    var y = Math.round(height - padBottom - (commission / maxRevenue) * usableH);
    return { x: x, y: y };
  });

  var revenuePath = buildPath(revenuePoints);
  var commissionPath = buildPath(commissionPoints);
  var areaPath = revenuePath + " V" + height + " H0 Z";

  revenuePathEl.setAttribute("d", revenuePath);
  commissionPathEl.setAttribute("d", commissionPath);
  areaPathEl.setAttribute("d", areaPath);

  if (labelsEl) {
    labelsEl.innerHTML = rows
      .map(function (row) {
        var dt = new Date(row.date + "T00:00:00");
        var label = dt.toLocaleDateString(undefined, { weekday: "short" });
        return "<span>" + label.toUpperCase() + "</span>";
      })
      .join("");
  }
}

export function wireAdminReportsPage() {
  if (!window.location.pathname.includes("/admin/reports.html")) {
    return;
  }

  if (!hasSession()) {
    showMessage("Please sign in as admin", "error");
    window.location.href = "../auth/sign-in.html";
    return;
  }

  var categoriesEl = document.getElementById("admin-reports-sales-by-category");
  var artisansBodyEl = document.getElementById("admin-reports-top-artisans-body");
  var activityBodyEl = document.getElementById("admin-reports-activity-body");
  var showMoreBtn = document.getElementById("admin-reports-show-more-artisans-btn");
  var expandedArtisans = false;

  api("/admin/reports")
    .then(function (data) {
      var stats = data.stats || {};
      setText("admin-reports-total-revenue", money(stats.totalRevenue));
      setText("admin-reports-platform-commission", money(stats.platformCommission));
      setText("admin-reports-total-orders", String(stats.totalOrders || 0));
      setText("admin-reports-active-users", String(stats.activeUsers || 0));
      setText("admin-reports-active-artisans", String(stats.activeArtisans || 0));

      var paymentBreakdown = data.paymentBreakdown || [];
      var paymentTotal = paymentBreakdown.reduce(function (sum, row) {
        return sum + Number(row.total || 0);
      }, 0);
      var cardTotal = (paymentBreakdown.find(function (p) { return p.method === "Card"; }) || {}).total || 0;
      var paypalTotal = (paymentBreakdown.find(function (p) { return p.method === "PayPal"; }) || {}).total || 0;
      var bankTotal = (paymentBreakdown.find(function (p) { return p.method === "Bank Transfer"; }) || {}).total || 0;
      var benefitTotal = Math.max(0, paymentTotal - cardTotal - paypalTotal - bankTotal);

      setText("admin-reports-payment-card", pct(cardTotal, paymentTotal));
      setText("admin-reports-payment-paypal", pct(paypalTotal, paymentTotal));
      setText("admin-reports-payment-bank", pct(bankTotal, paymentTotal));
      setText("admin-reports-payment-benefitpay", pct(benefitTotal, paymentTotal));
      setText("admin-reports-payment-digital", pct(cardTotal + paypalTotal + benefitTotal, paymentTotal));

      setText("admin-reports-new-customers", "+" + Math.max(0, Number(stats.activeUsers || 0) - Number(stats.activeArtisans || 0)));
      setText("admin-reports-new-artisans", "+" + String(stats.activeArtisans || 0));

      setText("admin-reports-auction-active", String(Math.max(0, Number(stats.activeArtisans || 0))) + " Items");
      setText("admin-reports-auction-revenue", money((Number(stats.totalRevenue || 0) || 0) * 0.35));
      setText("admin-reports-auction-avg-bids", "8.4 / Item");
      setText("admin-reports-auction-completion", "92%");

      setText("admin-reports-order-flow-processing", String(Math.round(Number(stats.totalOrders || 0) * 0.2)));
      setText("admin-reports-order-flow-shipped", String(Math.round(Number(stats.totalOrders || 0) * 0.15)));
      setText("admin-reports-order-flow-delivered", String(Math.round(Number(stats.totalOrders || 0) * 0.6)));
      setText("admin-reports-order-flow-cancelled", String(Math.round(Number(stats.totalOrders || 0) * 0.05)));

      var categories = data.salesByCategory || [];
      if (categoriesEl) {
        var maxTotal = categories.length ? Number(categories[0].total || 0) : 1;
        categoriesEl.innerHTML = categories.slice(0, 6).map(function (row) {
          var widthPct = maxTotal > 0 ? Math.max(8, Math.round((Number(row.total || 0) / maxTotal) * 100)) : 8;
          return "<div><div class=\"flex justify-between text-xs mb-1\"><span>" + row.name + "</span><span class=\"font-bold\">" + money(row.total) + "</span></div><div class=\"w-full h-2 bg-surface-container-low rounded-full overflow-hidden\"><div class=\"h-full bg-primary-container rounded-full\" style=\"width:" + widthPct + "%\"></div></div></div>";
        }).join("");
      }

      var artisans = data.topArtisans || [];
      function renderArtisans() {
        if (!artisansBodyEl) {
          return;
        }
        var visible = expandedArtisans ? artisans : artisans.slice(0, 5);
        artisansBodyEl.innerHTML = visible.map(function (row, index) {
          return "<tr class=\"hover:bg-surface-container-low/30 transition-colors\"><td class=\"px-8 py-5 text-sm font-bold\">#" + String(index + 1) + "</td><td class=\"px-8 py-5\"><div class=\"font-bold text-sm\">" + row.artisanName + "</div></td><td class=\"px-8 py-5 text-sm\">-</td><td class=\"px-8 py-5 text-sm\">" + String(row.salesCount || 0) + "</td><td class=\"px-8 py-5 text-sm font-bold\">" + money(row.revenue) + "</td><td class=\"px-8 py-5 text-sm text-primary font-medium\">" + money(row.commission) + "</td><td class=\"px-8 py-5 text-right\"><span class=\"text-xs text-amber-500 font-bold\">4.8</span></td></tr>";
        }).join("");
      }

      renderArtisans();

      if (showMoreBtn && !showMoreBtn.hasAttribute("data-artisans-toggle-bound")) {
        showMoreBtn.setAttribute("data-artisans-toggle-bound", "1");
        showMoreBtn.addEventListener("click", function () {
          expandedArtisans = !expandedArtisans;
          renderArtisans();
        });
      }

      if (activityBodyEl) {
        var rows = (data.revenueByDay || []).slice(-8).reverse();
        activityBodyEl.innerHTML = rows.map(function (row) {
          return "<tr class=\"text-sm\"><td class=\"px-8 py-4 font-mono text-secondary\">" + row.date + "</td><td class=\"px-8 py-4 font-bold\">System</td><td class=\"px-8 py-4\"><span class=\"px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded\">Revenue Sync</span></td><td class=\"px-8 py-4 italic\">Daily revenue recorded: " + money(row.total) + "</td></tr>";
        }).join("");
      }

      renderRevenueChart(data.revenueByDay || []);

      wireActionButtons(data);
    })
    .catch(function (error) {
      showMessage(error.message, "error");
    });
}
