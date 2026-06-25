const express = require('express');
const router = express.Router();
const { registerTenant, login, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerTenant);
router.post('/login', login);
router.post('/logout', logout);

// Profile routes sanity test
router.get('/me', protect, (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

module.exports = router;