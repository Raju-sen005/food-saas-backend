const Offer = require("../models/Offer");
const MenuItem = require("../models/MenuItem"); // apne actual model path se match karo
const asyncHandler = require("../utils/asyncHandler");

exports.createOffer = asyncHandler(async (req, res) => {
  const { title, discountValue, description, targetItems } = req.body;
  const restaurantId = req.user.restaurantId;

  if (!title || discountValue === undefined) {
    return res.status(400).json({ success: false, message: "Title and discount value are required" });
  }

  const discount = Number(discountValue);
  if (Number.isNaN(discount) || discount <= 0 || discount > 100) {
    return res.status(400).json({ success: false, message: "Discount value must be between 1 and 100" });
  }

  const items = Array.isArray(targetItems) ? targetItems : [];

  // 🔑 Multi-tenant safety check: sirf apne hi restaurant ke items target ho sakein
  if (items.length > 0) {
    const validCount = await MenuItem.countDocuments({
      _id: { $in: items },
      restaurantId,
    });
    if (validCount !== items.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected items do not belong to your restaurant",
      });
    }
  }

  const newOffer = await Offer.create({
    title: title.trim(),
    discountValue: discount,
    description: description?.trim() || "",
    targetItems: items,
    restaurantId,
  });

  res.status(201).json({ success: true, data: newOffer });
});

exports.getOffers = asyncHandler(async (req, res) => {
  const offers = await Offer.find({ restaurantId: req.user.restaurantId })
    .populate("targetItems", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, data: offers });
});

exports.deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findOneAndDelete({
    _id: req.params.id,
    restaurantId: req.user.restaurantId,
  });

  if (!offer) {
    return res.status(404).json({ success: false, message: "Offer not found" });
  }

  res.status(200).json({ success: true, message: "Offer deleted successfully" });
});