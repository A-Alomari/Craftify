const { z } = require("zod");

const profileSchema = z.object({
  fullName: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(400).optional(),
});

module.exports = {
  profileSchema,
};