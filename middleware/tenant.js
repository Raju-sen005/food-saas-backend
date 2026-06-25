// This middleware ensures that whenever an authenticated user makes a request,
// their restaurant context is injected into the request object.
const tenantContext = (req, res, next) => {
  if (req.user && req.user.restaurantId) {
    req.restaurantId = req.user.restaurantId;
    next();
  } else {
    return res.status(400).json({ success: false, message: 'Tenant context missing from user session' });
  }
};

module.exports = tenantContext;