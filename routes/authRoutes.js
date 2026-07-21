const express = require("express");
const router = express.Router();
const {
  registerTenant,
  login,
  renewSubscription,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", registerTenant);
router.post("/login", login);
router.post("/logout", logout);
router.post("/renew-subscription", renewSubscription); // Added route
// Profile routes sanity test
router.get("/me", protect, (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

module.exports = router;
