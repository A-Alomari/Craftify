const { z } = require("zod");

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  message: z.string().min(10),
});

module.exports = {
  contactSchema,
};