const Restaurant = require('../models/Restaurant');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllRestaurants = asyncHandler(async (req, res) => {
  // Basic pagination — restaurants badhne pe response bloat na ho
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const skip = (page - 1) * limit;

  const [restaurants, total] = await Promise.all([
    Restaurant.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Restaurant.countDocuments({}),
  ]);

  res.status(200).json({
    success: true,
    data: restaurants,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

exports.toggleApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;

  if (typeof isApproved !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isApproved must be a boolean' });
  }

  const restaurant = await Restaurant.findByIdAndUpdate(id, { isApproved }, { new: true });

  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }

  res.status(200).json({ success: true, data: restaurant });
});

exports.toggleBlockStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
  }

  const restaurant = await Restaurant.findByIdAndUpdate(id, { isActive }, { new: true });

  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }

  res.status(200).json({ success: true, data: restaurant });
});