const shopModulePromise = import("../views/js/pages/shopPages.js");

shopModulePromise
  .then(function (mod) {
    if (mod && typeof mod.initShopPages === "function") {
      mod.initShopPages();
    }
  })
  .catch(function (error) {
    console.error("Failed to load shop module", error);
  });
