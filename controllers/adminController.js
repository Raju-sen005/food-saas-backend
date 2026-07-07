// controllers/adminController.js
const Restaurant = require('../models/Restaurant');

exports.getAllRestaurants = async (req, res) => {
  // Sirf SUPERADMIN role wala user hi ise access kar sakta hai (Middleware check zaroori hai)
  const restaurants = await Restaurant.find({});
  res.status(200).json({ success: true, data: restaurants });
};

exports.toggleApproval = async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;
  const restaurant = await Restaurant.findByIdAndUpdate(id, { isApproved }, { new: true });
  res.status(200).json({ success: true, data: restaurant });
};

exports.toggleBlockStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body; // Frontend se aayega
  await Restaurant.findByIdAndUpdate(id, { isActive });
  res.json({ success: true });
};