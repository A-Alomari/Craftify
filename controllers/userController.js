const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const Order = require('../models/Order');
const ArtisanProfile = require('../models/ArtisanProfile');

// Profile
exports.profile = (req, res) => {
  const user = User.findById(req.session.user.id);
  res.render('user/profile', {
    title: 'My Profile - Craftify',
    userProfile: user
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, shipping_address } = req.body;

    const updates = { name, phone, shipping_address };
    if (req.file) {
      updates.avatar = `/uploads/${req.file.filename}`;
    }

    User.update(req.session.user.id, updates);
    
    req.session.user.name = name;
    if (updates.avatar) {
      req.session.user.avatar = updates.avatar;
    }

    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/user/profile');
  } catch (err) {
    console.error('Update profile error:', err);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/user/profile');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    const user = await User.verifyPassword(req.session.user.email, current_password);
    if (!user) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/user/profile');
    }

    if (new_password !== confirm_password) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/user/profile');
    }

    if (new_password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect('/user/profile');
    }

    await User.updatePassword(req.session.user.id, new_password);
    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/user/profile');
  } catch (err) {
    console.error('Change password error:', err);
    req.flash('error_msg', 'Error changing password');
    res.redirect('/user/profile');
  }
};

// Wishlist
exports.wishlist = (req, res) => {
  try {
    const items = Wishlist.findByUserId(req.session.user.id);

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('user/wishlist', {
      title: 'My Wishlist - Craftify',
      items
    });
  } catch (err) {
    console.error('Wishlist error:', err);
    res.redirect('/');
  }
};

exports.addToWishlist = (req, res) => {
  try {
    const { productId } = req.body;
    const added = Wishlist.add(req.session.user.id, productId);

    if (req.xhr) return res.json({ success: true, added });

    req.flash('success_msg', 'Added to wishlist');
    res.redirect('back');
  } catch (err) {
    console.error('Add to wishlist error:', err);
    if (req.xhr) return res.json({ success: false, message: 'Error adding to wishlist' });
    res.redirect('back');
  }
};

exports.removeFromWishlist = (req, res) => {
  try {
    const { productId } = req.body;
    Wishlist.remove(req.session.user.id, productId);

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Removed from wishlist');
    res.redirect('/user/wishlist');
  } catch (err) {
    console.error('Remove from wishlist error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/wishlist');
  }
};

exports.toggleWishlist = (req, res) => {
  try {
    const { productId } = req.body;
    const inWishlist = Wishlist.toggle(req.session.user.id, productId);

    if (req.xhr) return res.json({ success: true, inWishlist });
    res.redirect('back');
  } catch (err) {
    console.error('Toggle wishlist error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('back');
  }
};

exports.moveToCart = (req, res) => {
  try {
    const { productId } = req.body;
    Wishlist.moveToCart(req.session.user.id, productId);

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Moved to cart');
    res.redirect('/user/wishlist');
  } catch (err) {
    console.error('Move to cart error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/wishlist');
  }
};

// Reviews
exports.reviews = (req, res) => {
  try {
    const reviews = Review.findByUserId(req.session.user.id);

    reviews.forEach(review => {
      const images = JSON.parse(review.images || '[]');
      review.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('user/reviews', {
      title: 'My Reviews - Craftify',
      reviews
    });
  } catch (err) {
    console.error('Reviews error:', err);
    res.redirect('/');
  }
};

exports.createReview = (req, res) => {
  try {
    const { product_id, order_id, rating, title, comment } = req.body;

    const canReviewResult = Review.canReview(req.session.user.id, product_id);
    if (!canReviewResult.canReview) {
      if (req.xhr) return res.json({ success: false, message: 'You cannot review this product' });
      req.flash('error_msg', 'You cannot review this product');
      return res.redirect('back');
    }

    const review = Review.create({
      product_id,
      user_id: req.session.user.id,
      order_id: order_id || null,
      rating: parseInt(rating),
      title,
      comment
    });

    const Product = require('../models/Product');
    const product = Product.findById(product_id);
    if (product) {
      Notification.newReview(product.artisan_id, product.name, rating);
    }

    if (req.xhr) return res.json({ success: true, review });

    req.flash('success_msg', 'Review submitted successfully');
    res.redirect(`/products/${product_id}`);
  } catch (err) {
    console.error('Create review error:', err);
    if (req.xhr) return res.json({ success: false, message: err.message });
    req.flash('error_msg', err.message || 'Error submitting review');
    res.redirect('back');
  }
};

exports.deleteReview = (req, res) => {
  try {
    const { id } = req.params;
    const review = Review.findById(id);

    if (!review || review.user_id !== req.session.user.id) {
      if (req.xhr) return res.json({ success: false, message: 'Review not found' });
      req.flash('error_msg', 'Review not found');
      return res.redirect('/user/reviews');
    }

    Review.delete(id);

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Review deleted');
    res.redirect('/user/reviews');
  } catch (err) {
    console.error('Delete review error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/reviews');
  }
};

// Notifications
exports.notifications = (req, res) => {
  try {
    const notifications = Notification.findByUserId(req.session.user.id);

    res.render('user/notifications', {
      title: 'Notifications - Craftify',
      notifications
    });
  } catch (err) {
    console.error('Notifications error:', err);
    res.redirect('/');
  }
};

exports.markNotificationRead = (req, res) => {
  try {
    const { id } = req.params;
    Notification.markAsRead(id);
    if (req.xhr) return res.json({ success: true });
    res.redirect('/user/notifications');
  } catch (err) {
    console.error('Mark notification read error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/notifications');
  }
};

exports.markAllNotificationsRead = (req, res) => {
  try {
    Notification.markAllAsRead(req.session.user.id);
    if (req.xhr) return res.json({ success: true });
    req.flash('success_msg', 'All notifications marked as read');
    res.redirect('/user/notifications');
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/notifications');
  }
};

exports.deleteNotification = (req, res) => {
  try {
    const { id } = req.params;
    Notification.delete(id);
    if (req.xhr) return res.json({ success: true });
    res.redirect('/user/notifications');
  } catch (err) {
    console.error('Delete notification error:', err);
    if (req.xhr) return res.json({ success: false });
    res.redirect('/user/notifications');
  }
};

// Messages
exports.messages = (req, res) => {
  try {
    const conversations = Message.getConversations(req.session.user.id);

    res.render('user/messages', {
      title: 'Messages - Craftify',
      conversations
    });
  } catch (err) {
    console.error('Messages error:', err);
    res.redirect('/');
  }
};

exports.conversation = (req, res) => {
  try {
    const { userId } = req.params;
    const otherUser = User.findById(userId);

    if (!otherUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/user/messages');
    }

    Message.markThreadAsRead(req.session.user.id, userId);

    const messages = Message.getThread(req.session.user.id, userId);
    const artisanProfile = otherUser.role === 'artisan' ? ArtisanProfile.findByUserId(userId) : null;

    res.render('user/conversation', {
      title: `Chat with ${otherUser.name} - Craftify`,
      otherUser,
      artisanProfile,
      messages
    });
  } catch (err) {
    console.error('Conversation error:', err);
    res.redirect('/user/messages');
  }
};

exports.sendMessage = (req, res) => {
  try {
    const { receiver_id, content } = req.body;

    const message = Message.create({
      sender_id: req.session.user.id,
      receiver_id: parseInt(receiver_id),
      content
    });

    Notification.newMessage(receiver_id, req.session.user.name);

    if (req.xhr) return res.json({ success: true, message });

    res.redirect(`/user/messages/${receiver_id}`);
  } catch (err) {
    console.error('Send message error:', err);
    if (req.xhr) return res.json({ success: false, message: 'Error sending message' });
    res.redirect('/user/messages');
  }
};

// View artisan profile
exports.viewArtisan = (req, res) => {
  try {
    const { id } = req.params;
    const artisan = ArtisanProfile.findByUserId(id);

    if (!artisan || !artisan.is_approved) {
      req.flash('error_msg', 'Artisan not found');
      return res.redirect('/products');
    }

    const Product = require('../models/Product');
    const products = Product.findAll({ artisan_id: id, status: 'approved', limit: 12 });
    const stats = ArtisanProfile.getStats(id);
    const reviews = Review.findAll({ artisan_id: id, limit: 5 });

    products.forEach(p => {
      const images = JSON.parse(p.images || '[]');
      p.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('user/artisan-profile', {
      title: `${artisan.shop_name} - Craftify`,
      artisan,
      products,
      stats,
      reviews
    });
  } catch (err) {
    console.error('View artisan error:', err);
    res.redirect('/products');
  }
};
