const mongoose = require('mongoose');

const comboSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  image: { type: String, default: "" },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true }],
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 }, // Optional display value for UI styling
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

comboSchema.index({ restaurantId: 1, isAvailable: 1 });

module.exports = mongoose.model('Combo', comboSchema);