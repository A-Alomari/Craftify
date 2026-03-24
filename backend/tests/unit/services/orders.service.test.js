/**
 * Unit tests for orders.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

jest.mock("../../../src/services/payments", () => ({
  createPayment: jest.fn(() => Promise.resolve({ status: "succeeded", provider: "mock", paymentId: "mock_pay" })),
}));

const ordersService = require("../../../src/services/orders.service");
const { createPayment } = require("../../../src/services/payments");
const { fakeOrder, fakeProduct, fakeCart, fakeCartItem } = require("../../fixtures/users");

describe("Orders Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───────────────────── checkout ─────────────────────
  describe("checkout", () => {
    it("should create order from cart, process payment, and clear cart", async () => {
      const product = fakeProduct({ price: 30 });
      const cart = {
        id: "cart1",
        userId: "u1",
        items: [{ id: "ci1", productId: product.id, quantity: 2, product }],
      };
      const order = fakeOrder({ id: "ord1", totalAmount: 60, items: [] });

      mockDb.cart.findUnique.mockResolvedValue(cart);
      mockDb.order.create.mockResolvedValue(order);
      mockDb.cartItem.deleteMany.mockResolvedValue({});

      const payload = {
        shippingName: "John",
        shippingEmail: "j@t.com",
        shippingStreet: "123 St",
        shippingCity: "City",
        shippingState: "ST",
        shippingZip: "12345",
      };

      const result = await ordersService.checkout("u1", payload);

      expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }));
      expect(mockDb.order.create).toHaveBeenCalled();
      expect(mockDb.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart1" } });
      expect(result.order).toBeDefined();
      expect(result.payment.status).toBe("succeeded");
    });

    it("should throw ValidationError if cart is empty", async () => {
      mockDb.cart.findUnique.mockResolvedValue({ id: "cart1", items: [] });

      await expect(ordersService.checkout("u1", {})).rejects.toThrow("Cart is empty");
    });

    it("should throw ValidationError if no cart exists", async () => {
      mockDb.cart.findUnique.mockResolvedValue(null);

      await expect(ordersService.checkout("u1", {})).rejects.toThrow("Cart is empty");
    });

    it("should throw PaymentRequiredError if payment fails", async () => {
      const product = fakeProduct({ price: 30 });
      const cart = { id: "c1", userId: "u1", items: [{ id: "ci1", productId: "p1", quantity: 1, product }] };
      mockDb.cart.findUnique.mockResolvedValue(cart);
      createPayment.mockResolvedValue({ status: "failed", provider: "mock", paymentId: "x" });

      await expect(ordersService.checkout("u1", {})).rejects.toThrow("Payment was not completed");
    });
  });

  // ───────────────────── listOrders ─────────────────────
  describe("listOrders", () => {
    it("should return all orders for admin", async () => {
      mockDb.order.findMany.mockResolvedValue([fakeOrder()]);

      const result = await ordersService.listOrders({ role: "ADMIN", sub: "admin1" });

      const whereArg = mockDb.order.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({});
    });

    it("should return only user's orders for non-admin", async () => {
      mockDb.order.findMany.mockResolvedValue([]);

      await ordersService.listOrders({ role: "BUYER", sub: "u1" });

      const whereArg = mockDb.order.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ userId: "u1" });
    });
  });

  // ───────────────────── getOrderById ─────────────────────
  describe("getOrderById", () => {
    it("should return order for owner", async () => {
      const order = fakeOrder({ id: "o1", userId: "u1" });
      mockDb.order.findUnique.mockResolvedValue(order);

      const result = await ordersService.getOrderById("o1", { sub: "u1", role: "BUYER" });
      expect(result.id).toBe("o1");
    });

    it("should allow admin to view any order", async () => {
      const order = fakeOrder({ id: "o1", userId: "u1" });
      mockDb.order.findUnique.mockResolvedValue(order);

      const result = await ordersService.getOrderById("o1", { sub: "admin1", role: "ADMIN" });
      expect(result.id).toBe("o1");
    });

    it("should throw ForbiddenError for other user's order", async () => {
      const order = fakeOrder({ id: "o1", userId: "u1" });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(
        ordersService.getOrderById("o1", { sub: "u2", role: "BUYER" })
      ).rejects.toThrow("You are not allowed to view this order");
    });

    it("should throw NotFoundError for non-existent order", async () => {
      mockDb.order.findUnique.mockResolvedValue(null);

      await expect(ordersService.getOrderById("bad", { sub: "u1", role: "BUYER" })).rejects.toThrow(
        "Order not found"
      );
    });
  });

  // ───────────────────── updateOrderStatus ─────────────────────
  describe("updateOrderStatus", () => {
    it("should update order status", async () => {
      mockDb.order.update.mockResolvedValue(fakeOrder({ status: "SHIPPED" }));

      const result = await ordersService.updateOrderStatus("o1", "SHIPPED");

      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { status: "SHIPPED" },
      });
    });
  });

  // ───────────────────── confirmOrder ─────────────────────
  describe("confirmOrder", () => {
    it("should confirm order for owner", async () => {
      const order = fakeOrder({ id: "o1", userId: "u1" });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue({ ...order, status: "DELIVERED" });

      const result = await ordersService.confirmOrder("o1", { sub: "u1", role: "BUYER" });

      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { status: "DELIVERED" },
      });
    });

    it("should throw ForbiddenError for non-owner", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "u1" }));

      await expect(
        ordersService.confirmOrder("o1", { sub: "u2", role: "BUYER" })
      ).rejects.toThrow("Not allowed");
    });

    it("should throw NotFoundError for non-existent order", async () => {
      mockDb.order.findUnique.mockResolvedValue(null);

      await expect(ordersService.confirmOrder("bad", { sub: "u1", role: "BUYER" })).rejects.toThrow(
        "Order not found"
      );
    });
  });
});
