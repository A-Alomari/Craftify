const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "production"
      ? ["warn", "error"]
      : ["query", "warn", "error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

/**
 * Attempt an initial connection so the pool is warm.
 * If the first attempt fails (Render cold-start), retry once.
 */
async function connectWithRetry(retries = 3, delay = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      if (i === retries) throw err;
      // eslint-disable-next-line no-console
      console.warn(`⏳ DB connect attempt ${i}/${retries} failed, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

module.exports = { prisma, connectWithRetry };
