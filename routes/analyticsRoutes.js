const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth'); // Aapka existing auth middleware
const tenantContext = require('../middleware/tenant'); // Naya middleware

// Order: Pehle protect (user check), phir tenantContext (context inject)
router.get('/summary', protect, tenantContext, getDashboardStats);

module.exports = router;