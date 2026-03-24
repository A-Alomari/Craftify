// Backward-compatible bridge to the layered frontend auth modules.
(function () {
  import("../views/js/pages/authPages.js")
    .then(function (mod) {
      mod.bootstrapAuthPages();
    })
    .catch(function (error) {
      // Keep failure visible for development without breaking page rendering.
      // eslint-disable-next-line no-console
      console.error("Failed to load auth page module", error);
    });
})();
