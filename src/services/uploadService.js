const { cloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Cloudinary response
 */
const uploadImage = async (filePath, options = {}) => {
   try {
      const defaultOptions = {
         folder: 'onway/posts',
         resource_type: 'auto',
         quality: 'auto',
         fetch_format: 'auto',
         ...options,
      };

      const result = await cloudinary.uploader.upload(filePath, defaultOptions);

      logger.info(`Image uploaded successfully: ${result.public_id}`);

      return {
         success: true,
         url: result.secure_url,
         publicId: result.public_id,
         cloudinaryId: result.public_id,
         width: result.width,
         height: result.height,
         size: result.bytes,
      };
   } catch (error) {
      logger.error('Error uploading image to Cloudinary:', error);
      throw error;
   }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Public ID of the image
 * @returns {Promise<object>} - Cloudinary response
 */
const deleteImage = async (publicId) => {
   try {
      const result = await cloudinary.uploader.destroy(publicId);
      logger.info(`Image deleted successfully: ${publicId}`);
      return result;
   } catch (error) {
      logger.error('Error deleting image from Cloudinary:', error);
      throw error;
   }
};

/**
 * Get optimized image URL
 * @param {string} url - Original image URL
 * @param {object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
const getOptimizedUrl = (url, options = {}) => {
   const defaultOptions = {
      quality: 'auto',
      fetch_format: 'auto',
      ...options,
   };

   return cloudinary.url(url, defaultOptions);
};

module.exports = {
   uploadImage,
   deleteImage,
   getOptimizedUrl,
};
