const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getAllRestaurants, toggleApproval, toggleBlockStatus } = require('../controllers/adminController');

router.get('/restaurants', protect, restrictTo('SUPERADMIN'), getAllRestaurants);
router.patch('/restaurants/:id/approve', protect, restrictTo('SUPERADMIN'), toggleApproval);

// 🔑 Duplicate inline logic hata di — pehle se bana hua toggleBlockStatus controller use karo,
// jo already whitelist-safe h (sirf isActive field accept karta h) aur asyncHandler-wrapped h
router.patch('/restaurants/:id/status', protect, restrictTo('SUPERADMIN'), toggleBlockStatus);

module.exports = router;