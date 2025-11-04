const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { successResponse } = require('../utils/responseFormatter');
const Logger = require('../utils/logger');
const {
   ConflictError,
   AuthenticationError,
   NotFoundError,
   ValidationError,
   ERROR_MESSAGES,
   SUCCESS_MESSAGES,
   HTTP_STATUS,
} = require('../constants/errors');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
   return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
   });
};

/**
 * Register new user
 */
const register = async (req, res, next) => {
   try {
      const { email, username, password, displayName, dateOfBirth, bio } = req.body;

      Logger.info('User registration attempt', { email, username });

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
         where: {
            OR: [{ email }, { username }],
         },
      });

      if (existingUser) {
         const errorMessage =
            existingUser.email === email
               ? ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED
               : ERROR_MESSAGES.USERNAME_ALREADY_TAKEN;
         Logger.warn('Registration failed - user already exists', { email, username, reason: errorMessage });
         throw new ConflictError(errorMessage);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
         data: {
            email,
            username,
            password: hashedPassword,
            displayName,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            bio,
         },
         select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            dateOfBirth: true,
            role: true,
            createdAt: true,
         },
      });

      Logger.logDatabase('CREATE', 'user', { userId: user.id, email: user.email });
      Logger.logAuth('register', user, req.ip);

      // Generate token
      const token = generateToken(user.id);

      return successResponse(res, { user, token }, SUCCESS_MESSAGES.USER_REGISTERED, HTTP_STATUS.CREATED);
   } catch (error) {
      Logger.error('Registration error', error);
      next(error);
   }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
   try {
      const { email, password } = req.body;

      Logger.info('User login attempt', { email });

      // Find user by email
      const user = await prisma.user.findUnique({
         where: { email },
      });

      if (!user) {
         Logger.warn('Login failed - user not found', { email });
         throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
         Logger.warn('Login failed - invalid password', { email, userId: user.id });
         throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Check if user is active
      if (!user.isActive) {
         Logger.warn('Login failed - account deactivated', { email, userId: user.id });
         throw new AuthenticationError(ERROR_MESSAGES.ACCOUNT_DEACTIVATED);
      }

      // Update last seen and online status
      const updatedUser = await prisma.user.update({
         where: { id: user.id },
         data: {
            lastSeen: new Date(),
            isOnline: true,
         },
         select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            dateOfBirth: true,
            role: true,
            isOnline: true,
            lastSeen: true,
            createdAt: true,
         },
      });

      Logger.logAuth('login', updatedUser, req.ip);
      Logger.logDatabase('UPDATE', 'user', { userId: user.id, action: 'login_status_update' });

      // Generate token
      const token = generateToken(user.id);

      return successResponse(res, { user: updatedUser, token }, SUCCESS_MESSAGES.LOGIN_SUCCESSFUL);
   } catch (error) {
      Logger.error('Login error', error);
      next(error);
   }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
   try {
      // Update user's online status
      await prisma.user.update({
         where: { id: req.user.id },
         data: {
            isOnline: false,
            lastSeen: new Date(),
         },
      });

      Logger.logAuth('logout', req.user, req.ip);
      Logger.logDatabase('UPDATE', 'user', { userId: req.user.id, action: 'logout_status_update' });

      return successResponse(res, null, SUCCESS_MESSAGES.LOGOUT_SUCCESSFUL);
   } catch (error) {
      Logger.error('Logout error', error);
      next(error);
   }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
   try {
      const user = await prisma.user.findUnique({
         where: { id: req.user.id },
         select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            dateOfBirth: true,
            role: true,
            isOnline: true,
            lastSeen: true,
            emailVerified: true,
            createdAt: true,
            _count: {
               select: {
                  posts: true,
                  followers: true,
                  following: true,
               },
            },
         },
      });

      if (!user) {
         throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      return successResponse(res, { user });
   } catch (error) {
      next(error);
   }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
   try {
      const { displayName, bio, dateOfBirth } = req.body;

      const updatedUser = await prisma.user.update({
         where: { id: req.user.id },
         data: {
            displayName,
            bio,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
         },
         select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            dateOfBirth: true,
            role: true,
            isOnline: true,
            lastSeen: true,
            emailVerified: true,
            createdAt: true,
         },
      });

      return successResponse(res, { user: updatedUser }, SUCCESS_MESSAGES.PROFILE_UPDATED);
   } catch (error) {
      next(error);
   }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
   try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await prisma.user.findUnique({
         where: { id: req.user.id },
      });

      if (!user) {
         throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
         throw new ValidationError(ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT);
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
         where: { id: req.user.id },
         data: { password: hashedNewPassword },
      });

      return successResponse(res, null, SUCCESS_MESSAGES.PASSWORD_CHANGED);
   } catch (error) {
      next(error);
   }
};

/**
 * Verify token (for middleware or frontend validation)
 */
const verifyToken = async (req, res, next) => {
   try {
      // User is already verified by the authenticate middleware
      return successResponse(res, { user: req.user }, SUCCESS_MESSAGES.TOKEN_VERIFIED);
   } catch (error) {
      next(error);
   }
};

module.exports = {
   register,
   login,
   logout,
   getProfile,
   updateProfile,
   changePassword,
   verifyToken,
};
