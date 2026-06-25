const express = require('express');
const router = express.Router();
const { updateRestaurantProfile, getPublicRestaurantDetails } = require('../controllers/restaurantController');
const { protect, authorize } = require('../middleware/auth');
const tenantContext = require('../middleware/tenant');
const upload = require('../middleware/upload');

// Admin panel dynamic setups
router.patch('/profile', protect, authorize('OWNER', 'MANAGER'), tenantContext, upload.single('logo'), updateRestaurantProfile);

// Public interface endpoint (No Auth token verification layers required)
router.get('/public/:slug', getPublicRestaurantDetails);

module.exports = router;