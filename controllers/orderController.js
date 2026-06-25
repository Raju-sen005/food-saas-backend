const Order = require('../models/Order');
const { getIO } = require('../services/socketService');

// Helper to compile incremental algorithmic daily tokens (#RS-0001)
const generateReadableOrderId = () => {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `#ORD-${code}`;
};

// @desc    Guest customer placing checkout cart objects
// @route   POST /api/v1/orders/place
exports.placeOrder = async (req, res) => {
  try {
    // 👈 req.body se deliveryAddress ko extract kiya
    const { restaurantId, customerName, customerPhone, orderType, items, subtotal, tax, total, deliveryAddress } = req.body;

    const newOrder = await Order.create({
      restaurantId,
      orderId: generateReadableOrderId(),
      customerName,
      customerPhone,
      orderType,
      deliveryAddress: deliveryAddress || '', // 👈 Isse database documents me clean structural binding save hogi
      items,
      subtotal: Number(subtotal),
      tax: Number(tax) || 0,
      total: Number(total)
    });

    const io = getIO();
    io.to(restaurantId.toString()).emit('NEW_ORDER_RECEIVED', newOrder);

    res.status(201).json({ success: true, message: "Order placed successfully", order: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin transitioning live status configurations
// @route   PATCH /api/v1/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    
    // Explicit multi-tenant data boundary filtering verification block
    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: "Order records not found" });

    order.status = status;
    if (status === 'REJECTED' && rejectReason) {
      order.rejectReason = rejectReason;
    }
    
    await order.save();

    // Broadcast updated status directly to the customer tracker channel room
    const io = getIO();
    io.to(order._id.toString()).emit('ORDER_STATUS_UPDATED', {
      orderId: order.orderId,
      status: order.status,
      rejectReason: order.rejectReason
    });

    res.status(200).json({ success: true, message: `Order marked as ${status}`, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Tenant specific active/pending dashboard items lists
// @route   GET /api/v1/orders/live
exports.getLiveAdminOrders = async (req, res) => {
  try {
    const liveOrders = await Order.find({ 
      restaurantId: req.restaurantId,
      status: { $in: ['PENDING', 'ACCEPTED'] }
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: liveOrders.length, data: liveOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};