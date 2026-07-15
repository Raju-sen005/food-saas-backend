const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const Combo = require("../models/Combo");
const Offer = require("../models/Offer");
const asyncHandler = require("../utils/asyncHandler");

// --- ADMIN MENU ACTIONS ---

exports.createMenuItem = asyncHandler(async (req, res) => {
  const { name, category, description, price, image } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ success: false, message: "Name, category and price are required" });
  }

  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ success: false, message: "Price must be a valid non-negative number" });
  }

  const item = await MenuItem.create({
    restaurantId: req.user.restaurantId,
    name: name.trim(),
    category: category.trim(),
    description: description?.trim() || "",
    price: numericPrice,
    image: image || "",
  });

  res.status(201).json({ success: true, data: item });
});

exports.getAdminMenuItems = asyncHandler(async (req, res) => {
  const items = await MenuItem.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: items.length, data: items });
});

exports.updateMenuItem = asyncHandler(async (req, res) => {
  const updates = { ...req.body };

  // 🔑 restaurantId ko update payload se explicitly hata do — koi accidentally/maliciously
  // apna item kisi doosre tenant ko transfer na kar sake
  delete updates.restaurantId;

  if (updates.price !== undefined) {
    const numericPrice = Number(updates.price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ success: false, message: "Price must be a valid non-negative number" });
    }
    updates.price = numericPrice;
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, restaurantId: req.user.restaurantId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!item) {
    return res.status(404).json({ success: false, message: "Item not found in your catalog" });
  }
  res.status(200).json({ success: true, data: item });
});

exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findOneAndDelete({
    _id: req.params.id,
    restaurantId: req.user.restaurantId,
  });
  if (!item) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }
  res.status(200).json({ success: true, message: "Menu item discarded successfully" });
});

// --- COMBO ACTIONS ---

exports.createCombo = asyncHandler(async (req, res) => {
  const { name, description, items, price, discount, image } = req.body;

  if (!name || !Array.isArray(items) || items.length === 0 || price === undefined) {
    return res.status(400).json({ success: false, message: "Name, items and price are required" });
  }

  // 🔑 Combo ke items bhi apne hi tenant ke hone chahiye — cross-tenant item ID injection na ho
  const validCount = await MenuItem.countDocuments({
    _id: { $in: items },
    restaurantId: req.user.restaurantId,
  });
  if (validCount !== items.length) {
    return res.status(400).json({ success: false, message: "One or more items are invalid" });
  }

  const combo = await Combo.create({
    restaurantId: req.user.restaurantId,
    name: name.trim(),
    description: description?.trim() || "",
    items,
    price: Number(price),
    discount: Number(discount) || 0,
    image: image || "",
  });
  res.status(201).json({ success: true, data: combo });
});

exports.getAdminCombos = asyncHandler(async (req, res) => {
  const combos = await Combo.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: combos.length, data: combos });
});

// --- PUBLIC VIEWING TARGETS (FOR QR SCANNING CUSTOMERS) ---

exports.getPublicCatalog = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  const restaurant = await Restaurant.findById(restaurantId).select(
    "name address logo timings isActive"
  );

  if (!restaurant) {
    return res.status(404).json({ success: false, message: "Restaurant not found" });
  }

  // 🔑 Blocked restaurant ka menu public customers ko serve nahi hona chahiye
  if (!restaurant.isActive) {
    return res.status(403).json({ success: false, message: "This restaurant is currently unavailable" });
  }

  // 🔑 Teeno queries parallel — pehle sequential the, response time slow tha
  const [activeItems, activeCombos, activeOffers] = await Promise.all([
    MenuItem.find({ restaurantId, isAvailable: true }),
    Combo.find({ restaurantId, isAvailable: true }).populate("items", "name price image"),
    Offer.find({ restaurantId, isActive: true }),
  ]);

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
        timings: restaurant.timings,
      },
      categories: groupedMenu,
      combos: activeCombos,
      offers: activeOffers,
    },
  });
});

// --- COMBO EDIT & DELETE ---

exports.updateCombo = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  delete updates.restaurantId;

  const combo = await Combo.findOneAndUpdate(
    { _id: req.params.id, restaurantId: req.user.restaurantId },
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!combo) {
    return res.status(404).json({ success: false, message: "Combo not found" });
  }
  res.status(200).json({ success: true, data: combo });
});

exports.deleteCombo = asyncHandler(async (req, res) => {
  const combo = await Combo.findOneAndDelete({
    _id: req.params.id,
    restaurantId: req.user.restaurantId,
  });
  if (!combo) {
    return res.status(404).json({ success: false, message: "Combo not found" });
  }
  res.status(200).json({ success: true, message: "Combo discarded successfully" });
});