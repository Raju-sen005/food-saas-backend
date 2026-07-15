const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");

// 🔑 Single source of truth for cookie config — env-driven, local dev mein bhi kaam karega
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge,
});

const generateTokenAndSetCookie = (res, userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }

  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d", // 🔑 note: cookie maxAge 30 din tha, token khud 7 din mein expire — mismatch tha, neeche align kiya
  });

  res.cookie("jwt", token, getCookieOptions(7 * 24 * 60 * 60 * 1000));
  return token;
};

// @desc    Register a new Restaurant (Tenant) & Owner
// @route   POST /api/v1/auth/register
exports.registerTenant = asyncHandler(async (req, res) => {
  const { restaurantName, slug, name, email, password, phone } = req.body;

  if (!restaurantName || !slug || !name || !email || !password || !phone) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();

  // 🔑 Transaction — agar user creation fail ho, restaurant creation bhi rollback ho jaaye,
  // orphaned restaurant records DB mein nahi reh jaayenge
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const slugExists = await Restaurant.findOne({ slug: normalizedSlug }).session(session);
    if (slugExists) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Slug/Custom URL already taken" });
    }

    const userExists = await User.findOne({ email: normalizedEmail }).session(session);
    if (userExists) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const [restaurant] = await Restaurant.create(
      [{ name: restaurantName, slug: normalizedSlug, phone, email: normalizedEmail }],
      { session }
    );

    const [user] = await User.create(
      [{
        restaurantId: restaurant._id,
        name,
        email: normalizedEmail,
        password,
        role: "OWNER",
      }],
      { session }
    );

    await session.commitTransaction();

    generateTokenAndSetCookie(res, user._id);

    res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        restaurant,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Registration error:", error);

    // Duplicate key error ko friendly message mein convert karo
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Email or Slug already in use" });
    }
    res.status(500).json({ success: false, message: "Registration failed. Please try again." });
  } finally {
    session.endSession();
  }
});

// @desc    Login User (Owner/Staff)
// @route   POST /api/v1/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please provide email and password" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 🔑 .select('+password') — agar schema mein password select:false h, yeh zaroori h
  // varna comparePassword hamesha fail karega chahe sahi password diya ho
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  // 🔑 Null-safe restaurant check — pehle yeh SUPERADMIN ke alawa har user ke liye
  // restaurant null hone pe crash karta tha
  if (user.role !== "SUPERADMIN") {
    const restaurant = await Restaurant.findById(user.restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your restaurant account is currently inactive. Please contact support for assistance.",
      });
    }
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
});

// @desc    Logout User / Clear Cookie
// @route   POST /api/v1/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", { ...getCookieOptions(0), expires: new Date(0) });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});