module.exports = (suiteContext) => {
  describe('MODEL TESTS', () => {
    require('./models/m01-product.suite')(suiteContext);
    require('./models/m02-user.suite')(suiteContext);
    require('./models/m03-review.suite')(suiteContext);
    require('./models/m04-category.suite')(suiteContext);
    require('./models/m05-cart.suite')(suiteContext);
    require('./models/m06-auction.suite')(suiteContext);
    require('./models/m07-coupon.suite')(suiteContext);
    require('./models/m08-wishlist.suite')(suiteContext);
    require('./models/m09-notification.suite')(suiteContext);
  });

  describe('ADDITIONAL MODEL COVERAGE', () => {
    require('./models/m10-artisan-profile.suite')(suiteContext);
    require('./models/m11-message.suite')(suiteContext);
    require('./models/m12-shipment.suite')(suiteContext);
    require('./models/m13-order-extra.suite')(suiteContext);
    require('./models/m14-helpers.suite')(suiteContext);
    require('./models/m15-database-branches.suite')(suiteContext);
    require('./models/m16-final-coverage.suite')(suiteContext);
    require('./models/m17-utils.suite')(suiteContext);
    require('./models/m18-newsletter-password-reset.suite')(suiteContext);
  });
};
