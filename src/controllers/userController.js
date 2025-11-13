const prisma = require('../config/database');
const { successResponse, paginatedResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError } = require('../constants/errors');
const notificationService = require('../services/notificationService');
const userService = require('../services/userService');

/**
 * Get user by ID
 */
const getUserById = async (req, res, next) => {
   try {
      const { id } = req.params;

      const user = await userService.getUserById(id);

      if (!user) {
         throw new NotFoundError('User not found');
      }

      // Check if current user follows this user
      let isFollowing = false;
      if (req.user) {
         const followRecord = await prisma.follow.findUnique({
            where: {
               followerId_followingId: {
                  followerId: req.user.id,
                  followingId: id,
               },
            },
         });
         isFollowing = !!followRecord;
      }

      return successResponse(res, {
         user: {
            ...user,
            isFollowing,
         },
      });
   } catch (error) {
      console.error('Get user by ID error:', error);
      next(error);
   }
};

/**
 * Search users
 */
const searchUsers = async (req, res, next) => {
   try {
      const { q, limit = 10, offset = 0 } = req.query;

      if (!q) {
         throw new ValidationError('Search query is required');
      }

      const users = await userService.searchUsers(q, limit, offset, req.user ? req.user.id : null);

      // Check if current user follows each searched user
      const userIds = users.map((user) => user.id);
      const followRecords = await prisma.follow.findMany({
         where: {
            followerId: req.user.id,
            followingId: { in: userIds },
         },
         select: {
            followingId: true,
         },
      });

      const followingUserIds = new Set(followRecords.map((record) => record.followingId));

      // Add isFollowing property to each user
      const usersWithFollowStatus = users.map((user) => ({
         ...user,
         isFollowing: followingUserIds.has(user.id),
      }));

      return paginatedResponse(
         res,
         { users: usersWithFollowStatus },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: users.length,
         }
      );
   } catch (error) {
      console.error('Search users error:', error);
      next(error);
   }
};

/**
 * Follow user
 */
const followUser = async (req, res, next) => {
   try {
      const { id } = req.params;
      // Check if user is trying to follow themselves
      if (id === req.user.id) {
         throw new ValidationError('You cannot follow yourself');
      }
      // Check if user exists
      const userToFollow = await userService.checkUserExistsById(id);

      if (!userToFollow) {
         throw new NotFoundError('User not found');
      }

      // Check if already following
      const existingFollow = await userService.checkFollowingExists(req.user.id, id);

      if (existingFollow) {
         throw new ValidationError('You are already following this user');
      }

      // Create follow relationship
      await prisma.follow.create({
         data: {
            followerId: req.user.id,
            followingId: id,
         },
         select: { id: true },
      });

      // Create notification
      const noti = await notificationService.createFollowNotification({
         followerId: req.user.id,
         followingId: id,
         followerUsername: req.user.username,
      });
      // Emit notification via Socket.IO
      const io = req.app.get('socketio');

      if (io) {
         io.to(`user:${noti.receiverId}`).emit('notification:new', {
            id: noti.id,
            title: noti.title,
            type: noti.type,
            message: noti.message,
            senderId: noti.senderId,
            entityId: noti.receiverId,
            entityType: noti.entityType,
            sender: {
               id: req.user.id,
               username: req.user.username,
               displayName: req.user.displayName,
               avatar: req.user.avatar,
            },
            createdAt: noti.createdAt,
         });
      }
      return successResponse(res, null, 'User followed successfully');
   } catch (error) {
      console.error('Follow user error:', error);
      next(error);
   }
};

/**
 * Unfollow user
 */
const unfollowUser = async (req, res, next) => {
   try {
      const { id } = req.params;

      // Check if following
      const followRecord = await prisma.follow.findUnique({
         where: {
            followerId_followingId: {
               followerId: req.user.id,
               followingId: id,
            },
         },
      });

      if (!followRecord) {
         throw new ValidationError('You are not following this user');
      }

      // Remove follow relationship
      await prisma.follow.delete({
         where: {
            followerId_followingId: {
               followerId: req.user.id,
               followingId: id,
            },
         },
      });

      return successResponse(res, null, 'User unfollowed successfully');
   } catch (error) {
      console.error('Unfollow user error:', error);
      next(error);
   }
};

/**
 * Get user followers
 */
const getFollowers = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const followers = await prisma.follow.findMany({
         where: { followingId: id },
         include: {
            follower: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  bio: true,
                  isOnline: true,
               },
            },
         },
         take: parseInt(limit),
         skip: parseInt(offset),
         orderBy: {
            createdAt: 'desc',
         },
      });

      const totalFollowers = await prisma.follow.count({
         where: { followingId: id },
      });

      return paginatedResponse(
         res,
         { followers: followers.map((f) => f.follower) },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: totalFollowers,
         }
      );
   } catch (error) {
      console.error('Get followers error:', error);
      next(error);
   }
};

/**
 * Get user following
 */
const getFollowing = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const following = await prisma.follow.findMany({
         where: { followerId: id },
         include: {
            following: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
                  bio: true,
                  isOnline: true,
               },
            },
         },
         take: parseInt(limit),
         skip: parseInt(offset),
         orderBy: {
            createdAt: 'desc',
         },
      });

      const totalFollowing = await prisma.follow.count({
         where: { followerId: id },
      });

      return paginatedResponse(
         res,
         { following: following.map((f) => f.following) },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: totalFollowing,
         }
      );
   } catch (error) {
      console.error('Get following error:', error);
      next(error);
   }
};

const checkFollowingStatus = async (req, res, next) => {
   try {
      const { id: followingId } = req.params;

      const isFollowing = await userService.checkFollowingExists(req.user.id, followingId);

      return successResponse(res, { isFollowing });
   } catch (error) {
      console.error('Check following status error:', error);
      next(error);
   }
};
/**
 * Get user by username
 */

const getUserByUsername = async (req, res, next) => {
   try {
      const { username } = req.params;

      const user = await userService.getUserByUsername(username);

      if (!user) {
         throw new NotFoundError('User not found');
      }

      // Check if current user follows this user
      let isFollowing = false;

      if (req.user) {
         const followRecord = await prisma.follow.findUnique({
            where: {
               followerId_followingId: {
                  followerId: req.user.id,
                  followingId: user.id,
               },
            },
         });
         isFollowing = !!followRecord;
      }

      return successResponse(res, {
         user: {
            ...user,
            isFollowing,
         },
      });
   } catch (error) {
      console.error('Get user by username error:', error);
      next(error);
   }
};
module.exports = {
   getUserById,
   searchUsers,
   followUser,
   unfollowUser,
   getFollowers,
   getFollowing,
   getUserByUsername,
   checkFollowingStatus,
};
