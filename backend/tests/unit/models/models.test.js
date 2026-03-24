/**
 * Phase 2: Model / Schema Unit Tests
 * Tests for ALL model helper functions and Prisma wrapper layer.
 * Covers every model file and every function in the db wrapper (index.js).
 */
const bcrypt = require("bcryptjs");

// Mock Prisma client — every delegate method used by any model
const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  product: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  category: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  auction: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  bid: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  cart: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  cartItem: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  order: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  orderItem: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  wishlist: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  wishlistItem: { upsert: jest.fn(), delete: jest.fn() },
  review: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  conversation: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  conversationParticipant: { findFirst: jest.fn() },
  message: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  notification: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  artisanProfile: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  faq: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  contactMessage: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock("../../../src/db/prisma", () => ({ prisma: mockPrisma }));

// Require ALL models after mocking Prisma
const UserModel = require("../../../src/models/User");
const ProductModel = require("../../../src/models/Product");
const AuctionModel = require("../../../src/models/Auction");
const BidModel = require("../../../src/models/Bid");
const OrderModel = require("../../../src/models/Order");
const OrderItemModel = require("../../../src/models/OrderItem");
const CartModel = require("../../../src/models/Cart");
const CartItemModel = require("../../../src/models/CartItem");
const WishlistModel = require("../../../src/models/Wishlist");
const ReviewModel = require("../../../src/models/Review");
const CategoryModel = require("../../../src/models/Category");
const ConversationModel = require("../../../src/models/Conversation");
const MessageModel = require("../../../src/models/Message");
const NotificationModel = require("../../../src/models/Notification");
const ArtisanProfileModel = require("../../../src/models/ArtisanProfile");
const FAQModel = require("../../../src/models/FAQ");
const ContactMessageModel = require("../../../src/models/ContactMessage");

/**
 * Helper: test that all standard CRUD methods on a model delegate to the
 * corresponding Prisma delegate. Each model has: findUnique, findFirst,
 * findMany, create, update, delete, count.
 */
function testStandardCrud(modelName, Model, prismaDel) {
  describe(modelName, () => {
    it("findUnique delegates to prisma", async () => {
      prismaDel.findUnique.mockResolvedValue({ id: "x1" });
      const r = await Model.findUnique({ where: { id: "x1" } });
      expect(r).toEqual({ id: "x1" });
      expect(prismaDel.findUnique).toHaveBeenCalledWith({ where: { id: "x1" } });
    });

    it("findFirst delegates to prisma (or returns null)", async () => {
      if (prismaDel.findFirst) {
        prismaDel.findFirst.mockResolvedValue({ id: "x1" });
      }
      const r = await Model.findFirst({ where: { id: "x1" } });
      if (prismaDel.findFirst) {
        expect(r).toEqual({ id: "x1" });
      } else {
        expect(r).toBeNull();
      }
    });

    it("findMany delegates to prisma", async () => {
      prismaDel.findMany.mockResolvedValue([{ id: "x1" }]);
      const r = await Model.findMany({});
      expect(r).toEqual([{ id: "x1" }]);
    });

    it("create delegates to prisma", async () => {
      prismaDel.create.mockResolvedValue({ id: "x1" });
      const r = await Model.create({ data: {} });
      expect(r).toEqual({ id: "x1" });
      expect(prismaDel.create).toHaveBeenCalled();
    });

    it("update delegates to prisma", async () => {
      prismaDel.update.mockResolvedValue({ id: "x1" });
      const r = await Model.update({ where: { id: "x1" }, data: {} });
      expect(r).toEqual({ id: "x1" });
    });

    it("delete delegates to prisma", async () => {
      prismaDel.delete.mockResolvedValue({ id: "x1" });
      const r = await Model.delete({ where: { id: "x1" } });
      expect(r).toEqual({ id: "x1" });
    });

    it("count delegates to prisma (or returns null)", async () => {
      if (prismaDel.count) {
        prismaDel.count.mockResolvedValue(7);
      }
      const r = await Model.count({});
      if (prismaDel.count) {
        expect(r).toBe(7);
      } else {
        expect(r).toBeNull();
      }
    });
  });
}

describe("Phase 2: Model / Schema Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ═══════════════════════════════════════════════════════════
  // USER MODEL (with Extra Helper Methods)
  // ═══════════════════════════════════════════════════════════
  testStandardCrud("UserModel CRUD", UserModel, mockPrisma.user);

  describe("UserModel helpers", () => {
    it("findByEmail delegates with email where clause", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" });
      const r = await UserModel.findByEmail("a@b.com");
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "a@b.com" } });
      expect(r.email).toBe("a@b.com");
    });

    it("comparePassword returns true for matching password", async () => {
      const hash = await bcrypt.hash("correct", 10);
      expect(await UserModel.comparePassword("correct", hash)).toBe(true);
    });

    it("comparePassword returns false for wrong password", async () => {
      const hash = await bcrypt.hash("correct", 10);
      expect(await UserModel.comparePassword("wrong", hash)).toBe(false);
    });

    it("toPublicProfile strips sensitive fields", () => {
      const user = {
        id: "u1", fullName: "Test", email: "t@t.com", role: "BUYER",
        avatarUrl: "https://img.com/a.png", bio: "Hello",
        passwordHash: "$2b$10$secret", createdAt: new Date(),
      };
      const profile = UserModel.toPublicProfile(user);
      expect(profile).toEqual({
        id: "u1", fullName: "Test", email: "t@t.com", role: "BUYER",
        avatarUrl: "https://img.com/a.png", bio: "Hello",
      });
      expect(profile.passwordHash).toBeUndefined();
      expect(profile.createdAt).toBeUndefined();
    });

    it("toPublicProfile handles null avatarUrl and bio", () => {
      const user = { id: "u1", fullName: "T", email: "t@t.com", role: "BUYER", avatarUrl: null, bio: null };
      const profile = UserModel.toPublicProfile(user);
      expect(profile.avatarUrl).toBeNull();
      expect(profile.bio).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PRODUCT MODEL (with Extra Helper Methods)
  // ═══════════════════════════════════════════════════════════
  testStandardCrud("ProductModel CRUD", ProductModel, mockPrisma.product);

  describe("ProductModel helpers", () => {
    it("isOwnedBy returns true when artisanId matches", () => {
      expect(ProductModel.isOwnedBy({ artisanId: "a1" }, "a1")).toBe(true);
    });
    it("isOwnedBy returns false when artisanId differs", () => {
      expect(ProductModel.isOwnedBy({ artisanId: "a1" }, "a2")).toBe(false);
    });
    it("isOwnedBy returns false for null product", () => {
      expect(ProductModel.isOwnedBy(null, "a1")).toBeFalsy();
    });
    it("buildActiveSearchWhere returns base filter", () => {
      expect(ProductModel.buildActiveSearchWhere({})).toEqual({ status: "ACTIVE" });
    });
    it("buildActiveSearchWhere adds categoryId", () => {
      expect(ProductModel.buildActiveSearchWhere({ categoryId: "c1" })).toEqual({ status: "ACTIVE", categoryId: "c1" });
    });
    it("buildActiveSearchWhere adds search query OR", () => {
      const w = ProductModel.buildActiveSearchWhere({ q: "handmade" });
      expect(w.OR).toHaveLength(2);
      expect(w.OR[0].name.contains).toBe("handmade");
    });
    it("buildActiveSearchWhere combines categoryId and query", () => {
      const w = ProductModel.buildActiveSearchWhere({ q: "vase", categoryId: "c1" });
      expect(w.categoryId).toBe("c1");
      expect(w.OR).toHaveLength(2);
    });
    it("buildActiveSearchWhere ignores empty query", () => {
      const w = ProductModel.buildActiveSearchWhere({ q: "" });
      expect(w.OR).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ALL REMAINING MODELS (standard CRUD delegation)
  // ═══════════════════════════════════════════════════════════
  testStandardCrud("AuctionModel", AuctionModel, mockPrisma.auction);
  testStandardCrud("BidModel", BidModel, mockPrisma.bid);
  testStandardCrud("OrderModel", OrderModel, mockPrisma.order);
  testStandardCrud("OrderItemModel", OrderItemModel, mockPrisma.orderItem);
  testStandardCrud("CartModel", CartModel, mockPrisma.cart);
  testStandardCrud("CartItemModel", CartItemModel, mockPrisma.cartItem);
  testStandardCrud("WishlistModel", WishlistModel, mockPrisma.wishlist);
  testStandardCrud("ReviewModel", ReviewModel, mockPrisma.review);
  testStandardCrud("CategoryModel", CategoryModel, mockPrisma.category);
  testStandardCrud("ConversationModel", ConversationModel, mockPrisma.conversation);
  testStandardCrud("MessageModel", MessageModel, mockPrisma.message);
  testStandardCrud("NotificationModel", NotificationModel, mockPrisma.notification);
  testStandardCrud("ArtisanProfileModel", ArtisanProfileModel, mockPrisma.artisanProfile);
  testStandardCrud("FAQModel", FAQModel, mockPrisma.faq);
  testStandardCrud("ContactMessageModel", ContactMessageModel, mockPrisma.contactMessage);

  // ═══════════════════════════════════════════════════════════
  // DB WRAPPER (index.js) — cover every delegate method
  // ═══════════════════════════════════════════════════════════
  describe("db wrapper (index.js)", () => {
    const { db } = require("../../../src/models/index");

    it("db.transaction delegates to prisma.$transaction", async () => {
      const cb = jest.fn();
      mockPrisma.$transaction.mockResolvedValue("ok");
      const r = await db.transaction(cb);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(cb);
      expect(r).toBe("ok");
    });

    // — user —
    it("db.user.findUnique", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
      await db.user.findUnique({ where: { id: "u1" } });
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    });
    it("db.user.findFirst", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await db.user.findFirst({ where: {} });
      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    });
    it("db.user.findMany", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await db.user.findMany({});
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });
    it("db.user.create", async () => {
      mockPrisma.user.create.mockResolvedValue({ id: "u1" });
      await db.user.create({ data: {} });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
    it("db.user.update", async () => {
      mockPrisma.user.update.mockResolvedValue({ id: "u1" });
      await db.user.update({ where: { id: "u1" }, data: {} });
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
    it("db.user.count", async () => {
      mockPrisma.user.count.mockResolvedValue(3);
      const r = await db.user.count({});
      expect(r).toBe(3);
    });
    it("db.user.findByEmail", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
      await db.user.findByEmail("a@b.com");
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "a@b.com" } });
    });
    it("db.user.findByIdProfile selects public fields only", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
      await db.user.findByIdProfile("u1");
      const c = mockPrisma.user.findUnique.mock.calls[0][0];
      expect(c.select.id).toBe(true);
      expect(c.select.passwordHash).toBeUndefined();
    });

    // — product —
    it("db.product.findUnique", async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: "p1" });
      await db.product.findUnique({ where: { id: "p1" } });
      expect(mockPrisma.product.findUnique).toHaveBeenCalled();
    });
    it("db.product.findMany", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await db.product.findMany({});
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
    it("db.product.create", async () => {
      mockPrisma.product.create.mockResolvedValue({ id: "p1" });
      await db.product.create({ data: {} });
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });
    it("db.product.update", async () => {
      mockPrisma.product.update.mockResolvedValue({ id: "p1" });
      await db.product.update({ where: { id: "p1" }, data: {} });
      expect(mockPrisma.product.update).toHaveBeenCalled();
    });
    it("db.product.delete", async () => {
      mockPrisma.product.delete.mockResolvedValue({ id: "p1" });
      await db.product.delete({ where: { id: "p1" } });
      expect(mockPrisma.product.delete).toHaveBeenCalled();
    });
    it("db.product.count", async () => {
      mockPrisma.product.count.mockResolvedValue(5);
      const r = await db.product.count({});
      expect(r).toBe(5);
    });

    // — category —
    it("db.category.findMany", async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      await db.category.findMany({});
      expect(mockPrisma.category.findMany).toHaveBeenCalled();
    });

    // — auction —
    it("db.auction.findUnique", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ id: "a1" });
      await db.auction.findUnique({ where: { id: "a1" } });
      expect(mockPrisma.auction.findUnique).toHaveBeenCalled();
    });
    it("db.auction.findMany", async () => {
      mockPrisma.auction.findMany.mockResolvedValue([]);
      await db.auction.findMany({});
      expect(mockPrisma.auction.findMany).toHaveBeenCalled();
    });
    it("db.auction.create", async () => {
      mockPrisma.auction.create.mockResolvedValue({ id: "a1" });
      await db.auction.create({ data: {} });
      expect(mockPrisma.auction.create).toHaveBeenCalled();
    });
    it("db.auction.update", async () => {
      mockPrisma.auction.update.mockResolvedValue({ id: "a1" });
      await db.auction.update({ where: { id: "a1" }, data: {} });
      expect(mockPrisma.auction.update).toHaveBeenCalled();
    });
    it("db.auction.count", async () => {
      mockPrisma.auction.count.mockResolvedValue(2);
      const r = await db.auction.count({});
      expect(r).toBe(2);
    });

    // — bid —
    it("db.bid.create", async () => {
      mockPrisma.bid.create.mockResolvedValue({ id: "b1" });
      await db.bid.create({ data: {} });
      expect(mockPrisma.bid.create).toHaveBeenCalled();
    });

    // — cart —
    it("db.cart.findUnique", async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: "c1" });
      await db.cart.findUnique({ where: { id: "c1" } });
      expect(mockPrisma.cart.findUnique).toHaveBeenCalled();
    });
    it("db.cart.create", async () => {
      mockPrisma.cart.create.mockResolvedValue({ id: "c1" });
      await db.cart.create({ data: {} });
      expect(mockPrisma.cart.create).toHaveBeenCalled();
    });

    // — cartItem —
    it("db.cartItem.upsert", async () => {
      mockPrisma.cartItem.upsert.mockResolvedValue({ id: "ci1" });
      await db.cartItem.upsert({});
      expect(mockPrisma.cartItem.upsert).toHaveBeenCalled();
    });
    it("db.cartItem.update", async () => {
      mockPrisma.cartItem.update.mockResolvedValue({ id: "ci1" });
      await db.cartItem.update({ where: { id: "ci1" }, data: {} });
      expect(mockPrisma.cartItem.update).toHaveBeenCalled();
    });
    it("db.cartItem.delete", async () => {
      mockPrisma.cartItem.delete.mockResolvedValue({});
      await db.cartItem.delete({ where: { id: "ci1" } });
      expect(mockPrisma.cartItem.delete).toHaveBeenCalled();
    });
    it("db.cartItem.deleteMany", async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });
      await db.cartItem.deleteMany({ where: { cartId: "c1" } });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalled();
    });

    // — order —
    it("db.order.findUnique", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: "o1" });
      await db.order.findUnique({ where: { id: "o1" } });
      expect(mockPrisma.order.findUnique).toHaveBeenCalled();
    });
    it("db.order.findMany", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      await db.order.findMany({});
      expect(mockPrisma.order.findMany).toHaveBeenCalled();
    });
    it("db.order.create", async () => {
      mockPrisma.order.create.mockResolvedValue({ id: "o1" });
      await db.order.create({ data: {} });
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });
    it("db.order.update", async () => {
      mockPrisma.order.update.mockResolvedValue({ id: "o1" });
      await db.order.update({ where: { id: "o1" }, data: {} });
      expect(mockPrisma.order.update).toHaveBeenCalled();
    });
    it("db.order.count", async () => {
      mockPrisma.order.count.mockResolvedValue(10);
      const r = await db.order.count({});
      expect(r).toBe(10);
    });
    it("db.order.aggregate", async () => {
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 5000 } });
      const r = await db.order.aggregate({});
      expect(r._sum.totalAmount).toBe(5000);
    });

    // — orderItem —
    it("db.orderItem.findMany", async () => {
      mockPrisma.orderItem.findMany.mockResolvedValue([]);
      await db.orderItem.findMany({});
      expect(mockPrisma.orderItem.findMany).toHaveBeenCalled();
    });
    it("db.orderItem.count", async () => {
      mockPrisma.orderItem.count.mockResolvedValue(4);
      const r = await db.orderItem.count({});
      expect(r).toBe(4);
    });

    // — wishlist —
    it("db.wishlist.findUnique", async () => {
      mockPrisma.wishlist.findUnique.mockResolvedValue({ id: "w1" });
      await db.wishlist.findUnique({ where: { id: "w1" } });
      expect(mockPrisma.wishlist.findUnique).toHaveBeenCalled();
    });
    it("db.wishlist.create", async () => {
      mockPrisma.wishlist.create.mockResolvedValue({ id: "w1" });
      await db.wishlist.create({ data: {} });
      expect(mockPrisma.wishlist.create).toHaveBeenCalled();
    });

    // — wishlistItem —
    it("db.wishlistItem.upsert", async () => {
      mockPrisma.wishlistItem.upsert.mockResolvedValue({ id: "wi1" });
      await db.wishlistItem.upsert({});
      expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalled();
    });
    it("db.wishlistItem.delete", async () => {
      mockPrisma.wishlistItem.delete.mockResolvedValue({});
      await db.wishlistItem.delete({ where: { id: "wi1" } });
      expect(mockPrisma.wishlistItem.delete).toHaveBeenCalled();
    });

    // — review —
    it("db.review.upsert", async () => {
      mockPrisma.review.upsert.mockResolvedValue({ id: "r1" });
      await db.review.upsert({});
      expect(mockPrisma.review.upsert).toHaveBeenCalled();
    });
    it("db.review.findMany", async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);
      await db.review.findMany({});
      expect(mockPrisma.review.findMany).toHaveBeenCalled();
    });

    // — conversation —
    it("db.conversation.findMany", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      await db.conversation.findMany({});
      expect(mockPrisma.conversation.findMany).toHaveBeenCalled();
    });
    it("db.conversation.update", async () => {
      mockPrisma.conversation.update.mockResolvedValue({ id: "cv1" });
      await db.conversation.update({ where: { id: "cv1" }, data: {} });
      expect(mockPrisma.conversation.update).toHaveBeenCalled();
    });

    // — conversationParticipant —
    it("db.conversationParticipant.findFirst", async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: "cp1" });
      await db.conversationParticipant.findFirst({ where: {} });
      expect(mockPrisma.conversationParticipant.findFirst).toHaveBeenCalled();
    });

    // — message —
    it("db.message.findMany", async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      await db.message.findMany({});
      expect(mockPrisma.message.findMany).toHaveBeenCalled();
    });
    it("db.message.create", async () => {
      mockPrisma.message.create.mockResolvedValue({ id: "m1" });
      await db.message.create({ data: {} });
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    // — notification —
    it("db.notification.findUnique", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: "n1" });
      await db.notification.findUnique({ where: { id: "n1" } });
      expect(mockPrisma.notification.findUnique).toHaveBeenCalled();
    });
    it("db.notification.findMany", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      await db.notification.findMany({});
      expect(mockPrisma.notification.findMany).toHaveBeenCalled();
    });
    it("db.notification.update", async () => {
      mockPrisma.notification.update.mockResolvedValue({ id: "n1" });
      await db.notification.update({ where: { id: "n1" }, data: {} });
      expect(mockPrisma.notification.update).toHaveBeenCalled();
    });

    // — artisanProfile —
    it("db.artisanProfile.upsert", async () => {
      mockPrisma.artisanProfile.upsert.mockResolvedValue({ id: "ap1" });
      await db.artisanProfile.upsert({});
      expect(mockPrisma.artisanProfile.upsert).toHaveBeenCalled();
    });

    // — faq —
    it("db.faq.findMany", async () => {
      mockPrisma.faq.findMany.mockResolvedValue([]);
      await db.faq.findMany({});
      expect(mockPrisma.faq.findMany).toHaveBeenCalled();
    });

    // — contactMessage —
    it("db.contactMessage.create", async () => {
      mockPrisma.contactMessage.create.mockResolvedValue({ id: "cm1" });
      await db.contactMessage.create({ data: {} });
      expect(mockPrisma.contactMessage.create).toHaveBeenCalled();
    });
  });
});
