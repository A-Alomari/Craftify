const { Server } = require("socket.io");
const { env } = require("./env");

let io;

function attachSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin === "*" ? true : env.clientOrigin,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join:auction", (auctionId) => {
      socket.join(`auction:${auctionId}`);
    });

    socket.on("join:conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("join:user", (userId) => {
      socket.join(`user:${userId}`);
    });
  });

  return io;
}

function getIo() {
  return io;
}

module.exports = { attachSocketServer, getIo };
