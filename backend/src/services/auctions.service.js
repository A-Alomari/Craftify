const { db } = require("../models");
const { ValidationError, PaymentRequiredError, ForbiddenError, NotFoundError } = require("../utils/http");
const { createPayment } = require("./payments");
const { emitAuctionBid } = require("./realtime.service");

/**
 * Handles the listLiveAuctions operation.
 * @returns {Promise<unknown>}
 */
async function listLiveAuctions() {
  return db.auction.findMany({
    where: { status: "LIVE" },
    include: {
      product: { include: { artisan: { select: { id: true, fullName: true } } } },
      _count: { select: { bids: true } },
    },
    orderBy: { endAt: "asc" },
  });
}

/**
 * Handles the getAuctionById operation.
 * @param {unknown} id
 * @returns {Promise<unknown>}
 */
async function getAuctionById(id) {
  const auction = await db.auction.findUnique({
    where: { id },
    include: {
      product: { include: { artisan: { select: { id: true, fullName: true } } } },
      bids: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" }, take: 25 },
    },
  });

  if (!auction) {
    throw new NotFoundError("Auction not found");
  }

  return auction;
}

/**
 * Handles the createAuction operation.
 * @param {unknown} payload
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function createAuction(payload, auth) {
  const product = await db.product.findUnique({ where: { id: payload.productId } });
  if (!product) {
    throw new NotFoundError("Product not found");
  }

  if (auth.role !== "ADMIN" && product.artisanId !== auth.sub) {
    throw new ForbiddenError("You can only create auctions for your own products");
  }

  return db.auction.create({
    data: {
      ...payload,
      currentBid: payload.startingBid,
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
    },
  });
}

/**
 * Handles the placeBid operation.
 * @param {unknown} id
 * @param {unknown} amount
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function placeBid(id, amount, userId) {
  const now = new Date();
  const auction = await db.auction.findUnique({ where: { id } });
  if (!auction) {
    throw new NotFoundError("Auction not found");
  }

  if (auction.status !== "LIVE") {
    throw new ValidationError("Auction is not live");
  }

  if (now < auction.startAt || now > auction.endAt) {
    throw new ValidationError("Bidding is closed for this auction");
  }

  const minBid = auction.currentBid + auction.bidIncrement;
  if (amount < minBid) {
    throw new ValidationError(`Bid must be at least ${minBid}`);
  }

  const bid = await db.bid.create({
    data: {
      auctionId: auction.id,
      userId,
      amount,
    },
  });

  const updatedAuction = await db.auction.update({
    where: { id: auction.id },
    data: { currentBid: amount, winnerId: userId },
  });

  emitAuctionBid({
    auctionId: auction.id,
    currentBid: updatedAuction.currentBid,
    bid,
  });

  return { bid, auction: updatedAuction };
}

/**
 * Handles the payForAuction operation.
 * @param {unknown} id
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function payForAuction(id, userId, payload) {
  const auction = await db.auction.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!auction) {
    throw new NotFoundError("Auction not found");
  }

  if (!auction.winnerId || auction.winnerId !== userId) {
    throw new ForbiddenError("Only the winning bidder can pay for this auction");
  }

  if (new Date() < auction.endAt) {
    throw new ValidationError("Auction has not ended yet");
  }

  if (auction.status === "CANCELLED") {
    throw new ValidationError("Cancelled auctions cannot be paid");
  }

  const orderAmount = Number(auction.currentBid || auction.startingBid || 0);
  if (orderAmount <= 0) {
    throw new ValidationError("Invalid auction price");
  }

  const payment = await createPayment({
    amount: orderAmount,
    description: "Craftify auction winner payment",
    paymentMethodToken: payload.paymentMethodToken,
    metadata: {
      userId,
      auctionId: auction.id,
      source: "auction",
    },
  });

  if (payment.status !== "succeeded") {
    throw new PaymentRequiredError("Payment was not completed");
  }

  const shippingData = {
    shippingName: payload.shippingName,
    shippingEmail: payload.shippingEmail,
    shippingStreet: payload.shippingStreet,
    shippingCity: payload.shippingCity,
    shippingState: payload.shippingState,
    shippingZip: payload.shippingZip,
  };

  const order = await db.transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        userId,
        totalAmount: orderAmount,
        ...shippingData,
        items: {
          create: {
            productId: auction.productId,
            quantity: 1,
            unitPrice: orderAmount,
          },
        },
      },
      include: { items: true },
    });

    if (auction.status !== "ENDED") {
      await tx.auction.update({
        where: { id: auction.id },
        data: { status: "ENDED" },
      });
    }

    return createdOrder;
  });

  return {
    order,
    payment: {
      provider: payment.provider,
      paymentId: payment.paymentId,
      status: payment.status,
    },
  };
}

module.exports = {
  listLiveAuctions,
  getAuctionById,
  createAuction,
  placeBid,
  payForAuction,
};
