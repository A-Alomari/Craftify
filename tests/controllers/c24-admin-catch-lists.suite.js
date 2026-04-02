const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  describe('Admin Controller Catch and Invalid-ID Coverage', () => {
    test('Admin list pages handle filter and catch paths, including reports default and catch', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');
      const Coupon = require('../../models/Coupon');

      const usersWithFilters = await agent.get('/admin/users?role=customer&status=active&search=Customer');
      expect(usersWithFilters.statusCode).toBe(200);

      const artisansWithFilters = await agent.get('/admin/artisans?approved=true&search=Shop');
      expect(artisansWithFilters.statusCode).toBe(200);

      const productsWithFilters = await agent.get(`/admin/products?status=approved&category=${ids.potId}&search=Test`);
      expect(productsWithFilters.statusCode).toBe(200);

      const ordersWithFilters = await agent.get('/admin/orders?status=delivered&payment_status=paid&search=Customer');
      expect(ordersWithFilters.statusCode).toBe(200);

      const reportsDefaultPeriod = await agent.get('/admin/reports?period=unexpected-value');
      expect(reportsDefaultPeriod.statusCode).toBe(200);

      const missingOrder = await agent.get('/admin/orders/999999');
      expect(missingOrder.statusCode).toBe(302);
      expect(missingOrder.headers.location).toContain('/admin/orders');

      const dashboardSpy = jest.spyOn(User, 'getStats').mockImplementation(() => {
        throw new Error('Forced admin dashboard catch');
      });
      const dashboardCatch = await agent.get('/admin/dashboard');
      expect(dashboardCatch.statusCode).toBe(302);
      expect(dashboardCatch.headers.location).toBe('/');
      dashboardSpy.mockRestore();

      const usersSpy = jest.spyOn(User, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin users catch');
      });
      const usersCatch = await agent.get('/admin/users?role=customer&status=active&search=boom');
      expect(usersCatch.statusCode).toBe(302);
      expect(usersCatch.headers.location).toContain('/admin/dashboard');
      usersSpy.mockRestore();

      const artisansSpy = jest.spyOn(ArtisanProfile, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin artisans catch');
      });
      const artisansCatch = await agent.get('/admin/artisans?approved=false&search=boom');
      expect(artisansCatch.statusCode).toBe(302);
      expect(artisansCatch.headers.location).toContain('/admin/dashboard');
      artisansSpy.mockRestore();

      const productsSpy = jest.spyOn(Product, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin products catch');
      });
      const productsCatch = await agent.get('/admin/products?status=pending&search=boom');
      expect(productsCatch.statusCode).toBe(302);
      expect(productsCatch.headers.location).toContain('/admin/dashboard');
      productsSpy.mockRestore();

      const categoriesSpy = jest.spyOn(Category, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin categories catch');
      });
      const categoriesCatch = await agent.get('/admin/categories');
      expect(categoriesCatch.statusCode).toBe(302);
      expect(categoriesCatch.headers.location).toContain('/admin/dashboard');
      categoriesSpy.mockRestore();

      const ordersSpy = jest.spyOn(Order, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin orders catch');
      });
      const ordersCatch = await agent.get('/admin/orders?status=pending&payment_status=paid');
      expect(ordersCatch.statusCode).toBe(302);
      expect(ordersCatch.headers.location).toContain('/admin/dashboard');
      ordersSpy.mockRestore();

      const orderItemsSpy = jest.spyOn(Order, 'getItems').mockImplementation(() => {
        throw new Error('Forced admin order detail catch');
      });
      const orderDetailCatch = await agent.get(`/admin/orders/${ids.orderId}`);
      expect(orderDetailCatch.statusCode).toBe(302);
      expect(orderDetailCatch.headers.location).toContain('/admin/orders');
      orderItemsSpy.mockRestore();

      const auctionsSpy = jest.spyOn(Auction, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin auctions catch');
      });
      const auctionsCatch = await agent.get('/admin/auctions?status=active');
      expect(auctionsCatch.statusCode).toBe(302);
      expect(auctionsCatch.headers.location).toContain('/admin/dashboard');
      auctionsSpy.mockRestore();

      const reviewsSpy = jest.spyOn(Review, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin reviews catch');
      });
      const reviewsCatch = await agent.get('/admin/reviews?status=visible');
      expect(reviewsCatch.statusCode).toBe(302);
      expect(reviewsCatch.headers.location).toContain('/admin/dashboard');
      reviewsSpy.mockRestore();

      const couponsSpy = jest.spyOn(Coupon, 'findAll').mockImplementation(() => {
        throw new Error('Forced admin coupons catch');
      });
      const couponsCatch = await agent.get('/admin/coupons');
      expect(couponsCatch.statusCode).toBe(302);
      expect(couponsCatch.headers.location).toContain('/admin/dashboard');
      couponsSpy.mockRestore();

      const prepareSpy = jest.spyOn(db, 'prepare').mockImplementation(() => {
        throw new Error('Forced reports catch');
      });
      const reportsCatch = await agent.get('/admin/reports?period=month');
      expect(reportsCatch.statusCode).toBe(302);
      expect(reportsCatch.headers.location).toContain('/admin/dashboard');
      prepareSpy.mockRestore();
    });

  });
};
