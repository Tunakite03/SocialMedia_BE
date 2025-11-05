const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { uploadMiddleware, handleUploadError } = require('../middlewares/uploadMiddleware');

/**
 * Upload image for post
 * POST /api/v1/upload/image
 */
router.post('/image', authenticate, uploadMiddleware.single('image'), (req, res) => {
   try {
      if (!req.file) {
         return res.status(400).json({
            success: false,
            error: 'No image provided',
         });
      }

      res.status(200).json({
         success: true,
         message: 'Image uploaded successfully',
         data: {
            url: req.file.path,
            publicId: req.file.filename,
            size: req.file.size,
         },
      });
   } catch (error) {
      handleUploadError(error, req, res);
   }
});

/**
 * Upload multiple images
 * POST /api/v1/upload/images
 */
router.post('/images', authenticate, uploadMiddleware.array('images', 10), (req, res) => {
   try {
      if (!req.files || req.files.length === 0) {
         return res.status(400).json({
            success: false,
            error: 'No images provided',
         });
      }

      const images = req.files.map((file) => ({
         url: file.path,
         publicId: file.filename,
         size: file.size,
      }));

      res.status(200).json({
         success: true,
         message: 'Images uploaded successfully',
         data: { images },
      });
   } catch (error) {
      handleUploadError(error, req, res);
   }
});

// Error handling middleware
router.use(handleUploadError);

module.exports = router;
