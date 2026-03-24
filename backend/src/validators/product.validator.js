const { z } = require("zod");

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(8),
  price: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  categoryId: z.string().min(1),
  imageUrls: z.array(z.string().url()).min(1),
});

module.exports = {
  productSchema,
};