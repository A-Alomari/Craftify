const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  databaseUrl: process.env.DATABASE_URL,
  authCookieName: process.env.AUTH_COOKIE_NAME || "craftify_access",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "craftify_refresh",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",
  paymentProvider: process.env.PAYMENT_PROVIDER || "mock",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
};

/* ---------- production startup validation ---------- */
if (env.nodeEnv === "production") {
  const missing = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (env.jwtAccessSecret === "dev_access_secret") missing.push("JWT_ACCESS_SECRET");
  if (env.jwtRefreshSecret === "dev_refresh_secret") missing.push("JWT_REFRESH_SECRET");

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\n❌  FATAL — missing / default env vars in production:\n   ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }
}

module.exports = { env };
