const { z } = require("zod");

const auctionSchema = z.object({
  productId: z.string().min(1),
  startingBid: z.number().positive(),
  bidIncrement: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
});

const bidSchema = z.object({
  amount: z.number().positive(),
});

const auctionPaymentSchema = z.object({
  shippingName: z.string().min(2),
  shippingEmail: z.email(),
  shippingStreet: z.string().min(5),
  shippingCity: z.string().min(2),
  shippingState: z.string().min(2),
  shippingZip: z.string().min(3),
  paymentMethodToken: z.string().min(3).optional(),
});

module.exports = {
  auctionSchema,
  bidSchema,
  auctionPaymentSchema,
};