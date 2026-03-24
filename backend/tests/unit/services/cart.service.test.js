/**
 * Unit tests for cart.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const cartService = require("../../../src/services/cart.service");
const { fakeCart, fakeCartItem, fakeProduct } = require("../../fixtures/users");

describe("Cart Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───────────────────── getCart ─────────────────────
  describe("getCart", () => {
    it("should return existing cart with items and total", async () => {
      const cart = fakeCart({ id: "cart1", userId: "u1" });
      const product = fakeProduct({ price: 25 });
      const fullCart = {
        ...cart,
        items: [{ id: "ci1", productId: product.id, quantity: 2, product }],
      };

      mockDb.cart.findUnique
        .mockResolvedValueOnce(cart) // getOrCreateCart
        .mockResolvedValueOnce(fullCart); // getCart full query

      const result = await cartService.getCart("u1");

      expect(result.cart.items).toHaveLength(1);
      expect(result.total).toBe(50); // 25 * 2
    });

    it("should create a new cart if user has none", async () => {
      const newCart = fakeCart({ id: "cart_new", userId: "u2" });
      const emptyCart = { ...newCart, items: [] };

      mockDb.cart.findUnique
        .mockResolvedValueOnce(null) // getOrCreateCart → not found
        .mockResolvedValueOnce(emptyCart); // getCart full query
      mockDb.cart.create.mockResolvedValue(newCart);

      const result = await cartService.getCart("u2");

      expect(mockDb.cart.create).toHaveBeenCalledWith({ data: { userId: "u2" } });
      expect(result.total).toBe(0);
    });
  });

  // ───────────────────── addItem ─────────────────────
  describe("addItem", () => {
    it("should upsert cart item", async () => {
      const cart = fakeCart({ id: "cart1", userId: "u1" });
      const cartItem = fakeCartItem({ cartId: "cart1", productId: "p1", quantity: 1 });

      mockDb.cart.findUnique.mockResolvedValue(cart);
      mockDb.cartItem.upsert.mockResolvedValue(cartItem);

      const result = await cartService.addItem("u1", { productId: "p1", quantity: 1 });

      expect(mockDb.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cartId_productId: { cartId: "cart1", productId: "p1" } },
          create: expect.objectContaining({ quantity: 1 }),
          update: { quantity: { increment: 1 } },
        })
      );
    });
  });

  // ───────────────────── updateItem ─────────────────────
  describe("updateItem", () => {
    it("should update cart item quantity", async () => {
      const cart = fakeCart({ id: "cart1", userId: "u1" });
      mockDb.cart.findUnique.mockResolvedValue(cart);
      mockDb.cartItem.update.mockResolvedValue(fakeCartItem({ quantity: 5 }));

      await cartService.updateItem("u1", { productId: "p1", quantity: 5 });

      expect(mockDb.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: 5 },
        })
      );
    });
  });

  // ───────────────────── removeItem ─────────────────────
  describe("removeItem", () => {
    it("should remove item from cart", async () => {
      const cart = fakeCart({ id: "cart1", userId: "u1" });
      mockDb.cart.findUnique.mockResolvedValue(cart);
      mockDb.cartItem.delete.mockResolvedValue({});

      await cartService.removeItem("u1", "p1");

      expect(mockDb.cartItem.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cartId_productId: { cartId: "cart1", productId: "p1" } },
        })
      );
    });
  });
});
