const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { env } = require("./config/env");
const { apiRouter } = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

/* ---------- reverse-proxy trust (Render / Heroku / etc.) ---------- */
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

/* ---------- global middleware ---------- */
app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------- rate limiting ---------- */
if (env.nodeEnv !== "test") {
  app.use("/api", apiLimiter);
}

/* ---------- health check ---------- */
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Craftify API is running" });
});

/* ---------- serve frontend ---------- */
const rootPath = path.join(__dirname, "../../");
// Serve specific frontend folders securely without exposing backend code
app.use("/assets", express.static(path.join(rootPath, "assets")));
app.use("/pages", express.static(path.join(rootPath, "pages")));
app.use("/views", express.static(path.join(rootPath, "views")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve the main index.html file cleanly at the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(rootPath, "index.html"));
});

/* ---------- API routes ---------- */
app.use("/api", apiRouter);

/* ---------- error handling ---------- */
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
