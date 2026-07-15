// Yeh middleware sirf tenant-scoped routes (jaise /menu, /orders, /offers) pe use hota h,
// SUPERADMIN routes pe nahi (wo already /admin prefix ke through restrictTo('SUPERADMIN') se gate hote hain)
const tenantContext = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized, please login' });
  }

  if (!req.user.restaurantId) {
    return res.status(400).json({ success: false, message: 'Tenant context missing from user session' });
  }

  next();
};

module.exports = tenantContext;