const express = require("express");
const router = express.Router();
const {
  placeOrder,
  updateOrderStatus,
  getLiveAdminOrders,
  completeOrder,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/auth");
const tenantContext = require("../middleware/tenant");

// Public checkout route interface target
router.post("/place", placeOrder);

// Admin-isolated real-time state manipulation pipeline interfaces
router.get(
  "/live",
  protect,
  authorize("OWNER", "MANAGER", "STAFF"),
  tenantContext,
  getLiveAdminOrders,
);
router.patch(
  "/:id/status",
  protect,
  authorize("OWNER", "MANAGER", "STAFF"),
  tenantContext,
  updateOrderStatus,
);

// Naya route add karein
router.patch(
  "/:id/complete",
  protect,
  authorize("OWNER", "MANAGER", "STAFF"),
  tenantContext,
  completeOrder,
);

module.exports = router;
