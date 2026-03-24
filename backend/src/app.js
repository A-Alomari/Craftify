const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { env } = require("./config/env");
const { apiRouter } = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Craftify API is running" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
