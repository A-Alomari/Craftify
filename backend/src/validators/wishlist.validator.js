const { z } = require("zod");

const productSchema = z.object({
  productId: z.string().min(1),
});

module.exports = {
  productSchema,
};