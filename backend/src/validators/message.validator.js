const { z } = require("zod");

const sendSchema = z.object({
  conversationId: z.string().min(1),
  receiverId: z.string().min(1),
  content: z.string().min(1),
});

module.exports = {
  sendSchema,
};