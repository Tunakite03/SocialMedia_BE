const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

// Configure Cloudinary
cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test connection
const testCloudinaryConnection = async () => {
   try {
      await cloudinary.api.ping();
      logger.info('Cloudinary connected successfully');
   } catch (error) {
      logger.error('Cloudinary connection failed:', error);
   }
};

module.exports = {
   cloudinary,
   testCloudinaryConnection,
};
