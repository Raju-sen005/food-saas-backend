const express = require('express');
const http = require('http'); // <-- NEW Core HTTP Module
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket } = require('./services/socketService'); // <-- NEW Socket Loader
const { protect, restrictTo } = require('./middleware/auth'); // Path check kar lein
// Load endpoints variants
const authRoutes = require('./routes/authRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes'); // <-- NEW Route
const adminRoutes = require('./routes/adminRoutes'); // Nayi file banayein
const analyticsRoutes = require('./routes/analyticsRoutes')
const offerRoutes = require("./routes/offerRoutes");
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); // <-- Attach express application to Native Server framework

// Initialize Socket.io cluster layer context injection mapping
initSocket(server);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Base API endpoints mounts
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/restaurant', restaurantRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/orders', orderRoutes); // <-- NEW MOUNT INTERFACE
app.use('/api/v1/analytics', analyticsRoutes)
app.use("/api/v1/offers", offerRoutes);
app.use('/api/v1/admin', protect, restrictTo('SUPERADMIN'), adminRoutes);

const PORT = process.env.PORT || 5000;
// CRITICAL: Ab app.listen nahi, balki server.listen hook call karna hai!
server.listen(PORT, () => {
  console.log(`🚀 Scalable real-time network server executing cleanly on port: ${PORT}`);
});