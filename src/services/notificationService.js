'use strict';
const prisma = require('../config/database');
const Logger = require('../utils/logger');

class NotificationService {
   /**
    * Create a notification
    * @param {Object} notificationData
    * @param {string} notificationData.type - Notification type (REACT, COMMENT, FOLLOW, etc.)
    * @param {string} notificationData.title - Notification title
    * @param {string} notificationData.message - Notification message
    * @param {string} notificationData.receiverId - ID of the user receiving the notification
    * @param {string} [notificationData.senderId] - ID of the user sending the notification
    * @param {string} [notificationData.entityId] - ID of the related entity (post, comment, etc.)
    * @param {string} [notificationData.entityType] - Type of the related entity
    */
   async createNotification({ type, title, message, receiverId, senderId, entityId, entityType }) {
      try {
         Logger.info('Creating notification', { type, receiverId, senderId, entityId, entityType });

         // Don't create notification if sender and receiver are the same
         if (senderId && senderId === receiverId) {
            Logger.info('Skipping notification creation - sender and receiver are the same', { senderId, receiverId });
            return null;
         }

         const notification = await prisma.notification.create({
            data: {
               type,
               title,
               message,
               receiverId,
               senderId,
               entityId,
               entityType,
            },
         });

         Logger.info('Notification created successfully', { notificationId: notification.id, type, receiverId });
         return notification;
      } catch (error) {
         Logger.error('Failed to create notification', { error: error.message, type, receiverId, senderId });
         throw error;
      }
   }

   /**
    * Create notification for post like
    */
   async createReactNotification(reactData) {
      const { userId: senderId, postId, postAuthorId: receiverId, senderUsername, type } = reactData;

      const title = `New ${type} Reaction`;
      const message = `${senderUsername} ${type.toLowerCase()}d your post`;

      return this.createNotification({
         type: 'REACT',
         title,
         message,
         receiverId,
         senderId,
         entityId: postId,
         entityType: 'post',
      });
   }

   /**
    * Create notification for comment
    */
   async createCommentNotification(commentData) {
      const { senderId: senderId, postId, postAuthorId: receiverId, content, senderUsername } = commentData;

      const title = 'New Comment';
      const message = `${senderUsername} commented on your post: "${content.substring(0, 50)}${
         content.length > 50 ? '...' : ''
      }"`;

      return this.createNotification({
         type: 'COMMENT',
         title,
         message,
         receiverId,
         senderId,
         entityId: postId,
         entityType: 'post',
      });
   }

   /**
    * Create notification for follow
    */
   async createFollowNotification(followData) {
      const { followerId: senderId, followingId: receiverId, followerUsername } = followData;

      const title = 'New Follower';
      const message = `${followerUsername} started following you`;

      return this.createNotification({
         type: 'FOLLOW',
         title,
         message,
         receiverId,
         senderId,
         entityId: receiverId,
         entityType: 'user',
      });
   }

   /**
    * Create notification for message
    */
   async createMessageNotification(messageData) {
      const { senderId, receiverId, conversationId, content, senderUsername } = messageData;

      const title = 'New Message';
      const message = `You have a new message: "${content.substring(0, 50)}${
         content.length > 50 ? '...' : ''
      }" from ${senderUsername}`;

      return this.createNotification({
         type: 'MESSAGE',
         title,
         message,
         receiverId,
         senderId,
         entityId: conversationId,
         entityType: 'conversation',
      });
   }

   /**
    * Create notification for call
    */
   async createCallNotification(callData) {
      const { callerId: senderId, receiverId, type, callerUsername } = callData;

      const title = 'Incoming Call';
      const message = `You have an incoming ${type.toLowerCase()} call from ${callerUsername}`;

      return this.createNotification({
         type: 'CALL',
         title,
         message,
         receiverId,
         senderId,
         entityId: null, // Calls might not have a persistent entity
         entityType: 'call',
      });
   }

   /**
    * Create notification for mention
    */
   async createMentionNotification(mentionData) {
      const { senderId, receiverId, entityId, entityType, content } = mentionData;

      const title = 'You were mentioned';
      const message = `Someone mentioned you: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;

      return this.createNotification({
         type: 'MENTION',
         title,
         message,
         receiverId,
         senderId,
         entityId,
         entityType,
      });
   }

   /**
    * Delete notifications related to an entity
    */
   async deleteNotificationsByEntity(entityId, entityType) {
      try {
         Logger.info('Deleting notifications by entity', { entityId, entityType });

         const result = await prisma.notification.deleteMany({
            where: {
               entityId,
               entityType,
            },
         });

         Logger.info('Notifications deleted', { entityId, entityType, deletedCount: result.count });
         return result.count;
      } catch (error) {
         Logger.error('Failed to delete notifications by entity', { error: error.message, entityId, entityType });
         throw error;
      }
   }

   /**
    * Get unread notification count for a user
    */
   async getUnreadCount(userId) {
      try {
         const count = await prisma.notification.count({
            where: {
               receiverId: userId,
               isRead: false,
            },
         });

         return count;
      } catch (error) {
         Logger.error('Failed to get unread notification count', { error: error.message, userId });
         throw error;
      }
   }
}

module.exports = new NotificationService();
