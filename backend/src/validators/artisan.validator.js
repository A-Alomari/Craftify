const { z } = require("zod");

const artisanRegistrationSchema = z.object({
  shopName: z.string().min(2),
  location: z.string().min(2).optional(),
});

module.exports = {
  artisanRegistrationSchema,
};