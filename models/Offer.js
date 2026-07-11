const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  title: { type: String, required: true }, // e.g., "50% OFF on Pizza"
  description: { type: String },
  discountType: { type: String, enum: ["PERCENTAGE", "FLAT"], default: "PERCENTAGE" },
  discountValue: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  targetItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }]
}, { timestamps: true });

module.exports = mongoose.model("Offer", offerSchema);