module.exports = ({ createReqRes, getIds }) => {
    test('Artisan, product, and auction controller remaining branches are covered', () => {
      const ids = getIds();
      const artisanController = require('../../controllers/artisanController');
      const productController = require('../../controllers/productController');
      const auctionController = require('../../controllers/auctionController');

      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');
      const Wishlist = require('../../models/Wishlist');

      jest.spyOn(User, 'update').mockReturnValue(true);
      jest.spyOn(ArtisanProfile, 'update').mockReturnValue(true);
      let pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: {
          name: 'Artisan Name',
          phone: '99999',
          shop_name: 'Shop',
          bio: 'Bio',
          return_policy: 'Policy'
        }
      });
      artisanController.updateProfile(pair.req, pair.res);
      expect(User.update).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, artisan_id: ids.custId });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.vaseId) },
        body: {
          name: 'Denied Product',
          description: 'Denied',
          price: 10,
          stock: 1,
          category_id: ids.potId
        }
      });
      artisanController.updateProduct(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/artisan/products');

      jest.spyOn(Order, 'updateStatus').mockImplementation(() => {
        throw new Error('artisan status fail');
      });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.orderId) },
        body: { status: 'shipped' }
      });
      artisanController.updateOrderStatus(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/artisan/orders');

      jest.spyOn(Product, 'findAll').mockReturnValue([{ id: ids.vaseId }]);
      jest.spyOn(Product, 'count').mockReturnValue(12);
      jest.spyOn(require('../../models/Category'), 'findAll').mockReturnValue([]);
      pair = createReqRes({
        query: {},
        session: { user: { id: ids.custId, role: 'customer' } }
      });
      productController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'products/index',
        expect.objectContaining({ title: 'Browse Products - Craftify' })
      );

      Product.findById.mockReturnValue({
        id: ids.vaseId,
        status: 'approved',
        artisan_id: ids.artId,
        images: '[]',
        name: 'Shown Product'
      });
      jest.spyOn(Product, 'incrementViews').mockReturnValue(true);
      jest.spyOn(Review, 'findByProductId').mockReturnValue([]);
      jest.spyOn(Review, 'getAverageRating').mockReturnValue({ average: 0, count: 0 });
      jest.spyOn(Review, 'getRatingDistribution').mockReturnValue([]);
      jest.spyOn(Product, 'getRelated').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ id: ids.artId, shop_name: 'Shop' });
      jest.spyOn(Wishlist, 'isInWishlist').mockReturnValue(false);
      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      pair = createReqRes({
        params: { id: String(ids.vaseId) },
        session: { user: { id: ids.custId, role: 'customer' } }
      });
      productController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'products/show',
        expect.objectContaining({
          inWishlist: false,
          canReview: { canReview: true }
        })
      );

      Product.findById.mockImplementation(() => {
        throw new Error('show fail');
      });
      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      productController.show(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Category, 'findById').mockReturnValue({ id: ids.potId, name: 'Pots' });
      Product.findAll.mockImplementation(() => {
        throw new Error('category fail');
      });
      pair = createReqRes({ params: { id: String(ids.potId) } });
      productController.byCategory(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      ArtisanProfile.findByUserId.mockImplementation(() => {
        throw new Error('artisan fail');
      });
      pair = createReqRes({ params: { id: String(ids.artId) } });
      productController.byArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Auction, 'findAll').mockReturnValue([{ product_images: '[]' }]);
      jest.spyOn(Auction, 'count').mockReturnValue(1);
      pair = createReqRes({ query: {}, params: {} });
      auctionController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'auctions/index',
        expect.objectContaining({ title: 'Live Auctions - Craftify' })
      );

      jest.spyOn(Auction, 'findById').mockReturnValue({
        id: ids.auctionId,
        status: 'active',
        title: 'Test Auction',
        product_name: 'Product',
        product_images: '[]',
        end_time: new Date(Date.now() + 60000).toISOString()
      });
      jest.spyOn(Auction, 'getBids').mockReturnValue([
        { user_id: ids.custId, amount: 21 },
        { user_id: ids.cust2Id, amount: 20 }
      ]);
      pair = createReqRes({
        params: { id: String(ids.auctionId) },
        session: { user: { id: ids.custId, role: 'customer', name: 'Customer' } }
      });
      auctionController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'auctions/show',
        expect.objectContaining({ userBid: expect.objectContaining({ user_id: ids.custId }) })
      );

      Auction.findById.mockImplementation(() => {
        throw new Error('auction show fail');
      });
      pair = createReqRes({ params: { id: String(ids.auctionId) } });
      auctionController.show(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auctions');

      jest.spyOn(Auction, 'placeBid').mockImplementation(() => {
        throw new Error('place bid fail');
      });
      pair = createReqRes({
        params: { id: String(ids.auctionId) },
        body: { amount: 99 },
        session: { user: { id: ids.custId, name: 'Customer' } }
      });
      auctionController.placeBid(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith(`/auctions/${ids.auctionId}`);

      jest.spyOn(Auction, 'getUserBids').mockImplementation(() => {
        throw new Error('my bids fail');
      });
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      auctionController.myBids(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/');

      jest.spyOn(Auction, 'findById').mockImplementation(() => {
        throw new Error('api auction fail');
      });
      pair = createReqRes({ params: { id: String(ids.auctionId) } });
      auctionController.getAuctionData(pair.req, pair.res);
      expect(pair.res.status).toHaveBeenCalledWith(500);
    });
};
