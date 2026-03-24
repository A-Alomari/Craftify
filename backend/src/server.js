const http = require("http");
const { app } = require("./app");
const { env } = require("./config/env");
const { attachSocketServer } = require("./config/socket");
const { prisma } = require("./db/prisma");

const server = http.createServer(app);
attachSocketServer(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ Craftify API listening on port ${env.port} [${env.nodeEnv}]`);
});

/* ---------- graceful shutdown ---------- */
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n🛑 ${signal} received — shutting down gracefully…`);

  server.close(async () => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.log("   Database disconnected. Goodbye! 👋");
    process.exit(0);
  });

  // Force exit after 10 s if graceful shutdown stalls
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("   Shutdown timed out — forcing exit.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
