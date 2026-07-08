const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant'); // Restaurant model import karein
const Combo = require('../models/Combo');
// const cloudinary = require('../config/cloudinary');

// --- ADMIN MENU ACTIONS ---

exports.createMenuItem = async (req, res) => {
  try {
    // Frontend se seedhe 'image' field mein URL string aayegi
    const { name, category, description, price, image } = req.body;

    const item = await MenuItem.create({
      restaurantId: req.restaurantId,
      name,
      category,
      description,
      price,
      image: image || "" // Save directly as text URL
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminMenuItems = async (req, res) => {
  try {
    // Encapsulation Check: Sirf login tenant ka hi items load hoga
    const items = await MenuItem.find({ restaurantId: req.restaurantId });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const updates = { ...req.body }; // Image string text payload automatically parsed here

    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.restaurantId }, 
      { $set: updates },
      { new: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Item not found in your catalog" });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.status(200).json({ success: true, message: "Menu item discarded successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- COMBO ACTIONS ---

exports.createCombo = async (req, res) => {
  try {
    const { name, description, items, price, discount } = req.body;
    const combo = await Combo.create({
      restaurantId: req.restaurantId,
      name,
      description,
      items, // Expects array of MenuItem ObjectIds
      price,
      discount
    });
    res.status(201).json({ success: true, data: combo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAdminCombos = async (req, res) => {
  try {
    const combos = await Combo.find(); // Aapka model name
    res.status(200).json({ status: 'success', data: combos });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// --- PUBLIC VIEWING TARGETS (FOR QR SCANNING CUSTOMERS) ---

exports.getPublicCatalog = async (req, res) => {
  try {
    const { restaurantId } = req.params; // Front-end entry passes this from the initial public slug payload resolve
// 1. Parallel fetch: Restaurant details + Menu Items + Combos
    const [restaurant] = await Promise.all([
      Restaurant.findById(restaurantId),
      // MenuItem.find({ restaurantId, isAvailable: true }),
      // Combo.find({ restaurantId, isAvailable: true }).populate('items', 'name price image')
    ]);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }
    const activeItems = await MenuItem.find({ restaurantId, isAvailable: true });
    const activeCombos = await Combo.find({ restaurantId, isAvailable: true }).populate('items', 'name price image');

    // Categorization layout aggregation structure compile karein response pipeline mein
    const groupedMenu = activeItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
            name: restaurant.name,
            address: restaurant.address,
            logo: restaurant.logo,
            timings: restaurant.timings
        },
        categories: groupedMenu,
        combos: activeCombos
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};