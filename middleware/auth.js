const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  // let token = req.cookies.jwt;
 let token = req.cookies.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    next();
  } catch (error) {
    // 🔑 Expired token ko alag se batao — frontend graceful re-login flow dikha sakta h
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired, please login again' });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

// 🔑 authorize hata diya — restrictTo hi ek naam se sab jagah use karo.
// Agar codebase mein kahin `authorize` import ho raha h, use restrictTo se replace kar dena.
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // 🔑 Safety guard — agar protect middleware pehle nahi chala (misconfigured route),
    // yahan crash hone ke bajaye clear 401 milega
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, please login' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user.role}) is not allowed to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };