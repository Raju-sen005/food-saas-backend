// Har async controller ko wrap karta h — koi bhi thrown error automatically
// server.js ke centralized error-handling middleware tak pahunch jaata h,
// isliye har controller mein manually try/catch likhne ki zaroorat nahi
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;