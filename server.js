const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Initialize database
const { initDatabase, getDb } = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Make io available to routes
app.set('io', io);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Session configuration
app.use(session({
  secret: 'craftify-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.cartCount = 0;
  res.locals.notificationCount = 0;
  next();
});

// Cart count middleware
app.use(async (req, res, next) => {
  try {
    const db = getDb();
    if (req.session.user) {
      const count = db.prepare('SELECT SUM(quantity) as count FROM cart_items WHERE user_id = ?').get(req.session.user.id);
      res.locals.cartCount = count?.count || 0;
      
      // Notification count
      const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.session.user.id);
      res.locals.notificationCount = notifCount?.count || 0;
    } else if (req.sessionID) {
      const count = db.prepare('SELECT SUM(quantity) as count FROM cart_items WHERE session_id = ?').get(req.sessionID);
      res.locals.cartCount = count?.count || 0;
    }
  } catch (err) {
    // Database might not be initialized yet
  }
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const auctionRoutes = require('./routes/auctions');
const artisanRoutes = require('./routes/artisan');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const apiRoutes = require('./routes/api');

app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/auctions', auctionRoutes);
app.use('/artisan', artisanRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);
app.use('/api', apiRoutes);

// Socket.io for real-time auctions
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('joinAuction', (auctionId) => {
    socket.join(`auction-${auctionId}`);
    console.log(`User ${socket.id} joined auction ${auctionId}`);
  });
  
  socket.on('placeBid', async (data) => {
    try {
      const db = getDb();
      const { auctionId, amount } = data;
      const userId = socket.handshake.session?.user?.id;
      
      if (!userId) {
        socket.emit('bidError', { message: 'Please log in to place a bid' });
        return;
      }
      
      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction || auction.status !== 'active') {
        socket.emit('bidError', { message: 'Auction is not active' });
        return;
      }
      
      const minBid = (auction.current_highest_bid || auction.starting_price) + auction.bid_increment;
      if (amount < minBid) {
        socket.emit('bidError', { message: `Minimum bid is $${minBid.toFixed(2)}` });
        return;
      }
      
      // Update previous winning bid
      db.prepare('UPDATE bids SET is_winning = 0 WHERE auction_id = ? AND is_winning = 1').run(auctionId);
      
      // Insert new bid
      db.prepare('INSERT INTO bids (auction_id, user_id, amount, is_winning) VALUES (?, ?, ?, 1)').run(auctionId, userId, amount);
      
      // Update auction
      db.prepare('UPDATE auctions SET current_highest_bid = ?, winner_id = ? WHERE id = ?').run(amount, userId, auctionId);
      
      // Get bidder info
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
      
      // Emit to all in auction room
      io.to(`auction-${auctionId}`).emit('bidUpdate', {
        auctionId,
        amount,
        currentBid: amount,
        bidCount: db.prepare('SELECT COUNT(*) as count FROM bids WHERE auction_id = ?').get(auctionId).count,
        bidderName: user?.name || 'Anonymous',
        bidIncrement: auction.bid_increment
      });
      
    } catch (err) {
      console.error('Bid error:', err);
      socket.emit('bidError', { message: 'Failed to place bid' });
    }
  });
  
  socket.on('leaveAuction', (auctionId) => {
    socket.leave(`auction-${auctionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Background tasks
function startBackgroundTasks() {
  // Shipment status update simulation (runs every minute)
  setInterval(() => {
    try {
      const db = getDb();
      const shipments = db.prepare(`
        SELECT * FROM shipments 
        WHERE status NOT IN ('delivered', 'failed')
      `).all();
      
      const statusFlow = ['pending', 'processing', 'shipped', 'in_transit', 'delivered'];
      
      shipments.forEach(shipment => {
        const currentIndex = statusFlow.indexOf(shipment.status);
        if (currentIndex < statusFlow.length - 1 && Math.random() > 0.7) {
          const newStatus = statusFlow[currentIndex + 1];
          const history = JSON.parse(shipment.history || '[]');
          history.push({
            status: newStatus,
            timestamp: new Date().toISOString(),
            location: getRandomLocation()
          });
          
          db.prepare(`
            UPDATE shipments 
            SET status = ?, history = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newStatus, JSON.stringify(history), shipment.id);
          
          // Update order status if shipped or delivered
          if (newStatus === 'shipped' || newStatus === 'delivered') {
            db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, shipment.order_id);
          }
          
          // Create notification for customer
          const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(shipment.order_id);
          if (order) {
            db.prepare(`
              INSERT INTO notifications (user_id, title, message, type, link)
              VALUES (?, ?, ?, 'order', ?)
            `).run(
              order.user_id,
              'Shipment Update',
              `Your order #${shipment.order_id} is now ${newStatus.replace('_', ' ')}`,
              `/orders/${shipment.order_id}`
            );
          }
        }
      });
    } catch (err) {
      console.error('Shipment update error:', err);
    }
  }, 60000);

  // Auction end check (runs every 30 seconds)
  setInterval(() => {
    try {
      const db = getDb();
      const now = new Date().toISOString();
      
      const endedAuctions = db.prepare(`
        SELECT a.*, p.name as product_name 
        FROM auctions a
        JOIN products p ON a.product_id = p.id
        WHERE a.status = 'active' AND a.end_time <= ?
      `).all(now);
      
      endedAuctions.forEach(auction => {
        if (auction.winner_id) {
          db.prepare("UPDATE auctions SET status = 'sold' WHERE id = ?").run(auction.id);
          
          // Notify winner
          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, link)
            VALUES (?, ?, ?, 'auction', ?)
          `).run(
            auction.winner_id,
            'Congratulations! You won!',
            `You won the auction for "${auction.product_name}" with a bid of $${auction.current_highest_bid}`,
            `/auctions/${auction.id}`
          );
        } else {
          db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(auction.id);
        }
        
        // Notify artisan
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, link)
          VALUES (?, ?, ?, 'auction', ?)
        `).run(
          auction.artisan_id,
          'Auction Ended',
          auction.winner_id 
            ? `Your auction for "${auction.product_name}" ended with winning bid of $${auction.current_highest_bid}`
            : `Your auction for "${auction.product_name}" ended with no bids`,
          `/artisan/auctions`
        );
        
        // Emit socket event
        io.to(`auction-${auction.id}`).emit('auctionEnded', {
          auctionId: auction.id,
          winnerId: auction.winner_id,
          winningBid: auction.current_highest_bid
        });
      });
      
      // Activate pending auctions
      db.prepare(`
        UPDATE auctions SET status = 'active'
        WHERE status = 'pending' AND start_time <= ? AND end_time > ?
      `).run(now, now);
      
    } catch (err) {
      console.error('Auction check error:', err);
    }
  }, 30000);
}

function getRandomLocation() {
  const locations = [
    'Manama Sorting Center',
    'Riffa Distribution Hub',
    'Muharraq Warehouse',
    'Isa Town Depot',
    'Hamad Town Facility',
    'Local Delivery Station',
    'Out for Delivery'
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

// Error handling
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', { title: 'Server Error', error: err.message });
});

// Start server after database initialization
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  startBackgroundTasks();
  
  server.listen(PORT, () => {
    console.log(`🚀 Craftify server running on http://localhost:${PORT}`);
    console.log(`📦 Database initialized`);
    console.log(`🔄 Real-time auctions enabled`);
    console.log(`📬 Shipment tracking simulation active`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = { app, io };
