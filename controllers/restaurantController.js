const Restaurant = require('../models/Restaurant');
const cloudinary = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');

// 🔑 Sirf yeh fields owner khud update kar sakta h — approval/active status
// SUPERADMIN-only fields hain, yahan se touch nahi honi chahiye
const ALLOWED_PROFILE_FIELDS = ['name', 'address', 'timings', 'phone', 'description'];

// @desc    Update profile configurations (Logo, Theme, Address)
// @route   PATCH /api/v1/restaurant/profile
exports.updateRestaurantProfile = asyncHandler(async (req, res) => {
  const updates = {};

  // 🔑 Whitelist filtering — isApproved, isActive, slug, restaurantId jaise
  // sensitive fields yahan se kabhi update nahi honge chahe body mein bheje jaayein
  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (req.file) {
    try {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploadResponse = await cloudinary.uploader.upload(base64Image, {
        folder: 'restaurant_logos',
      });
      updates.logo = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(502).json({ success: false, message: 'Logo upload failed, please try again' });
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
  }

  const updatedRestaurant = await Restaurant.findByIdAndUpdate(
    req.user.restaurantId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!updatedRestaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }

  res.status(200).json({ success: true, data: updatedRestaurant });
});

// @desc    Public landing entry point to pull metadata via clean sub-domain/slug URL
// @route   GET /api/v1/restaurant/public/:slug
exports.getPublicRestaurantDetails = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findOne({
    slug: req.params.slug.toLowerCase(),
    isActive: true,
  }).select('name slug address logo timings'); // 🔑 sirf public-safe fields — email/phone jaisi internal details expose nahi hoti

  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Restaurant not found or disabled' });
  }
  res.status(200).json({ success: true, data: restaurant });
});