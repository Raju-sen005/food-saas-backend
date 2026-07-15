const express = require('express');
const router = express.Router();
const { updateRestaurantProfile, getPublicRestaurantDetails } = require('../controllers/restaurantController');
const { protect, restrictTo } = require('../middleware/auth');
const tenantContext = require('../middleware/tenant');
const { upload, handleUploadErrors } = require('../middleware/upload');

router.patch(
  '/profile',
  protect,
  restrictTo('OWNER'),
  tenantContext,
  handleUploadErrors(upload.single('image')),
  updateRestaurantProfile
);

router.get('/public/:slug', getPublicRestaurantDetails);

module.exports = router;