const { prisma } = require("../db/prisma");

/**
 * Thin model wrappers over Prisma delegates. Services must use this layer
 * instead of importing Prisma directly.
 */
const db = {
  transaction: (callback) => prisma.$transaction(callback),

  user: {
    findUnique: (args) => prisma.user.findUnique(args),
    findFirst: (args) => prisma.user.findFirst(args),
    findMany: (args) => prisma.user.findMany(args),
    create: (args) => prisma.user.create(args),
    update: (args) => prisma.user.update(args),
    count: (args) => prisma.user.count(args),
    findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    findByIdProfile: (id) =>
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          avatarUrl: true,
          bio: true,
        },
      }),
  },

  product: {
    findUnique: (args) => prisma.product.findUnique(args),
    findMany: (args) => prisma.product.findMany(args),
    create: (args) => prisma.product.create(args),
    update: (args) => prisma.product.update(args),
    delete: (args) => prisma.product.delete(args),
    count: (args) => prisma.product.count(args),
  },

  category: {
    findMany: (args) => prisma.category.findMany(args),
  },

  auction: {
    findUnique: (args) => prisma.auction.findUnique(args),
    findMany: (args) => prisma.auction.findMany(args),
    create: (args) => prisma.auction.create(args),
    update: (args) => prisma.auction.update(args),
    count: (args) => prisma.auction.count(args),
  },

  bid: {
    create: (args) => prisma.bid.create(args),
  },

  cart: {
    findUnique: (args) => prisma.cart.findUnique(args),
    create: (args) => prisma.cart.create(args),
  },

  cartItem: {
    upsert: (args) => prisma.cartItem.upsert(args),
    update: (args) => prisma.cartItem.update(args),
    delete: (args) => prisma.cartItem.delete(args),
    deleteMany: (args) => prisma.cartItem.deleteMany(args),
  },

  order: {
    findUnique: (args) => prisma.order.findUnique(args),
    findMany: (args) => prisma.order.findMany(args),
    create: (args) => prisma.order.create(args),
    update: (args) => prisma.order.update(args),
    count: (args) => prisma.order.count(args),
    aggregate: (args) => prisma.order.aggregate(args),
  },

  orderItem: {
    findMany: (args) => prisma.orderItem.findMany(args),
    count: (args) => prisma.orderItem.count(args),
  },

  wishlist: {
    findUnique: (args) => prisma.wishlist.findUnique(args),
    create: (args) => prisma.wishlist.create(args),
  },

  wishlistItem: {
    upsert: (args) => prisma.wishlistItem.upsert(args),
    delete: (args) => prisma.wishlistItem.delete(args),
  },

  review: {
    upsert: (args) => prisma.review.upsert(args),
    findMany: (args) => prisma.review.findMany(args),
  },

  conversation: {
    findMany: (args) => prisma.conversation.findMany(args),
    update: (args) => prisma.conversation.update(args),
  },

  conversationParticipant: {
    findFirst: (args) => prisma.conversationParticipant.findFirst(args),
  },

  message: {
    findMany: (args) => prisma.message.findMany(args),
    create: (args) => prisma.message.create(args),
  },

  notification: {
    findUnique: (args) => prisma.notification.findUnique(args),
    findMany: (args) => prisma.notification.findMany(args),
    update: (args) => prisma.notification.update(args),
  },

  artisanProfile: {
    upsert: (args) => prisma.artisanProfile.upsert(args),
  },

  faq: {
    findMany: (args) => prisma.faq.findMany(args),
  },

  contactMessage: {
    create: (args) => prisma.contactMessage.create(args),
  },

  newsletterSubscription: {
    findUnique: (args) => prisma.newsletterSubscription.findUnique(args),
    create: (args) => prisma.newsletterSubscription.create(args),
  },
};

const UserModel = require("./User");
const ProductModel = require("./Product");
const CategoryModel = require("./Category");
const AuctionModel = require("./Auction");
const BidModel = require("./Bid");
const OrderModel = require("./Order");
const OrderItemModel = require("./OrderItem");
const CartModel = require("./Cart");
const CartItemModel = require("./CartItem");
const WishlistModel = require("./Wishlist");
const ReviewModel = require("./Review");
const ConversationModel = require("./Conversation");
const MessageModel = require("./Message");
const NotificationModel = require("./Notification");
const ArtisanProfileModel = require("./ArtisanProfile");
const FAQModel = require("./FAQ");
const ContactMessageModel = require("./ContactMessage");

module.exports = {
  db,
  UserModel,
  ProductModel,
  CategoryModel,
  AuctionModel,
  BidModel,
  OrderModel,
  OrderItemModel,
  CartModel,
  CartItemModel,
  WishlistModel,
  ReviewModel,
  ConversationModel,
  MessageModel,
  NotificationModel,
  ArtisanProfileModel,
  FAQModel,
  ContactMessageModel,
};
