const { db } = require("../models");
const { ValidationError, PaymentRequiredError, ForbiddenError, NotFoundError } = require("../utils/http");
const { createPayment } = require("./payments");

/**
 * Handles the checkout operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function checkout(userId, payload) {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new ValidationError("Cart is empty");
  }

  const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const payment = await createPayment({
    amount: totalAmount,
    description: "Craftify cart checkout",
    paymentMethodToken: payload.paymentMethodToken,
    metadata: {
      userId,
      source: "checkout",
    },
  });

  if (payment.status !== "succeeded") {
    throw new PaymentRequiredError("Payment was not completed");
  }

  const shippingData = {
    shippingName: payload.shippingName,
    shippingEmail: payload.shippingEmail,
    shippingStreet: payload.shippingStreet,
    shippingCity: payload.shippingCity,
    shippingState: payload.shippingState,
    shippingZip: payload.shippingZip,
  };

  const order = await db.order.create({
    data: {
      userId,
      totalAmount,
      ...shippingData,
      items: {
        create: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.product.price,
        })),
      },
    },
    include: { items: true },
  });

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });

  return {
    order,
    payment: {
      provider: payment.provider,
      paymentId: payment.paymentId,
      status: payment.status,
    },
  };
}

/**
 * Handles the listOrders operation.
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function listOrders(auth) {
  const where = auth.role === "ADMIN" ? {} : { userId: auth.sub };
  return db.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Handles the getOrderById operation.
 * @param {unknown} id
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function getOrderById(id, auth) {
  const order = await db.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (auth.role !== "ADMIN" && order.userId !== auth.sub) {
    throw new ForbiddenError("You are not allowed to view this order");
  }

  return order;
}

/**
 * Handles the updateOrderStatus operation.
 * @param {unknown} id
 * @param {unknown} status
 * @returns {Promise<unknown>}
 */
async function updateOrderStatus(id, status) {
  return db.order.update({
    where: { id },
    data: { status },
  });
}

/**
 * Handles the confirmOrder operation.
 * @param {unknown} id
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function confirmOrder(id, auth) {
  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.userId !== auth.sub && auth.role !== "ADMIN") {
    throw new ForbiddenError("Not allowed");
  }

  return db.order.update({
    where: { id },
    data: { status: "DELIVERED" },
  });
}

module.exports = {
  checkout,
  listOrders,
  getOrderById,
  updateOrderStatus,
  confirmOrder,
};
