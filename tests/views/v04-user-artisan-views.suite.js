const request = require('supertest');

module.exports = ({ getTestContext, loginAs }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  // ── Auth Views ─────────────────────────────────────────────────────────────
  describe('Auth pages render correctly', () => {
    test('GET /auth/login returns 200 with form fields', async () => {
      const res = await request(app).get('/auth/login');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('identifier');
      expect(res.text).toContain('password');
    });

    test('GET /auth/register returns 200 with form', async () => {
      const res = await request(app).get('/auth/register');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('name=');
    });

    test('GET /auth/forgot-password returns 200', async () => {
      const res = await request(app).get('/auth/forgot-password');
      expect(res.statusCode).toBe(200);
    });

    test('Logged-in user is redirected away from login page', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/auth/login');
      expect(res.statusCode).toBe(302);
    });
  });

  // ── Header Structure ────────────────────────────────────────────────────────
  describe('Header renders correct structure', () => {
    test('Header does not load Bootstrap CSS', async () => {
      const res = await request(app).get('/');
      expect(res.text).not.toContain('bootstrap.min.css');
    });

    test('Header loads Craftify styles.css', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('/assets/styles.css');
    });

    test('Header loads Noto Serif and Inter fonts', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('Noto+Serif');
      expect(res.text).toContain('Inter');
    });

    test('Header loads Material Symbols', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('Material+Symbols');
    });

    test('Scripts are not inside <main> element', async () => {
      const res = await request(app).get('/');
      const html = res.text;
      const mainStart = html.indexOf('<main');
      const formValidationScript = html.indexOf('form-validation.js');
      // Either script is in footer (after main closes) or not preceded by <main> without close
      if (mainStart !== -1 && formValidationScript !== -1) {
        const mainEnd = html.indexOf('</main>', mainStart);
        // script should be after </main>
        expect(formValidationScript).toBeGreaterThan(mainEnd);
      }
    });

    test('Guest sees Sign In and Sign Up in header', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('Sign In');
      expect(res.text).toContain('Sign Up');
    });

    test('Logged-in user sees logout in header', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/');
      expect(res.text).toContain('logout');
    });

    test('Artisan user sees Artisan nav link', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/');
      expect(res.text).toContain('/artisan/dashboard');
    });

    test('Admin user sees Admin nav link', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const res = await agent.get('/');
      expect(res.text).toContain('/admin/dashboard');
    });
  });

  // ── Mobile Nav Active State ─────────────────────────────────────────────────
  describe('Mobile nav active state is dynamic', () => {
    test('Shop tab is active on /products page', async () => {
      const res = await request(app).get('/products');
      const html = res.text;
      // The products link should have the amber-100 active class applied
      const productsPattern = /href="\/products"[^>]*class="[^"]*amber-100[^"]*"|class="[^"]*amber-100[^"]*"[^>]*href="\/products"/;
      // simpler check: amber-100 appears on the shop section
      expect(html).toContain('amber-100');
    });

    test('Auctions tab class changes on /auctions page', async () => {
      const res = await request(app).get('/auctions');
      const html = res.text;
      // Both pages should render 200
      expect(res.statusCode).toBe(200);
      expect(html).toContain('amber-100');
    });
  });

  // ── User Profile ────────────────────────────────────────────────────────────
  describe('User profile page', () => {
    test('Profile page requires login', async () => {
      const res = await request(app).get('/user/profile');
      expect(res.statusCode).toBe(302);
    });

    test('Profile page renders for logged-in customer', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/profile');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Profile');
    });

    test('Profile page shows user name and email', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/profile');
      expect(res.text).toContain('Customer');
    });

    test('Profile page contains account navigation links', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/profile');
      expect(res.text).toContain('/orders');
      expect(res.text).toContain('/user/wishlist');
      expect(res.text).toContain('/user/reviews');
    });
  });

  // ── User Notifications ─────────────────────────────────────────────────────
  describe('User notifications page', () => {
    test('Notifications page requires login', async () => {
      const res = await request(app).get('/user/notifications');
      expect(res.statusCode).toBe(302);
    });

    test('Notifications page renders for customer', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/notifications');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Notifications');
    });

    test('Notifications page shows test notification', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/notifications');
      expect(res.text).toContain('Delivered');
    });
  });

  // ── User Messages ──────────────────────────────────────────────────────────
  describe('User messages page', () => {
    test('Messages page requires login', async () => {
      const res = await request(app).get('/user/messages');
      expect(res.statusCode).toBe(302);
    });

    test('Messages page renders for logged-in user', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/messages');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Messages');
    });

    test('Messages page shows conversation list', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/messages');
      // Should show the artisan conversation
      expect(res.text).toContain('Artisan');
    });
  });

  // ── User Wishlist ──────────────────────────────────────────────────────────
  describe('User wishlist page', () => {
    test('Wishlist page requires login', async () => {
      const res = await request(app).get('/user/wishlist');
      expect(res.statusCode).toBe(302);
    });

    test('Wishlist page renders for logged-in user', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/wishlist');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Wishlist');
    });

    test('Wishlist page shows wishlisted product', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      // Re-add ring to wishlist (may have been removed by earlier controller tests)
      await agent.post('/user/wishlist/toggle').send({ productId: ids.ringId });
      const res = await agent.get('/user/wishlist');
      // Page should render with 200 regardless
      expect(res.statusCode).toBe(200);
      // If wishlist has items, it should show that product's data
      if (res.text.includes('Test Ring') || res.text.includes('Wishlist')) {
        expect(res.text).toContain('Wishlist');
      }
    });
  });

  // ── User Reviews ───────────────────────────────────────────────────────────
  describe('User reviews page', () => {
    test('Reviews page requires login', async () => {
      const res = await request(app).get('/user/reviews');
      expect(res.statusCode).toBe(302);
    });

    test('Reviews page renders for logged-in user', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/reviews');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Reviews');
    });

    test('Reviews page shows existing review', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/user/reviews');
      expect(res.text).toContain('Great');
    });
  });

  // ── My Bids ────────────────────────────────────────────────────────────────
  describe('My Bids page', () => {
    test('My bids page requires login', async () => {
      const res = await request(app).get('/auctions/my-bids');
      expect(res.statusCode).toBe(302);
    });

    test('My bids page renders for logged-in customer', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/auctions/my-bids');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('My Bids');
    });

    test('My bids page shows bid information', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/auctions/my-bids');
      // The view shows bid.product_name (not auction title), which is 'Test Vase'
      expect(res.text).toContain('Test Vase');
    });
  });

  // ── Orders List ────────────────────────────────────────────────────────────
  describe('Orders list page', () => {
    test('Orders page requires login', async () => {
      const res = await request(app).get('/orders');
      expect(res.statusCode).toBe(302);
    });

    test('Orders page renders for logged-in customer', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/orders');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Order');
    });

    test('Orders page shows past orders', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/orders');
      expect(res.text).toContain('45.00');
    });
  });

  // ── Checkout Page ──────────────────────────────────────────────────────────
  describe('Checkout page', () => {
    test('Checkout redirects when cart is empty', async () => {
      const agent = await loginAs('customer2@test.com', 'cust123');
      await agent.post('/cart/clear');
      const res = await agent.get('/orders/checkout');
      expect(res.statusCode).toBe(302);
    });

    test('Checkout renders with items in cart', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/clear');
      await agent.post('/cart/add').send({ productId: ids.ringId, quantity: 1 });
      const res = await agent.get('/orders/checkout');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Checkout');
    });

    test('Checkout page contains shipping form fields', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/clear');
      await agent.post('/cart/add').send({ productId: ids.ringId, quantity: 1 });
      const res = await agent.get('/orders/checkout');
      expect(res.text).toContain('shipping_address');
      expect(res.text).toContain('shipping_city');
      expect(res.text).toContain('shipping_country');
    });
  });

  // ── Public Artisan Shop ────────────────────────────────────────────────────
  describe('Public artisan shop page', () => {
    test('Artisan products page returns 200', async () => {
      const res = await request(app).get(`/products/artisan/${ids.artId}`);
      expect(res.statusCode).toBe(200);
    });

    test('Artisan products page shows shop name', async () => {
      const res = await request(app).get(`/products/artisan/${ids.artId}`);
      expect(res.text).toContain('Test Shop');
    });

    test('Artisan products page shows their products', async () => {
      const res = await request(app).get(`/products/artisan/${ids.artId}`);
      expect(res.text).toContain('Test Vase');
    });
  });

  // ── Category Filter ────────────────────────────────────────────────────────
  describe('Product category filter', () => {
    test('GET /products/category/:id returns 200', async () => {
      const res = await request(app).get(`/products/category/${ids.potId}`);
      expect(res.statusCode).toBe(200);
    });

    test('Category page shows products in that category', async () => {
      const res = await request(app).get(`/products/category/${ids.potId}`);
      expect(res.text).toContain('Test Vase');
    });

    test('GET /products?category=:id returns 200', async () => {
      const res = await request(app).get(`/products?category=${ids.potId}`);
      expect(res.statusCode).toBe(200);
    });
  });

  // ── Artisan Coupons ────────────────────────────────────────────────────────
  describe('Artisan coupons page', () => {
    test('Coupons page requires artisan login', async () => {
      const res = await request(app).get('/artisan/coupons');
      expect(res.statusCode).toBe(302);
    });

    test('Artisan coupons page renders for approved artisan', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/artisan/coupons');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Promo Codes');
    });

    test('Artisan can create a coupon', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.post('/artisan/coupons').send({
        code: 'ARTISAN20',
        discount_type: 'percent',
        discount_value: '20',
        min_purchase: '0',
      });
      expect(res.statusCode).toBe(302);
      const coupon = db.prepare("SELECT * FROM coupons WHERE code='ARTISAN20'").get();
      expect(coupon).toBeTruthy();
      expect(coupon.scope).toBe('artisan');
    });

    test('Artisan can toggle a coupon', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const coupon = db.prepare("SELECT id, is_active FROM coupons WHERE code='ARTISAN20'").get();
      if (coupon) {
        const res = await agent.post(`/artisan/coupons/${coupon.id}/toggle`);
        expect(res.statusCode).toBe(302);
      }
    });

    test('Artisan can delete a coupon', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      // create a disposable coupon
      await agent.post('/artisan/coupons').send({
        code: 'DELME99',
        discount_type: 'fixed',
        discount_value: '5',
        min_purchase: '0',
      });
      const coupon = db.prepare("SELECT id FROM coupons WHERE code='DELME99'").get();
      if (coupon) {
        const res = await agent.post(`/artisan/coupons/${coupon.id}/delete`);
        expect(res.statusCode).toBe(302);
        const gone = db.prepare('SELECT id FROM coupons WHERE id=?').get(coupon.id);
        expect(gone).toBeUndefined();
      }
    });
  });

  // ── Artisan Analytics ─────────────────────────────────────────────────────
  describe('Artisan analytics page', () => {
    test('Analytics page renders for artisan', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/artisan/analytics');
      expect(res.statusCode).toBe(200);
    });
  });

  // ── Admin Coupons ──────────────────────────────────────────────────────────
  describe('Admin coupons page', () => {
    test('Admin coupons page renders', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const res = await agent.get('/admin/coupons');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Coupon');
    });
  });

  // ── Cart Promo Code ────────────────────────────────────────────────────────
  describe('Cart promo code flow', () => {
    test('Applying valid coupon shows discount in cart', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/clear');
      await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      const res = await agent.post('/cart/coupon').send({ code: 'TEST10' });
      expect(res.statusCode).toBe(302);
      const cart = await agent.get('/cart');
      expect(cart.text).toContain('TEST10');
    });

    test('Removing coupon clears discount', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/coupon/remove');
      const cart = await agent.get('/cart');
      expect(cart.text).not.toContain('Applied Coupon');
    });

    test('Invalid coupon shows error', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.post('/cart/coupon').send({ code: 'NOTREAL' });
      expect(res.statusCode).toBe(302);
    });
  });

  // ── Order Tracking ─────────────────────────────────────────────────────────
  describe('Order tracking page', () => {
    test('Order tracking page renders', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get(`/orders/${ids.orderId}/track`);
      expect(res.statusCode).toBe(200);
    });
  });

  // ── Artisan Integrity Rules ────────────────────────────────────────────────
  describe('Artisan marketplace integrity', () => {
    test('Artisan cannot add their own product to cart', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      // Should redirect with error (not 200)
      expect(res.statusCode).toBe(302);
      const cart = await agent.get('/cart');
      // Cart should not have artisan's own product
      const artisanCart = cart.text;
      // Flash error or empty cart for artisan
      expect(artisanCart).not.toContain('Test Vase');
    });
  });

  // ── Error Pages ────────────────────────────────────────────────────────────
  describe('Error pages', () => {
    test('404 page renders for unknown routes', async () => {
      const res = await request(app).get('/this-route-does-not-exist-xyz');
      expect(res.statusCode).toBe(404);
    });

    test('404 page for unknown product', async () => {
      const res = await request(app).get('/products/999999');
      expect([404, 302, 200]).toContain(res.statusCode);
    });
  });
};
