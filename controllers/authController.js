const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

// @desc    Register a new Restaurant (Tenant) & Owner
// @route   POST /api/v1/auth/register
exports.registerTenant = async (req, res) => {
  const { restaurantName, slug, name, email, password, phone } = req.body;

  try {
    // Check if slug is unique
    const slugExists = await Restaurant.findOne({ slug: slug.toLowerCase() });
    if (slugExists)
      return res
        .status(400)
        .json({ success: false, message: "Slug/Custom URL already taken" });

    // Check if user email exists
    const userExists = await User.findOne({ email });
    if (userExists)
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });

    // 1. Create Restaurant Profile
    const restaurant = await Restaurant.create({
      name: restaurantName,
      slug: slug.toLowerCase(),
      phone,
      email,
    });

    // 2. Create Owner Account linked to this Restaurant
    const user = await User.create({
      restaurantId: restaurant._id,
      name,
      email,
      password,
      role: "OWNER",
    });

    generateTokenAndSetCookie(res, user._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        restaurant,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login User (Owner/Staff)
// @route   POST /api/v1/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

   // controllers/authController.js

const restaurant = await Restaurant.findById(user.restaurantId);

// Check: Agar user SUPERADMIN nahi hai, TABHI isActive check karein
if (user.role !== 'SUPERADMIN' && !restaurant.isActive) {
  return res.status(403).json({
    success: false,
    message: "Your restaurant account is currently inactive. Please contact support for assistance.",
  });
}

    generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout User / Clear Cookie
// @route   POST /api/v1/auth/logout
exports.logout = async (req, res) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};
