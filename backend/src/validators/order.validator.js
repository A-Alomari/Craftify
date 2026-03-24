const { z } = require("zod");

const checkoutSchema = z.object({
  shippingName: z.string().min(2),
  shippingEmail: z.email(),
  shippingStreet: z.string().min(5),
  shippingCity: z.string().min(2),
  shippingState: z.string().min(2),
  shippingZip: z.string().min(3),
  paymentMethodToken: z.string().min(3).optional(),
});

const statusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

module.exports = {
  checkoutSchema,
  statusSchema,
};