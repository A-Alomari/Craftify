/**
 * Unit tests for messages.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

jest.mock("../../../src/services/realtime.service", () => ({
  emitConversationMessage: jest.fn(),
  emitUserNotification: jest.fn(),
}));

const messagesService = require("../../../src/services/messages.service");
const { emitConversationMessage, emitUserNotification } = require("../../../src/services/realtime.service");
const { fakeMessage, fakeConversation } = require("../../fixtures/users");

describe("Messages Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("listConversations", () => {
    it("should return conversations for user", async () => {
      const convos = [fakeConversation()];
      mockDb.conversation.findMany.mockResolvedValue(convos);

      const result = await messagesService.listConversations("u1");

      expect(result).toHaveLength(1);
      expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { participants: { some: { userId: "u1" } } },
        })
      );
    });
  });

  describe("listConversationMessages", () => {
    it("should return messages when user is participant", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue({ id: "cp1" });
      mockDb.message.findMany.mockResolvedValue([fakeMessage()]);

      const result = await messagesService.listConversationMessages("conv1", "u1");

      expect(result).toHaveLength(1);
    });

    it("should throw ForbiddenError if user is not participant", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(
        messagesService.listConversationMessages("conv1", "u_outsider")
      ).rejects.toThrow("Not part of this conversation");
    });
  });

  describe("sendMessage", () => {
    it("should create message and emit real-time events", async () => {
      const msg = fakeMessage({ conversationId: "conv1", senderId: "u1", receiverId: "u2" });
      mockDb.message.create.mockResolvedValue(msg);
      mockDb.conversation.update.mockResolvedValue({});

      const result = await messagesService.sendMessage(
        { conversationId: "conv1", receiverId: "u2", content: "Hello" },
        "u1"
      );

      expect(mockDb.message.create).toHaveBeenCalled();
      expect(mockDb.conversation.update).toHaveBeenCalled();
      expect(emitConversationMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv1" })
      );
      expect(emitUserNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u2" })
      );
    });
  });
});
