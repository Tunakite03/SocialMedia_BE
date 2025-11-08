'use strict';
const prisma = require('../config/database');
const { successResponse, paginatedResponse } = require('../utils/responseFormatter');
const { createPaginationConfig, processPaginatedResults, validatePaginationParams } = require('../utils/pagination');
const Logger = require('../utils/logger');
const {
   NotFoundError,
   ValidationError,
   ERROR_MESSAGES,
   SUCCESS_MESSAGES,
   HTTP_STATUS,
} = require('../constants/errors');

/**
 * Get notifications for the authenticated user
 */
const getNotifications = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const { limit = 10, offset = 0, cursor } = req.query;

      Logger.info('Fetching notifications', { userId, limit, offset, cursor });

      // Validate pagination params
      const paginationParams = validatePaginationParams({ limit, offset, cursor });

      // Create pagination config
      const paginationConfig = createPaginationConfig({
         ...paginationParams,
         orderBy: 'createdAt',
         orderDirection: 'desc',
      });

      // Build where clause
      const whereClause = {
         receiverId: userId,
         ...paginationConfig.where,
      };

      // Fetch notifications with pagination
      const notifications = await prisma.notification.findMany({
         where: whereClause,
         take: paginationConfig.take,
         skip: paginationConfig.skip,
         orderBy: paginationConfig.orderBy,
         cursor: paginationConfig.cursor,
         include: {
            sender: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
      });

      // Process paginated results
      const result = processPaginatedResults(notifications, paginationConfig);

      Logger.info('Notifications fetched successfully', {
         userId,
         count: result.items.length,
         hasMore: result.pagination.hasMore,
      });

      return paginatedResponse(
         res,
         { notifications: result.items },
         result.pagination,
         SUCCESS_MESSAGES.DATA_RETRIEVED
      );
   } catch (error) {
      Logger.error('Error fetching notifications', { userId: req.user.id, error: error.message });
      next(error);
   }
};

/**
 * Mark a notification as read
 */
const markAsRead = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const { id } = req.params;

      Logger.info('Marking notification as read', { userId, notificationId: id });

      // Find and update the notification
      const notification = await prisma.notification.updateMany({
         where: {
            id,
            receiverId: userId, // Ensure user can only mark their own notifications
            isRead: false, // Only update if not already read
         },
         data: {
            isRead: true,
         },
      });

      if (notification.count === 0) {
         Logger.warn('Notification not found or already read', { userId, notificationId: id });
         throw new NotFoundError('Notification not found or already marked as read');
      }

      Logger.info('Notification marked as read', { userId, notificationId: id });

      return successResponse(res, null, 'Notification marked as read');
   } catch (error) {
      Logger.error('Error marking notification as read', {
         userId: req.user.id,
         notificationId: req.params.id,
         error: error.message,
      });
      next(error);
   }
};

/**
 * Mark all notifications as read for the user
 */
const markAllAsRead = async (req, res, next) => {
   try {
      const userId = req.user.id;

      Logger.info('Marking all notifications as read', { userId });

      // Update all unread notifications for the user
      const result = await prisma.notification.updateMany({
         where: {
            receiverId: userId,
            isRead: false,
         },
         data: {
            isRead: true,
         },
      });

      Logger.info('All notifications marked as read', { userId, updatedCount: result.count });

      return successResponse(res, { updatedCount: result.count }, 'All notifications marked as read');
   } catch (error) {
      Logger.error('Error marking all notifications as read', { userId: req.user.id, error: error.message });
      next(error);
   }
};

module.exports = {
   getNotifications,
   markAsRead,
   markAllAsRead,
};
