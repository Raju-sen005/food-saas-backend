const express = require("express");
const router = express.Router();
const {
  placeOrder,
  updateOrderStatus,
  getLiveAdminOrders,
  completeOrder,
} = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/auth");
const tenantContext = require("../middleware/tenant");

router.post("/place", placeOrder);

router.get("/live", protect, restrictTo('OWNER', 'STAFF'), tenantContext, getLiveAdminOrders);
router.patch("/:id/status", protect, restrictTo('OWNER', 'STAFF'), tenantContext, updateOrderStatus);
router.patch("/:id/complete", protect, restrictTo('OWNER', 'STAFF'), tenantContext, completeOrder);

module.exports = router;