const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { AuthenticationError, NotFoundError, ERROR_MESSAGES } = require('../constants/errors');

const prisma = new PrismaClient();

/**
 * Middleware to verify JWT token and authenticate user
 */
const authenticate = async (req, res, next) => {
   try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         throw new AuthenticationError(ERROR_MESSAGES.TOKEN_MISSING);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
         const decoded = jwt.verify(token, process.env.JWT_SECRET);

         // Get user from database
         const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
               id: true,
               email: true,
               username: true,
               displayName: true,
               avatar: true,
               isActive: true,
               role: true,
            },
         });

         if (!user || !user.isActive) {
            throw new AuthenticationError(ERROR_MESSAGES.TOKEN_INVALID);
         }

         req.user = user;
         next();
      } catch (jwtError) {
         if (jwtError.name === 'TokenExpiredError') {
            throw new AuthenticationError('Token expired');
         }
         throw new AuthenticationError(ERROR_MESSAGES.TOKEN_INVALID);
      }
   } catch (error) {
      next(error);
   }
};

/**
 * Middleware to check if user has admin role
 */
const requireAdmin = (req, res, next) => {
   try {
      if (req.user && req.user.role === 'ADMIN') {
         next();
      } else {
         throw new AuthenticationError('Access denied. Admin privileges required.');
      }
   } catch (error) {
      next(error);
   }
};

/**
 * Optional authentication - sets user if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
   try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
         const token = authHeader.substring(7);

         try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
               where: { id: decoded.userId },
               select: {
                  id: true,
                  email: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  isActive: true,
               },
            });

            if (user && user.isActive) {
               req.user = user;
            }
         } catch (jwtError) {
            // Token is invalid, but we continue without user
            console.log('Invalid token in optional auth:', jwtError.message);
         }
      }

      next();
   } catch (error) {
      console.error('Optional auth middleware error:', error);
      next(); // Continue without user
   }
};

module.exports = {
   authenticate,
   requireAdmin,
   optionalAuth,
};
