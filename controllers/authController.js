const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');

// Show login page
exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Sign In - Craftify' });
};

// Process login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/login');
    }

    const user = await User.verifyPassword(email, password);
    if (!user) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    if (user.status === 'suspended') {
      req.flash('error_msg', 'Your account has been suspended. Please contact support.');
      return res.redirect('/auth/login');
    }

    // Set session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatar: user.avatar
    };

    // Merge guest cart if exists
    if (req.sessionID) {
      Cart.mergeGuestCart(user.id, req.sessionID);
    }

    // If artisan, get profile
    if (user.role === 'artisan') {
      const profile = ArtisanProfile.findByUserId(user.id);
      req.session.user.artisanProfile = profile;
    }

    req.flash('success_msg', `Welcome back, ${user.name}!`);

    // Redirect based on role
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'artisan') {
      return res.redirect('/artisan/dashboard');
    }
    res.redirect('/');

  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'An error occurred during login');
    res.redirect('/auth/login');
  }
};

// Show registration page
exports.showRegister = (req, res) => {
  res.render('auth/register', { title: 'Create Account - Craftify' });
};

// Process registration
exports.register = async (req, res) => {
  try {
    const { name, email, password, confirm_password, shipping_address, phone } = req.body;

    // Validation
    const errors = [];
    if (!name || !email || !password) {
      errors.push('Please fill in all required fields');
    }
    if (password !== confirm_password) {
      errors.push('Passwords do not match');
    }
    if (password && password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Please enter a valid email address');
    }

    if (errors.length > 0) {
      req.flash('error_msg', errors.join('. '));
      return res.redirect('/auth/register');
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'customer',
      shipping_address: shipping_address || '',
      phone: phone || ''
    });

    req.flash('success_msg', 'Registration successful! Please log in.');
    res.redirect('/auth/login');

  } catch (err) {
    console.error('Registration error:', err);
    if (err.message === 'Email already registered') {
      req.flash('error_msg', 'This email is already registered');
    } else {
      req.flash('error_msg', 'An error occurred during registration');
    }
    res.redirect('/auth/register');
  }
};

// Show artisan registration page
exports.showArtisanRegister = (req, res) => {
  res.render('auth/artisan-register', { title: 'Become an Artisan - Craftify' });
};

// Process artisan registration
exports.registerArtisan = async (req, res) => {
  try {
    const { 
      name, email, password, confirm_password, phone,
      shop_name, bio, return_policy
    } = req.body;

    const errors = [];
    if (!name || !email || !password || !shop_name) {
      errors.push('Please fill in all required fields');
    }
    if (password !== confirm_password) {
      errors.push('Passwords do not match');
    }
    if (password && password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (errors.length > 0) {
      req.flash('error_msg', errors.join('. '));
      return res.redirect('/auth/artisan-register');
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'artisan',
      phone: phone || '',
      status: 'active'
    });

    const profileImage = req.file ? `/uploads/${req.file.filename}` : '';
    ArtisanProfile.create({
      user_id: user.id,
      shop_name,
      bio: bio || '',
      profile_image: profileImage,
      return_policy: return_policy || ''
    });

    Notification.create({
      user_id: user.id,
      title: 'Welcome to Craftify!',
      message: "Your artisan application is under review. You'll be notified once approved.",
      type: 'system'
    });

    req.flash('success_msg', 'Artisan registration successful! Your account is pending approval.');
    res.redirect('/auth/login');

  } catch (err) {
    console.error('Artisan registration error:', err);
    if (err.message === 'Email already registered') {
      req.flash('error_msg', 'This email is already registered');
    } else {
      req.flash('error_msg', 'An error occurred during registration');
    }
    res.redirect('/auth/artisan-register');
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
};

// Forgot password
exports.showForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password - Craftify' });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = User.findByEmail(email);
    const db = getDb();

    if (!user) {
      req.flash('success_msg', 'If an account exists with this email, you will receive a password reset link.');
      return res.redirect('/auth/forgot-password');
    }

    const token = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    db.prepare(`
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, token, expires.toISOString());

    req.flash('success_msg', `Password reset link (demo): /auth/reset-password/${token}`);
    res.redirect('/auth/forgot-password');

  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/auth/forgot-password');
  }
};

exports.showResetPassword = (req, res) => {
  const { token } = req.params;
  const db = getDb();
  
  const reset = db.prepare(`
    SELECT * FROM password_resets 
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token);

  if (!reset) {
    req.flash('error_msg', 'Invalid or expired reset link');
    return res.redirect('/auth/forgot-password');
  }

  res.render('auth/reset-password', { title: 'Reset Password - Craftify', token });
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirm_password } = req.body;
    const db = getDb();

    if (password !== confirm_password) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect(`/auth/reset-password/${token}`);
    }

    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect(`/auth/reset-password/${token}`);
    }

    const reset = db.prepare(`
      SELECT * FROM password_resets 
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `).get(token);

    if (!reset) {
      req.flash('error_msg', 'Invalid or expired reset link');
      return res.redirect('/auth/forgot-password');
    }

    await User.updatePassword(reset.user_id, password);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);

    req.flash('success_msg', 'Password reset successful! Please log in.');
    res.redirect('/auth/login');

  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/auth/forgot-password');
  }
};
