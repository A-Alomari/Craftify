const { db } = require("../models");

/**
 * Handles the getOrCreateCart operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function getOrCreateCart(userId) {
  const existing = await db.cart.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return db.cart.create({ data: { userId } });
}

/**
 * Handles the getCart operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  const fullCart = await db.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const total = fullCart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  return { cart: fullCart, total };
}

/**
 * Handles the addItem operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function addItem(userId, payload) {
  const cart = await getOrCreateCart(userId);

  const item = await db.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: payload.productId,
      },
    },
    create: {
      cartId: cart.id,
      productId: payload.productId,
      quantity: payload.quantity,
    },
    update: {
      quantity: { increment: payload.quantity },
    },
  });

  return item;
}

/**
 * Handles the updateItem operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function updateItem(userId, payload) {
  const cart = await getOrCreateCart(userId);

  return db.cartItem.update({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: payload.productId,
      },
    },
    data: {
      quantity: payload.quantity,
    },
  });
}

/**
 * Handles the removeItem operation.
 * @param {unknown} userId
 * @param {unknown} productId
 * @returns {Promise<unknown>}
 */
async function removeItem(userId, productId) {
  const cart = await getOrCreateCart(userId);

  await db.cartItem.delete({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
  });
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
};
