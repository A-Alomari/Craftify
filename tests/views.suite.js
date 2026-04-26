module.exports = (suiteContext) => {
  describe('VIEW / INTEGRATION TESTS', () => {
    require('./views/v01-home-products.suite')(suiteContext);
    require('./views/v02-pages-dash.suite')(suiteContext);
    require('./views/v03-footer.suite')(suiteContext);
    require('./views/v04-user-artisan-views.suite')(suiteContext);
    require('./views/v05-notification-style.suite')(suiteContext);
  });

  require('./controllers/c30-server-internals-coverage.suite')(suiteContext);
};
