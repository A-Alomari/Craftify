/**
 * Integration test helper — creates a Supertest agent with the Express app,
 * fully mocking the DB layer so no real database is needed.
 */

const mockDb = require("../helpers/setup").createMockDb();

// Mock the models layer globally for all integration tests
jest.mock("../../src/models", () => ({ db: mockDb }));

// Mock realtime (socket.io) so no server is needed
jest.mock("../../src/services/realtime.service", () => ({
  emitAuctionBid: jest.fn(),
  emitConversationMessage: jest.fn(),
  emitUserNotification: jest.fn(),
}));

// Mock email service
jest.mock("../../src/services/email.service", () => ({
  sendEmail: jest.fn(() => Promise.resolve({ queued: true })),
}));

// Mock config/env
jest.mock("../../src/config/env", () => ({
  env: {
    nodeEnv: "test",
    port: 4001,
    clientOrigin: "*",
    jwtAccessSecret: "test_access_secret_key_12345",
    jwtRefreshSecret: "test_refresh_secret_key_67890",
    accessTokenTtl: "15m",
    refreshTokenTtl: "7d",
    paymentProvider: "mock",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
  },
}));

const request = require("supertest");
const { app } = require("../../src/app");
const { authHeader, testUsers, generateAccessToken } = require("../helpers/authHelper");

module.exports = {
  request,
  app,
  mockDb,
  authHeader,
  testUsers,
  generateAccessToken,
};
