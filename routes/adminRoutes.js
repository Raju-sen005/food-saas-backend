const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); // Aapka existing middleware
const { restrictTo } = require('../middleware/auth');
const { getAllRestaurants, toggleApproval } = require('../controllers/adminController');
const Restaurant = require('../models/Restaurant');

// Sirf SuperAdmin access kar payega
router.get('/restaurants', protect, restrictTo('SUPERADMIN'), getAllRestaurants);
router.patch('/restaurants/:id/approve', protect, restrictTo('SUPERADMIN'), toggleApproval);
// adminRoutes.js
router.patch('/restaurants/:id/status', protect, restrictTo('SUPERADMIN'), async (req, res) => {
  const { id } = req.params;
  const updateData = req.body; // { isApproved: true } ya { isActive: false }
  
  await Restaurant.findByIdAndUpdate(id, updateData);
  res.json({ success: true });
});
module.exports = router;