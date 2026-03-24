/**
 * Fixture factories for generating fake entity data used across tests.
 */

let idCounter = 0;
function fakeId() {
  idCounter += 1;
  return `cuid_${idCounter}_${Date.now()}`;
}

// Reset counter between test runs
function resetIdCounter() {
  idCounter = 0;
}

function fakeUser(overrides = {}) {
  const id = fakeId();
  return {
    id,
    fullName: "Test User",
    email: `user_${id}@test.com`,
    passwordHash: "$2b$10$hashedpasswordplaceholder",
    role: "BUYER",
    isEmailVerified: false,
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeCategory(overrides = {}) {
  const id = fakeId();
  return {
    id,
    name: "Pottery",
    slug: `pottery-${id}`,
    ...overrides,
  };
}

function fakeProduct(overrides = {}) {
  const id = fakeId();
  return {
    id,
    name: "Handmade Vase",
    description: "A beautiful handmade vase",
    price: 49.99,
    stock: 10,
    status: "ACTIVE",
    imageUrls: ["https://example.com/img1.jpg"],
    categoryId: fakeId(),
    artisanId: fakeId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeAuction(overrides = {}) {
  const id = fakeId();
  const now = new Date();
  return {
    id,
    productId: fakeId(),
    startingBid: 10.0,
    currentBid: 10.0,
    bidIncrement: 1.0,
    reservePrice: null,
    startAt: new Date(now.getTime() - 3600000),
    endAt: new Date(now.getTime() + 3600000),
    status: "LIVE",
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakeBid(overrides = {}) {
  return {
    id: fakeId(),
    auctionId: fakeId(),
    userId: fakeId(),
    amount: 15.0,
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeCart(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeCartItem(overrides = {}) {
  return {
    id: fakeId(),
    cartId: fakeId(),
    productId: fakeId(),
    quantity: 1,
    ...overrides,
  };
}

function fakeOrder(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    status: "PENDING",
    totalAmount: 99.99,
    shippingName: "John Doe",
    shippingEmail: "john@test.com",
    shippingStreet: "123 Main St",
    shippingCity: "Springfield",
    shippingState: "IL",
    shippingZip: "62701",
    trackingNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeOrderItem(overrides = {}) {
  return {
    id: fakeId(),
    orderId: fakeId(),
    productId: fakeId(),
    quantity: 2,
    unitPrice: 49.99,
    ...overrides,
  };
}

function fakeWishlist(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeReview(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    productId: fakeId(),
    rating: 4,
    title: "Great product",
    body: "Really loved this handmade item!",
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeConversation(overrides = {}) {
  return {
    id: fakeId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeMessage(overrides = {}) {
  return {
    id: fakeId(),
    conversationId: fakeId(),
    senderId: fakeId(),
    receiverId: fakeId(),
    content: "Hello, is this item still available?",
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeNotification(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    title: "New Order",
    body: "You have a new order!",
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeArtisanProfile(overrides = {}) {
  return {
    id: fakeId(),
    userId: fakeId(),
    shopName: "Artisan Workshop",
    location: "New York",
    memberSince: new Date(),
    avgRating: 0,
    totalSales: 0,
    verified: false,
    ...overrides,
  };
}

function fakeFaq(overrides = {}) {
  return {
    id: fakeId(),
    question: "How do I return an item?",
    answer: "Contact the artisan directly.",
    createdAt: new Date(),
    ...overrides,
  };
}

function fakeContactMessage(overrides = {}) {
  return {
    id: fakeId(),
    name: "Jane Doe",
    email: "jane@test.com",
    message: "I have a question about your platform.",
    createdAt: new Date(),
    ...overrides,
  };
}

module.exports = {
  fakeId,
  resetIdCounter,
  fakeUser,
  fakeCategory,
  fakeProduct,
  fakeAuction,
  fakeBid,
  fakeCart,
  fakeCartItem,
  fakeOrder,
  fakeOrderItem,
  fakeWishlist,
  fakeReview,
  fakeConversation,
  fakeMessage,
  fakeNotification,
  fakeArtisanProfile,
  fakeFaq,
  fakeContactMessage,
};
