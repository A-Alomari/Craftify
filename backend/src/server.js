const http = require("http");
const { app } = require("./app");
const { env } = require("./config/env");
const { attachSocketServer } = require("./config/socket");

const server = http.createServer(app);
attachSocketServer(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Craftify API listening on port ${env.port}`);
});
