const dotenv = require("dotenv");
dotenv.config(); // 🔑 SABSE PEHLE — taaki neeche ke saare requires ko env vars milein

const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const { initSocket } = require("./services/socketService");
const { protect, restrictTo } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const offerRoutes = require("./routes/offerRoutes");

connectDB();

const app = express();
const server = http.createServer(app);

initSocket(server);

// 🔑 Environment-driven CORS — comma-separated list of allowed origins in .env
// e.g. ALLOWED_ORIGINS=http://localhost:5173,https://chotu-frontend-ngph.onrender.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173" || "https://chotu-frontend-ngph.onrender.com")
  .split(",")
  .map((o) => o.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Postman/server-to-server requests mein origin undefined hota h — allow karo
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" })); // limit bhi lagaya — bina limit ke bade payloads DoS risk hain
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/restaurant", restaurantRoutes);
app.use("/menu", menuRoutes);
app.use("/orders", orderRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/offers", offerRoutes);
app.use("/admin", protect, restrictTo("SUPERADMIN"), adminRoutes);

// 🔑 404 handler — unknown routes pe clean JSON response
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// 🔑 Centralized error handler — koi bhi uncaught error yahan JSON format mein aayega,
// Express ka default HTML error page kabhi frontend ko nahi dikhega
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port: ${PORT}`);
});

// 🔑 Graceful shutdown — SIGTERM (jaise Render/Docker restart signal) pe
// active connections ko properly close hone do, abrupt kill nahi
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});