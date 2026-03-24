/**
 * Central test setup: provides mock factories for the `db` model layer
 * so that service tests never hit a real database.
 */

/**
 * Build a fresh mock of every method exposed by `backend/src/models/index.js → db`.
 * Each method is a jest.fn() that resolves to `undefined` by default.
 */
function createMockDb() {
  return {
    transaction: jest.fn((cb) => cb(createMockTx())),

    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findByEmail: jest.fn(),
      findByIdProfile: jest.fn(),
    },

    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },

    category: {
      findMany: jest.fn(),
    },

    auction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },

    bid: {
      create: jest.fn(),
    },

    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },

    cartItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },

    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },

    orderItem: {
      findMany: jest.fn(),
      count: jest.fn(),
    },

    wishlist: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },

    wishlistItem: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },

    review: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },

    conversation: {
      findMany: jest.fn(),
      update: jest.fn(),
    },

    conversationParticipant: {
      findFirst: jest.fn(),
    },

    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },

    notification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },

    artisanProfile: {
      upsert: jest.fn(),
    },

    faq: {
      findMany: jest.fn(),
    },

    contactMessage: {
      create: jest.fn(),
    },
  };
}

/**
 * Create a mock Prisma transaction client (has same shape as the db but
 * used inside `db.transaction()` callbacks).
 */
function createMockTx() {
  return {
    order: {
      create: jest.fn(),
    },
    auction: {
      update: jest.fn(),
    },
    product: {
      update: jest.fn(),
    },
  };
}

/**
 * Helper that creates Express-like `req`, `res`, `next` mocks.
 */
function createMockReqRes(overrides = {}) {
  const req = {
    headers: {},
    body: {},
    params: {},
    query: {},
    auth: null,
    method: "GET",
    originalUrl: "/",
    accepts: jest.fn(() => ""),
    ...overrides,
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendFile: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
}

module.exports = {
  createMockDb,
  createMockTx,
  createMockReqRes,
};
