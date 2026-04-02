// Authentication middleware

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/auth/login');
};

const isGuest = (req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  res.redirect('/');
};

const isCustomer = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'customer') {
    return next();
  }
  req.flash('error_msg', 'Access denied');
  res.redirect('/');
};

const isArtisan = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'artisan') {
    return next();
  }
  req.flash('error_msg', 'Access denied. Artisan account required.');
  res.redirect('/');
};

const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'Access denied. Admin privileges required.');
  res.redirect('/');
};

const isApprovedArtisan = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'artisan') {
    const { getDb } = require('../config/database');
    try {
      const db = getDb();
      const profile = db.prepare('SELECT is_approved FROM artisan_profiles WHERE user_id = ?').get(req.session.user.id);
      if (profile && profile.is_approved) {
        return next();
      }
    } catch (e) {
      // DB not ready
    }
    req.flash('error_msg', 'Your artisan account is pending approval.');
    res.redirect('/artisan/pending');
  } else {
    req.flash('error_msg', 'Access denied. Artisan account required.');
    res.redirect('/');
  }
};

const isActive = (req, res, next) => {
  if (req.session.user && req.session.user.status === 'active') {
    return next();
  }

  req.flash('error_msg', 'Your account has been suspended. Please contact support.');
  const finishLogout = () => {
    if (typeof res.clearCookie === 'function') {
      res.clearCookie('craftify.sid');
    }
    res.redirect('/auth/login');
  };

  if (!req.session || typeof req.session.destroy !== 'function') {
    finishLogout();
    return;
  }

  if (req.session.destroy.length === 0) {
    req.session.destroy();
    finishLogout();
    return;
  }

  req.session.destroy(() => {
    finishLogout();
  });
};

const attachUser = (req, res, next) => {
  if (req.session.user) {
    req.user = req.session.user;
  }
  next();
};

module.exports = {
  isAuthenticated,
  isGuest,
  isCustomer,
  isArtisan,
  isAdmin,
  isApprovedArtisan,
  isActive,
  attachUser
};
