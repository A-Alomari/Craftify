module.exports = ({ createReqRes, getIds }) => {
    test('Admin controller remaining non-XHR branches are covered', () => {
      const ids = getIds();
      const adminController = require('../../controllers/adminController');
      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');
      const Coupon = require('../../models/Coupon');

      jest.spyOn(User, 'findAll').mockReturnValue([]);
      jest.spyOn(User, 'count').mockReturnValue(0);
      let pair = createReqRes({
        query: { role: 'customer', status: 'active', search: 'x', page: 2 },
        session: { user: { id: ids.adminId, role: 'admin' } }
      });
      adminController.users(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'admin/users',
        expect.objectContaining({
          filters: { role: 'customer', status: 'active', search: 'x' }
        })
      );

      jest.spyOn(User, 'delete').mockImplementation(() => {
        throw new Error('delete fail');
      });
      pair = createReqRes({
        params: { id: String(ids.cust2Id) },
        session: { user: { id: ids.adminId, role: 'admin' } }
      });
      adminController.deleteUser(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/users');

      jest.spyOn(ArtisanProfile, 'approve').mockImplementation(() => {
        throw new Error('approve artisan fail');
      });
      pair = createReqRes({ params: { id: String(ids.artId) } });
      adminController.approveArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/artisans');

      jest.spyOn(ArtisanProfile, 'reject').mockImplementation(() => {
        throw new Error('reject artisan fail');
      });
      pair = createReqRes({ params: { id: String(ids.artId) } });
      adminController.rejectArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/artisans');

      jest.spyOn(Product, 'findById').mockReturnValue({ artisan_id: ids.artId, name: 'X', featured: 0 });
      jest.spyOn(Product, 'update').mockImplementation(() => {
        throw new Error('product update fail');
      });
      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      adminController.approveProduct(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/products');

      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      adminController.rejectProduct(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/products');

      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      adminController.toggleFeatured(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/products');

      Product.update.mockRestore();
      const categoryUpdateSpy = jest.spyOn(Category, 'update').mockReturnValue(true);
      pair = createReqRes({
        params: { id: String(ids.potId) },
        body: { name: 'Updated Name', description: 'Updated Description' },
        file: { filename: 'category-image.png' }
      });
      adminController.updateCategory(pair.req, pair.res);
      expect(categoryUpdateSpy).toHaveBeenCalledWith(
        ids.potId,
        expect.objectContaining({ image: '/uploads/category-image.png' })
      );

      categoryUpdateSpy.mockImplementation(() => {
        throw new Error('category update fail');
      });
      pair = createReqRes({
        params: { id: String(ids.potId) },
        body: { name: 'N', description: 'D' }
      });
      adminController.updateCategory(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/categories');

      jest.spyOn(Category, 'delete').mockImplementation(() => {
        throw new Error('category delete fail');
      });
      pair = createReqRes({ params: { id: String(ids.potId) } });
      adminController.deleteCategory(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/categories');

      jest.spyOn(Order, 'updateStatus').mockImplementation(() => {
        throw new Error('order status fail');
      });
      pair = createReqRes({ params: { id: String(ids.orderId) }, body: { status: 'processing' } });
      adminController.updateOrderStatus(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/orders');

      jest.spyOn(Auction, 'cancel').mockImplementation(() => {
        throw new Error('auction cancel fail');
      });
      pair = createReqRes({ params: { id: String(ids.auctionId) } });
      adminController.cancelAuction(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/auctions');

      jest.spyOn(Review, 'updateStatus').mockImplementation(() => {
        throw new Error('review update fail');
      });
      pair = createReqRes({ params: { id: '1' }, body: { status: 'hidden' } });
      adminController.updateReviewStatus(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/reviews');

      pair = createReqRes({ params: { id: '1' } });
      adminController.approveReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/reviews');

      jest.spyOn(Review, 'delete').mockImplementation(() => {
        throw new Error('review delete fail');
      });
      pair = createReqRes({ params: { id: '1' } });
      adminController.deleteReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/reviews');

      jest.spyOn(Coupon, 'toggleActive').mockImplementation(() => {
        throw new Error('coupon toggle fail');
      });
      pair = createReqRes({ params: { id: '1' } });
      adminController.toggleCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/coupons');

      jest.spyOn(Coupon, 'delete').mockImplementation(() => {
        throw new Error('coupon delete fail');
      });
      pair = createReqRes({ params: { id: '1' } });
      adminController.deleteCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/coupons');
    });
};
