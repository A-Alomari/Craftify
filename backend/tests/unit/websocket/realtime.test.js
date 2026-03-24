/**
 * Phase 6: WebSocket / Real-Time Tests
 * Tests Socket.IO server (config/socket.js) and realtime service
 */
const http = require("http");
const { Server } = require("socket.io");
const Client = require("socket.io-client");

// We test the realtime.service functions by mocking getIo
const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockIo = { to: mockTo };

jest.mock("../../../src/config/socket", () => ({
  attachSocketServer: jest.fn(),
  getIo: jest.fn(() => mockIo),
}));

const { emitAuctionBid, emitConversationMessage, emitUserNotification } = require("../../../src/services/realtime.service");
const { getIo } = require("../../../src/config/socket");

describe("Phase 6: WebSocket / Real-Time Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ═══════════════════════════════════════════════════════════
  // Realtime Service — emitAuctionBid
  // ═══════════════════════════════════════════════════════════
  describe("emitAuctionBid", () => {
    it("should emit auction:new_bid event to the correct auction room", () => {
      const payload = { auctionId: "auc1", currentBid: 150, bid: { userId: "u1", amount: 150 } };
      emitAuctionBid(payload);

      expect(mockTo).toHaveBeenCalledWith("auction:auc1");
      expect(mockEmit).toHaveBeenCalledWith("auction:new_bid", payload);
    });

    it("should not throw when io is null (no WS server)", () => {
      getIo.mockReturnValueOnce(null);
      expect(() => emitAuctionBid({ auctionId: "auc1" })).not.toThrow();
    });

    it("should handle missing auctionId gracefully", () => {
      const payload = { currentBid: 100 };
      emitAuctionBid(payload);
      expect(mockTo).toHaveBeenCalledWith("auction:undefined");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Realtime Service — emitConversationMessage
  // ═══════════════════════════════════════════════════════════
  describe("emitConversationMessage", () => {
    it("should emit chat:new_message event to the correct conversation room", () => {
      const payload = { conversationId: "conv1", message: { id: "m1", content: "Hello" } };
      emitConversationMessage(payload);

      expect(mockTo).toHaveBeenCalledWith("conversation:conv1");
      expect(mockEmit).toHaveBeenCalledWith("chat:new_message", payload.message);
    });

    it("should not throw when io is null", () => {
      getIo.mockReturnValueOnce(null);
      expect(() => emitConversationMessage({ conversationId: "c1", message: {} })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Realtime Service — emitUserNotification
  // ═══════════════════════════════════════════════════════════
  describe("emitUserNotification", () => {
    it("should emit notification:new event to the user room", () => {
      const payload = { userId: "u1", notification: { type: "ORDER_SHIPPED", message: "Your order shipped" } };
      emitUserNotification(payload);

      expect(mockTo).toHaveBeenCalledWith("user:u1");
      expect(mockEmit).toHaveBeenCalledWith("notification:new", payload.notification);
    });

    it("should not throw when io is null", () => {
      getIo.mockReturnValueOnce(null);
      expect(() => emitUserNotification({ userId: "u1", notification: {} })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Socket.IO Server — Room Joining (Integration)
  // ═══════════════════════════════════════════════════════════
  describe("Socket.IO Server — Room Management", () => {
    let ioServer, httpServer, clientSocket;
    const PORT = 4099;

    beforeAll((done) => {
      httpServer = http.createServer();
      ioServer = new Server(httpServer, { cors: { origin: "*" } });

      // Replicate the room join handlers from config/socket.js
      ioServer.on("connection", (socket) => {
        socket.on("join:auction", (auctionId) => {
          socket.join(`auction:${auctionId}`);
        });
        socket.on("join:conversation", (conversationId) => {
          socket.join(`conversation:${conversationId}`);
        });
        socket.on("join:user", (userId) => {
          socket.join(`user:${userId}`);
        });
      });

      httpServer.listen(PORT, () => {
        clientSocket = Client(`http://localhost:${PORT}`, { transports: ["websocket"] });
        clientSocket.on("connect", done);
      });
    });

    afterAll((done) => {
      if (clientSocket) clientSocket.close();
      ioServer.close();
      httpServer.close(done);
    });

    it("client should connect successfully", () => {
      expect(clientSocket.connected).toBe(true);
    });

    it("client should join an auction room and receive bid events", (done) => {
      clientSocket.emit("join:auction", "auc42");

      // Give server time to process room join
      setTimeout(() => {
        ioServer.to("auction:auc42").emit("auction:new_bid", { currentBid: 200 });
      }, 50);

      clientSocket.on("auction:new_bid", (data) => {
        expect(data.currentBid).toBe(200);
        done();
      });
    });

    it("client should join a conversation room and receive messages", (done) => {
      clientSocket.emit("join:conversation", "conv7");

      setTimeout(() => {
        ioServer.to("conversation:conv7").emit("chat:new_message", { content: "Hi!" });
      }, 50);

      clientSocket.on("chat:new_message", (data) => {
        expect(data.content).toBe("Hi!");
        done();
      });
    });

    it("client should join a user room and receive notifications", (done) => {
      clientSocket.emit("join:user", "user99");

      setTimeout(() => {
        ioServer.to("user:user99").emit("notification:new", { type: "ORDER_UPDATE" });
      }, 50);

      clientSocket.on("notification:new", (data) => {
        expect(data.type).toBe("ORDER_UPDATE");
        done();
      });
    });

    it("client should NOT receive events for rooms it hasn't joined", (done) => {
      let received = false;

      clientSocket.on("auction:new_bid_other", () => {
        received = true;
      });

      // Emit to a room this client hasn't joined
      ioServer.to("auction:other_room").emit("auction:new_bid_other", {});

      setTimeout(() => {
        expect(received).toBe(false);
        done();
      }, 100);
    });
  });
});
