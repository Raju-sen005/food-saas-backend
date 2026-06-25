const express = require("express");
const router = express.Router();
const {
  placeOrder,
  updateOrderStatus,
  getLiveAdminOrders,
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

module.exports = router;
