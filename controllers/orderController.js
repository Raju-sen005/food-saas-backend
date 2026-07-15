const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Combo = require("../models/Combo");
const { getIO } = require("../services/socketService");
const axios = require("axios");
const asyncHandler = require("../utils/asyncHandler");

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
      console.log("⚠️ WhatsApp env configuration missing.");
      return;
    }

    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: "order_rejection_alert",
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName },
                { type: "text", text: orderId },
                { type: "text", text: restaurantName },
                { type: "text", text: rejectReason || "High order volume" },
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
      console.log(`🚀 WhatsApp notification sent to: ${formattedPhone}`);
    }
  } catch (error) {
    console.error("❌ WhatsApp API error:", error.response?.data || error.message);
  }
};

// 🔑 Unique order ID — timestamp-based suffix se collision practically impossible ho jaata h
const generateReadableOrderId = () => {
  const timestampPart = Date.now().toString(36).slice(-5).toUpperCase();
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `#ORD-${timestampPart}${randomPart}`;
};

// 🔑 Buffer.from — atob browser API h, Node mein hamesha reliable nahi
const decodeTableToken = (token) => {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (!decoded.includes("-TABLE-")) return "N/A";
    return decoded.split("-TABLE-")[1];
  } catch (e) {
    return "N/A";
  }
};

// @desc    Guest customer placing checkout cart objects
// @route   POST /api/v1/orders/place
exports.placeOrder = asyncHandler(async (req, res) => {
  const {
    restaurantId,
    customerName,
    customerPhone,
    orderType,
    items,
    deliveryAddress,
    tableToken,
  } = req.body;

  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Restaurant and items are required" });
  }

  const decodedTable = decodeTableToken(tableToken);

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

  if (orderType === "DELIVERY" && (!deliveryAddress || deliveryAddress.length < 5)) {
    return res.status(400).json({
      success: false,
      message: "Delivery address is required for delivery orders",
    });
  }

  // 🔑 CRITICAL FIX: prices client se trust nahi karte — DB se actual price nikaal ke
  // server khud subtotal/total calculate karta h. Isse koi bhi customer price tamper
  // nahi kar sakta.
  const itemIds = items.filter((i) => i.itemType !== "COMBO").map((i) => i.itemId);
  const comboIds = items.filter((i) => i.itemType === "COMBO").map((i) => i.itemId);

  const [dbItems, dbCombos] = await Promise.all([
    itemIds.length > 0 ? MenuItem.find({ _id: { $in: itemIds }, restaurantId }) : [],
    comboIds.length > 0 ? Combo.find({ _id: { $in: comboIds }, restaurantId }) : [],
  ]);

  const itemPriceMap = new Map(dbItems.map((i) => [i._id.toString(), i]));
  const comboPriceMap = new Map(dbCombos.map((c) => [c._id.toString(), c]));

  let subtotal = 0;
  const verifiedItems = [];

  for (const cartItem of items) {
    const source = cartItem.itemType === "COMBO" ? comboPriceMap : itemPriceMap;
    const dbRecord = source.get(cartItem.itemId);

    if (!dbRecord) {
      return res.status(400).json({
        success: false,
        message: `Item "${cartItem.name || cartItem.itemId}" is no longer available`,
      });
    }

    const qty = Math.max(1, Number(cartItem.quantity) || 1);
    const actualPrice = Number(dbRecord.price);
    subtotal += actualPrice * qty;

    verifiedItems.push({
      itemId: dbRecord._id,
      name: dbRecord.name,
      quantity: qty,
      price: actualPrice, // 🔑 server-verified price, client wala nahi
      itemType: cartItem.itemType === "COMBO" ? "COMBO" : "SINGLE",
    });
  }

  const tax = 0; // agar tax logic h toh yahan server-side se calculate karo, client se nahi
  const total = subtotal + tax;

  const newOrder = await Order.create({
    restaurantId,
    orderId: generateReadableOrderId(),
    customerName,
    customerPhone,
    orderType,
    tableNumber: decodedTable,
    deliveryAddress: deliveryAddress || "",
    items: verifiedItems,
    subtotal,
    tax,
    total,
  });

  const io = getIO();
  io.to(restaurantId.toString()).emit("NEW_ORDER_RECEIVED", newOrder);

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order: newOrder,
  });
});

const VALID_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"];

// @desc    Admin transitioning live status configurations
// @route   PATCH /api/v1/orders/:id/status
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, rejectReason } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status value" });
  }

  const order = await Order.findOne({
    _id: req.params.id,
    restaurantId: req.user.restaurantId,
  }).populate("restaurantId");

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  order.status = status;
  if (status === "REJECTED" && rejectReason) {
    order.rejectReason = rejectReason;
  }

  await order.save();

  const io = getIO();
  io.to(order._id.toString()).emit("ORDER_STATUS_UPDATED", {
    orderId: order.orderId,
    status: order.status,
    rejectReason: order.rejectReason,
  });

  if (status === "REJECTED") {
    const currentRestaurantName = order.restaurantId?.name || "Our Kitchen";
    // 🔑 await nahi lagaya intentionally — order response ko WhatsApp API ke liye
    // block nahi karna chahiye, background mein bhejo aur error ko internally log hone do
    sendOfficialWhatsAppNotification(
      order.customerPhone,
      order.customerName,
      order.orderId,
      currentRestaurantName,
      order.rejectReason || "High order volume",
    );
  }

  res.status(200).json({
    success: true,
    message: `Order marked as ${status}`,
    data: order,
  });
});

// @desc    Get Tenant specific live orders for TODAY ONLY
// @route   GET /api/v1/orders/live
exports.getLiveAdminOrders = asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const liveOrders = await Order.find({
    restaurantId: req.user.restaurantId,
    createdAt: { $gte: startOfToday, $lte: endOfToday },
  }).sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: liveOrders.length, data: liveOrders });
});

// @desc    Complete Order & Free the Table
// @route   PATCH /api/v1/orders/:id/complete
exports.completeOrder = asyncHandler(async (req, res) => {
  // 🔑 CRITICAL FIX: restaurantId scoping add kiya — pehle koi bhi user kisi
  // dusre restaurant ka order ID guess karke complete kar sakta tha
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, restaurantId: req.user.restaurantId },
    { status: "COMPLETED" },
    { new: true },
  );

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const io = getIO();
  io.to(order.restaurantId.toString()).emit("ORDER_STATUS_UPDATED", order);

  res.status(200).json({ success: true, message: "Table is now free!" });
});