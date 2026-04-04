const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csrf = require('csurf');
const methodOverride = require('method-override');

// Load environment variables
require('dotenv').config();

// Initialize database
const { initDatabase, getDb } = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('jest'));
const trustProxyEnv = process.env.TRUST_PROXY;
const trustProxyEnabled = typeof trustProxyEnv === 'string'
  && trustProxyEnv.length > 0
  && !['false', '0'].includes(trustProxyEnv.toLowerCase());
const backgroundTasksEnv = process.env.RUN_BACKGROUND_TASKS;
const backgroundTasksEnabled = typeof backgroundTasksEnv === 'string'
  ? !['false', '0'].includes(backgroundTasksEnv.toLowerCase())
  : true;
const PORT = process.env.PORT || 3000;
const defaultUploadDir = path.join(__dirname, '.uploads');
const legacyUploadDir = path.join(__dirname, 'public', 'uploads');
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : defaultUploadDir;
const sessionStorePath = process.env.SESSION_STORE_PATH
  ? path.resolve(process.env.SESSION_STORE_PATH)
  : path.join(__dirname, '.sessions');
const sessionSecret = process.env.SESSION_SECRET || (isTest ? 'craftify-test-secret' : null);
const enableNonProdCsp = ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_NON_PROD_CSP || '').toLowerCase());
const socketBidWindowMs = Number.parseInt(process.env.SOCKET_BID_WINDOW_MS || '60000', 10);
const socketBidMaxPerWindow = Number.parseInt(process.env.SOCKET_BID_MAX_PER_WINDOW || '12', 10);
const socketBidBaseBlockMs = Number.parseInt(process.env.SOCKET_BID_BLOCK_MS || '30000', 10);
const socketBidRateState = new Map();
let lastSocketBidCleanupAt = 0;
let cartCountWarningLogged = false;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!isTest && !fs.existsSync(sessionStorePath)) {
  fs.mkdirSync(sessionStorePath, { recursive: true });
}

if (!sessionSecret) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

// Make io available to routes
app.set('io', io);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use(helmet({
  contentSecurityPolicy: (isProduction || enableNonProdCsp) && !isTest
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"]
        }
      }
    : false,
  crossOriginEmbedderPolicy: false
}));

// Trust proxy only when explicitly configured.
if (trustProxyEnabled) {
  const parsedProxyHops = Number.parseInt(trustProxyEnv, 10);
  const trustProxySetting = Number.isNaN(parsedProxyHops)
    ? (trustProxyEnv === 'true' ? 1 : trustProxyEnv)
    : parsedProxyHops;
  app.set('trust proxy', trustProxySetting);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
const uploadStaticOptions = {
  dotfiles: 'deny',
  index: false,
  fallthrough: true
};
app.use('/uploads', express.static(uploadDir, uploadStaticOptions));
if (path.resolve(uploadDir) !== path.resolve(legacyUploadDir) && fs.existsSync(legacyUploadDir)) {
  app.use('/uploads', express.static(legacyUploadDir, uploadStaticOptions));
}
app.use(cookieParser());

// Session configuration
let sessionStore;
if (!isTest) {
  try {
    const FileStore = require('session-file-store')(session);
    sessionStore = new FileStore({
      path: sessionStorePath,
      ttl: 24 * 60 * 60,
      retries: 1,
      logFn: () => {}
    });
  } catch (err) {
    if (isProduction && !process.env.JEST_WORKER_ID) {
      console.error('FATAL: Session file store is required in production.');
      process.exit(1);
    }
    console.warn('Session file store unavailable, using in-memory session store.');
  }
}

const sessionMiddleware = session({
  secret: sessionSecret,
  name: 'craftify.sid',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: trustProxyEnabled,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});
app.use(sessionMiddleware);

// CSRF protection (skip during tests)
if (!isTest) {
  const csrfProtection = csrf({
    cookie: {
      key: '_csrf',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction
    }
  });

  app.use((req, res, next) => {
    // Allow read-only API endpoints without CSRF checks.
    if (req.path.startsWith('/api/') && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    csrfProtection(req, res, next);
  });

  // Make CSRF token available to all views
  app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    next();
  });
}

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
  res.locals.currentPath = req.path;
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
    if (!cartCountWarningLogged && !isTest) {
      cartCountWarningLogged = true;
      console.warn('Cart/notification count middleware skipped:', err.message);
    }
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
const Auction = require('./models/Auction');
const Notification = require('./models/Notification');

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
// Reuse express-session for sockets so authenticated users can bid in real time.
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
  const sessionUser = socket.request?.session?.user;
  if (sessionUser && sessionUser.id && sessionUser.status !== 'suspended') {
    socket.data.user = sessionUser;
    socket.data.authenticated = true;
  } else {
    socket.data.user = null;
    socket.data.authenticated = false;
  }
  next();
});

function cleanupSocketBidRateState(now) {
  if (now - lastSocketBidCleanupAt < socketBidWindowMs) {
    return;
  }

  lastSocketBidCleanupAt = now;
  const staleThreshold = now - Math.max(socketBidWindowMs, socketBidBaseBlockMs) * 4;
  socketBidRateState.forEach((entry, key) => {
    if ((entry.lastSeen || 0) < staleThreshold && (entry.blockedUntil || 0) < now) {
      socketBidRateState.delete(key);
    }
  });
}

function consumeSocketBidAllowance(userId, auctionId) {
  const now = Date.now();
  cleanupSocketBidRateState(now);

  const key = `${userId}:${auctionId}`;
  const entry = socketBidRateState.get(key) || {
    timestamps: [],
    blockedUntil: 0,
    strikes: 0,
    lastSeen: now
  };

  entry.lastSeen = now;
  entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < socketBidWindowMs);

  if (entry.blockedUntil > now) {
    socketBidRateState.set(key, entry);
    return {
      allowed: false,
      retryAfterMs: entry.blockedUntil - now
    };
  }

  if (entry.timestamps.length >= socketBidMaxPerWindow) {
    entry.strikes += 1;
    const penaltyMs = Math.min(socketBidBaseBlockMs * entry.strikes, 5 * 60 * 1000);
    entry.blockedUntil = now + penaltyMs;
    entry.timestamps = [];
    socketBidRateState.set(key, entry);
    return {
      allowed: false,
      retryAfterMs: penaltyMs
    };
  }

  entry.blockedUntil = 0;
  entry.timestamps.push(now);
  socketBidRateState.set(key, entry);
  return { allowed: true };
}

io.on('connection', (socket) => {
  socket.on('joinAuction', (auctionId) => {
    const parsedAuctionId = Number.parseInt(auctionId, 10);
    if (!Number.isInteger(parsedAuctionId) || parsedAuctionId <= 0) {
      return;
    }
    socket.join(`auction-${parsedAuctionId}`);
  });
  
  socket.on('placeBid', async (data) => {
    try {
      const { auctionId, amount } = data;
      const parsedAuctionId = Number.parseInt(auctionId, 10);

      if (!Number.isInteger(parsedAuctionId) || parsedAuctionId <= 0) {
        socket.emit('bidError', { message: 'Invalid auction' });
        return;
      }
      
      // Socket.IO authentication: reject unauthenticated bid attempts
      if (!socket.data.authenticated || !socket.data.user) {
        socket.emit('bidError', { message: 'Please log in to place a bid' });
        return;
      }

      const parsedAmount = Number.parseFloat(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        socket.emit('bidError', { message: 'Invalid bid amount' });
        return;
      }

      const userId = socket.data.user.id;
      const allowance = consumeSocketBidAllowance(userId, parsedAuctionId);
      if (!allowance.allowed) {
        const retrySeconds = Math.max(Math.ceil(allowance.retryAfterMs / 1000), 1);
        socket.emit('bidError', {
          message: `Too many bids. Please wait ${retrySeconds}s before trying again.`
        });
        return;
      }

      const result = Auction.placeBid(parsedAuctionId, userId, parsedAmount);

      if (result.previousBidderId && result.previousBidderId !== userId) {
        Notification.auctionOutbid(
          result.previousBidderId,
          parsedAuctionId,
          result.auction.title || result.auction.product_name
        );
      }

      const bidUpdatePayload = {
        auctionId: parsedAuctionId,
        amount: result.bid.amount,
        currentBid: result.auction.current_highest_bid,
        bidCount: result.auction.bid_count,
        bidderId: userId,
        bidderName: socket.data.user.name || 'Anonymous',
        bidIncrement: result.auction.bid_increment,
        bidTime: result.bid.bid_time || result.bid.created_at
      };

      io.to(`auction-${parsedAuctionId}`).emit('bidUpdate', bidUpdatePayload);
      
    } catch (err) {
      console.error('Bid error:', err);
      const message = typeof err?.message === 'string' ? err.message : '';
      const isUserFacingValidationError = [
        'Invalid bid amount',
        'Auction not found',
        'Auction is not active',
        'Auction has ended',
        'You cannot bid on your own auction'
      ].includes(message) || /^Minimum bid is \$\d+\.\d{2}$/.test(message);

      socket.emit('bidError', {
        message: isUserFacingValidationError ? message : 'Failed to place bid'
      });
    }
  });
  
  socket.on('leaveAuction', (auctionId) => {
    const parsedAuctionId = Number.parseInt(auctionId, 10);
    if (!Number.isInteger(parsedAuctionId) || parsedAuctionId <= 0) {
      return;
    }
    socket.leave(`auction-${parsedAuctionId}`);
  });
  
  socket.on('disconnect', () => {
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
  // Handle CSRF errors specifically
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('errors/500', {
      title: 'Invalid Form Submission',
      error: isProduction ? 'Form submission expired. Please refresh and try again.' : err.message,
      user: req.session?.user || null,
      currentPath: req.path
    });
  }
  res.status(500).render('errors/500', {
    title: 'Server Error',
    error: isProduction ? 'An unexpected error occurred' : err.message,
    user: req.session?.user || null,
    currentPath: req.path
  });
});

async function startServer(port = PORT) {
  await initDatabase();
  // Skip background tasks in test mode; allow env-level disable for multi-instance deployments.
  if (!isTest && backgroundTasksEnabled) {
    startBackgroundTasks();
  }
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

/* istanbul ignore next */
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

module.exports = { app, io, server, startServer };
