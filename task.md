# Craftify - E-commerce Platform for Local Artisans
## Implementation Task List

### Project Overview
A fully functional e-commerce website connecting local artisans with customers, featuring MVC architecture, real-time auctions, mock payments, and simulated shipment tracking.

**Tech Stack Decision:**
- **Backend:** Node.js with Express.js (MVC architecture)
- **Database:** SQLite with better-sqlite3 (simple, no setup needed, runs out-of-box on Replit)
- **Frontend:** EJS templates (server-side rendering for MVC compliance)
- **Real-time:** Socket.io (for live auction bidding)
- **Auth:** bcryptjs + express-session
- **Payment:** Simulated Stripe-like mock gateway
- **Shipping:** Simulated tracking with fake status updates

---

## Phase 1: Project Setup & Core Infrastructure
- [ ] Initialize Node.js project with package.json
- [ ] Create MVC folder structure (models, views, controllers, routes, public, config)
- [ ] Set up Express server with middleware (body-parser, session, static files)
- [ ] Configure SQLite database connection
- [ ] Create database schema/migrations for all entities
- [ ] Set up EJS view engine
- [ ] Create base layout template with header/footer

## Phase 2: User Authentication & Profiles
- [ ] User model (Customer, Artisan, Admin roles)
- [ ] Registration controller & views (customer registration)
- [ ] Login/Logout functionality
- [ ] Password encryption with bcrypt
- [ ] Session management
- [ ] Password reset flow (simulated email)
- [ ] Artisan registration (multi-step: shop details, bio, profile image)
- [ ] User profile management (view/edit profile)
- [ ] Account status (active/suspended)

## Phase 3: Product Catalog & Categories
- [ ] Category model
- [ ] Product model (with images, description, price, stock)
- [ ] Product CRUD operations for artisans
- [ ] Product browsing page with filters
- [ ] Product search functionality
- [ ] Product detail page
- [ ] Product categories/filtering
- [ ] Inventory management (stock levels)
- [ ] Product approval workflow (admin)

## Phase 4: Shopping Cart & Wishlist
- [ ] Cart model
- [ ] Add to cart functionality
- [ ] Update cart quantities
- [ ] Remove items from cart
- [ ] Cart total calculation
- [ ] Wishlist model
- [ ] Add/remove items from wishlist
- [ ] View wishlist page

## Phase 5: Checkout & Orders
- [ ] Order model
- [ ] OrderItem model
- [ ] Checkout flow (address, payment selection)
- [ ] Mock payment gateway integration
- [ ] Order confirmation page
- [ ] Order history for customers
- [ ] Order management for artisans
- [ ] Order status updates

## Phase 6: Shipment Tracking
- [ ] Shipment model
- [ ] Create shipment on order completion
- [ ] Simulated status updates (pending -> processing -> shipped -> in_transit -> delivered)
- [ ] Background job to auto-update shipment status
- [ ] Order tracking page for customers
- [ ] Tracking number generation

## Phase 7: Reviews & Ratings
- [ ] Review model
- [ ] Create review for purchased products
- [ ] Rating system (1-5 stars)
- [ ] Display reviews on product pages
- [ ] Review moderation (admin)
- [ ] Average rating calculation

## Phase 8: Auctions with Real-time Bidding
- [ ] Auction model
- [ ] Bid model
- [ ] Auction creation by artisans
- [ ] Live auction page with real-time updates (Socket.io)
- [ ] Bid validation (must exceed current highest)
- [ ] Outbid notifications
- [ ] Auction end detection (cron/interval)
- [ ] Winner notification
- [ ] Convert auction win to order

## Phase 9: Artisan Dashboard
- [ ] Dashboard overview (sales stats, recent orders)
- [ ] Product management interface
- [ ] Inventory updates
- [ ] Order management
- [ ] Sales reports/analytics
- [ ] Auction management
- [ ] Shipping settings
- [ ] Promotional tools (discounts, featured products)

## Phase 10: Admin Panel
- [ ] Admin dashboard with system stats
- [ ] User account management (approve/suspend/delete)
- [ ] Product listing approval
- [ ] Transaction monitoring
- [ ] Content moderation (reviews)
- [ ] Auction oversight
- [ ] Revenue tracking (commission fees)
- [ ] Report generation
- [ ] Promotional campaigns

## Phase 11: Notifications & Messaging
- [ ] Notification model
- [ ] In-app notification system
- [ ] Notification center page
- [ ] Order status notifications
- [ ] Auction notifications (outbid, win)
- [ ] Messaging model
- [ ] Customer-Artisan messaging
- [ ] Message inbox/conversation view

## Phase 12: Additional Features
- [ ] Discount/coupon model
- [ ] Apply coupons at checkout
- [ ] Featured products section
- [ ] Return/refund request handling
- [ ] Multi-language support (basic i18n)
- [ ] Newsletter subscription

## Phase 13: Seed Data & Demo Content
- [ ] Create seed script with demo data
- [ ] Demo artisans with profiles
- [ ] Sample products across categories
- [ ] Sample auctions (some active, some ended)
- [ ] Sample orders with various statuses
- [ ] Sample reviews
- [ ] Demo admin account
- [ ] Demo customer accounts

## Phase 14: Testing & Polish
- [ ] Test all user flows
- [ ] Fix UI/UX issues
- [ ] Ensure responsive design
- [ ] Error handling
- [ ] Add loading states
- [ ] Security review (XSS, SQL injection prevention)
- [ ] Create README with setup instructions

## Phase 15: Replit Deployment
- [ ] Create .replit configuration
- [ ] Create replit.nix if needed
- [ ] Ensure one-command startup (npm start)
- [ ] Verify database auto-creation
- [ ] Test complete application flow
- [ ] Final verification

---

## Database Schema (SQLite)

### Users
- id, email, password_hash, full_name, role (customer/artisan/admin), status (active/suspended), shipping_address, phone, created_at

### Artisans (extends users)
- user_id, shop_name, bio, profile_image, approved, shipping_methods, created_at

### Categories
- id, name, description, parent_id

### Products
- id, artisan_id, category_id, name, description, price, images (JSON), stock, status (pending/approved/rejected), featured, created_at

### Cart
- id, user_id, created_at

### CartItems
- id, cart_id, product_id, quantity

### Wishlist
- id, user_id, product_id, created_at

### Orders
- id, user_id, shipping_address, total_amount, status, payment_status, transaction_ref, created_at

### OrderItems
- id, order_id, product_id, quantity, unit_price

### Shipments
- id, order_id, carrier, tracking_number, status, last_update

### Reviews
- id, product_id, user_id, rating, comment, status (visible/hidden), created_at

### Auctions
- id, product_id, artisan_id, starting_bid, current_highest_bid, highest_bidder_id, start_time, end_time, status

### Bids
- id, auction_id, user_id, amount, bid_time

### Notifications
- id, user_id, title, message, type, read, created_at

### Messages
- id, sender_id, receiver_id, content, read, created_at

### Coupons
- id, code, discount_type (percent/fixed), discount_value, valid_from, valid_until, usage_limit, times_used

---

## Demo Accounts (to be seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@craftify.com | admin123 |
| Customer | customer@test.com | customer123 |
| Artisan | artisan@test.com | artisan123 |

---

## Notes
- All payments are mock/simulated - no real charges
- Shipment tracking uses fake status updates on a timer
- Real-time auction bidding via Socket.io
- MVC architecture strictly followed
- Runs out-of-box on Replit with `npm start`
