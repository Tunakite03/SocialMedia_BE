const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
   cloudinary,
   params: {
      folder: 'onway/posts',
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
   },
});

// File filter
const fileFilter = (req, file, cb) => {
   if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const error = new Error(`Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
      error.status = 400;
      return cb(error);
   }
   cb(null, true);
};

// Configure multer
const uploadMiddleware = multer({
   storage: storage,
   limits: {
      fileSize: MAX_FILE_SIZE,
   },
   fileFilter: fileFilter,
});

// Error handler middleware for upload
const handleUploadError = (error, req, res, next) => {
   if (error instanceof multer.MulterError) {
      if (error.code === 'FILE_TOO_LARGE') {
         return res.status(400).json({
            success: false,
            error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
         });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
         return res.status(400).json({
            success: false,
            error: 'Too many files',
         });
      }
   }

   if (error.status === 400) {
      return res.status(400).json({
         success: false,
         error: error.message,
      });
   }

   logger.error('Upload error:', error);
   res.status(500).json({
      success: false,
      error: 'File upload failed',
   });
};

module.exports = {
   uploadMiddleware,
   handleUploadError,
};
