const { z } = require("zod");

const updateUserSchema = z.object({
  role: z.enum(["BUYER", "ARTISAN", "ADMIN"]).optional(),
});

module.exports = {
  updateUserSchema,
};