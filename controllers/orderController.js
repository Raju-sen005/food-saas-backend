const Order = require("../models/Order");
const { getIO } = require("../services/socketService");
const axios = require("axios");

// 🚀 1. PROFESSIONAL DYNAMIC WHATSAPP HANDLER (4 VARIABLES)
const sendOfficialWhatsAppNotification = async (
  customerPhone,
  customerName,
  orderId,
  restaurantName,
  rejectReason,
) => {
  try {
    let formattedPhone = customerPhone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = `91${formattedPhone}`;
    }

    const WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.log("⚠️ Env configuration variables are missing.");
      return;
    }

    // Hit standard Meta endpoint
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: "order_rejection_alert", // Tumhara naya professional template
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName }, // {{1}}
                { type: "text", text: orderId }, // {{2}}
                { type: "text", text: restaurantName }, // {{3}} 👈 Naya dynamic variable attach ho gaya
                { type: "text", text: rejectReason || "High order volume" }, // {{4}}
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 200 || response.status === 201) {
      console.log(
        `🚀 Professional Notification successfully fired to: ${formattedPhone}`,
      );
    }
  } catch (error) {
    console.error(
      "❌ Meta API Core Pipeline Error:",
      error.response?.data || error.message,
    );
  }
};

// Helper to compile incremental algorithmic daily tokens (#RS-0001)
const generateReadableOrderId = () => {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `#ORD-${code}`;
};

// Utility to decode
const decodeTableToken = (token) => {
  try {
    const decoded = atob(token); // Decoding base64
    const parts = decoded.split("-TABLE-");
    return parts[1]; // Returns the table number
  } catch (e) {
    return null;
  }
};

// @desc    Guest customer placing checkout cart objects
// @route   POST /api/v1/orders/place
exports.placeOrder = async (req, res) => {
  try {
    const {
      restaurantId,
      customerName,
      customerPhone,
      orderType,
      items,
      subtotal,
      tax,
      total,
      deliveryAddress,
      tableToken, // 💡 Yahan token receive hoga
    } = req.body;

    // Token se table number decode karein
    const decodedTable = decodeTableToken(tableToken);

    // ✅ Order CREATE karne se PEHLE check karein
    if (decodedTable !== "N/A") {
      const existingOrder = await Order.findOne({
        restaurantId,
        tableNumber: decodedTable,
        status: { $in: ["ACCEPTED", "PENDING"] },
      });

      if (existingOrder) {
        return res.status(400).json({
          success: false,
          message: `Table ${decodedTable} is already occupied. Please bill it first.`,
        });
      }
    }

    const newOrder = await Order.create({
      restaurantId,
      orderId: generateReadableOrderId(),
      customerName,
      customerPhone,
      orderType,
      tableNumber: decodedTable || "N/A", // 💡 Decoded value use karein
      deliveryAddress: deliveryAddress || "",
      items,
      subtotal: Number(subtotal),
      tax: Number(tax) || 0,
      total: Number(total),
    });

    const io = getIO();
    io.to(restaurantId.toString()).emit("NEW_ORDER_RECEIVED", newOrder);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin transitioning live status configurations
// @route   PATCH /api/v1/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, rejectReason } = req.body;

    // 💡 Added .populate() to safely pull restaurant details from MongoDB
    const order = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).populate("restaurantId");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order records not found" });

    order.status = status;
    if (status === "REJECTED" && rejectReason) {
      order.rejectReason = rejectReason;
    }

    await order.save();

    // Broadcast updated status directly to the customer tracker channel room
    const io = getIO();
    io.to(order._id.toString()).emit("ORDER_STATUS_UPDATED", {
      orderId: order.orderId,
      status: order.status,
      rejectReason: order.rejectReason,
    });

    // ⚡ CALLING THE NEW 4-VARIABLE HANDLER
    if (
      status &&
      (status.toUpperCase() === "REJECTED" ||
        status.toUpperCase() === "DECLINED")
    ) {
      console.log(
        `🎯 Professional Rejection pipeline active for order ${order.orderId}...`,
      );

      // 💡 Safely extracts the dynamic restaurant name from populated data
      const currentRestaurantName =
        order.restaurantId && order.restaurantId.name
          ? order.restaurantId.name
          : "Our Kitchen";

      sendOfficialWhatsAppNotification(
        order.customerPhone,
        order.customerName,
        order.orderId,
        currentRestaurantName, // Live dynamic name goes to {{3}}
        order.rejectReason || "High order volume",
      );
    }

    res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Tenant specific active/pending/completed dashboard items lists for TODAY ONLY
// @route   GET /api/v1/orders/live
exports.getLiveAdminOrders = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const liveOrders = await Order.find({
      restaurantId: req.restaurantId,
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    }).sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: liveOrders.length, data: liveOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Complete Order & Free the Table
// @route   PATCH /api/v1/orders/:id/complete
exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "COMPLETED" },
      { new: true },
    );
    res.status(200).json({ success: true, message: "Table is now free!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
