const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  orderId: { type: String, required: true, unique: true }, // Short readable order tracking code (e.g., #RA-102)
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true },
  orderType: { type: String, enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'], required: true },
  items: [{
    itemType: { type: String, enum: ['SINGLE', 'COMBO'], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACCEPTED', 'COMPLETED', 'REJECTED'], 
    default: 'PENDING' 
  },
  rejectReason: { type: String, default: "" }
}, { timestamps: true });

// Optimize indexes for the live tracker dashboard and background aggregation analytical flows
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);