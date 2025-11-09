const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT access token
 */
const generateAccessToken = (userId) => {
   return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m', // Short-lived access token
   });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = () => {
   return crypto.randomBytes(40).toString('hex');
};

/**
 * Generate both access and refresh tokens with session info
 */
const generateTokens = (userId, ipAddress, userAgent) => {
   const accessToken = generateAccessToken(userId);
   const refreshToken = generateRefreshToken();
   const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

   return {
      accessToken,
      refreshToken,
      expiresAt,
      sessionData: {
         userId,
         refreshToken,
         ipAddress,
         userAgent,
         expiresAt,
      },
   };
};

/**
 * Legacy function for backward compatibility
 */
const generateToken = (userId) => {
   return generateAccessToken(userId);
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
   try {
      return jwt.verify(token, process.env.JWT_SECRET);
   } catch (error) {
      throw new Error('Invalid token');
   }
};

/**
 * Extract user agent info
 */
const parseUserAgent = (userAgentString) => {
   if (!userAgentString) return 'Unknown Device';

   // Simple user agent parsing - you might want to use a library like 'useragent' for more detailed parsing
   if (userAgentString.includes('Mobile')) return 'Mobile Device';
   if (userAgentString.includes('Chrome')) return 'Chrome Browser';
   if (userAgentString.includes('Firefox')) return 'Firefox Browser';
   if (userAgentString.includes('Safari')) return 'Safari Browser';
   if (userAgentString.includes('Edge')) return 'Edge Browser';

   return 'Unknown Device';
};

/**
 * Extract IP address from request
 */
const getClientIpAddress = (req) => {
   return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'Unknown'
   );
};
/**
 * Get random avatar URL from Cloudinary
 */
const getRandomAvatarUrl = () => {
   const avatars = ['avt1.jpeg', 'avt2.jpeg', 'avt3.jpeg', 'avt4.jpeg', 'avt5.jpeg', 'avt6.jpeg', 'avt7.jpeg'];
   const randomIndex = Math.floor(Math.random() * avatars.length);
   const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
   return `https://res.cloudinary.com/${cloudName}/image/upload/onway/avatar/${avatars[randomIndex]}`;
};

module.exports = {
   generateToken, // Legacy
   generateAccessToken,
   generateRefreshToken,
   generateTokens,
   verifyToken,
   parseUserAgent,
   getClientIpAddress,
   getRandomAvatarUrl,
};
