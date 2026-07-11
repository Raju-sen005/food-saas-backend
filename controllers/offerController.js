const Offer = require("../models/Offer");

exports.createOffer = async (req, res) => {
  try {
    // 1. targetItems ko body se extract karein
    const { title, discountValue, description, targetItems } = req.body;
    const restaurantId = req.user.restaurantId; 
    
    // 2. data object mein targetItems include karein
    const newOffer = await Offer.create({ 
      title, 
      discountValue, 
      description, 
      targetItems: targetItems || [], // Array save hoga
      restaurantId 
    });
    
    res.status(201).json({ success: true, data: newOffer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ restaurantId: req.user.restaurantId })
                              .populate("targetItems", "name"); // Item ka sirf name mil jayega
    res.status(200).json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// controllers/offerController.js
exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findOneAndDelete({ 
      _id: req.params.id, 
      restaurantId: req.user.restaurantId 
    });

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};