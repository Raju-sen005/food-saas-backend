const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 🔑 5MB — 1000*1000 use kar rahe the jo 5,000,000 bytes h (~4.77MB),
  // 1024*1024 zyada accurate "MB" h storage terms mein
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// 🔑 Wrapper middleware — multer errors (file size, invalid type) ko clean JSON response
// mein convert karta h, taaki frontend ko readable error mile na ki generic 500
const handleUploadErrors = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Max size is 5MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      // fileFilter se aaya custom error (e.g. "Only image files are allowed!")
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = { upload, handleUploadErrors };