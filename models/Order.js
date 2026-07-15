const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: {
      type: String,
      required: true,
      // 🔑 basic Indian mobile format validation at DB level — defense in depth,
      // frontend validation bypass ho sakta h (direct API hit se)
      match: [/^[6-9]\d{9}$/, "Please provide a valid 10-digit mobile number"],
    },
    orderType: { type: String, enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"], required: true },
    items: [
      {
        itemType: { type: String, enum: ["SINGLE", "COMBO"], required: true },
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED"],
      default: "PENDING",
    },
    tableNumber: { type: String, default: "N/A" },
    rejectReason: { type: String, default: "" },
  },
  { timestamps: true },
);

// 🔑 Duplicate hata diye — sirf ek baar declare
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, tableNumber: 1 });

module.exports = mongoose.model("Order", orderSchema);