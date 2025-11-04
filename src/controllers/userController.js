const prisma = require('../config/database');

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
   try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
         where: { id },
         select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            isOnline: true,
            lastSeen: true,
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
         return res.status(404).json({
            success: false,
            error: 'User not found',
         });
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

      res.json({
         success: true,
         data: {
            user: {
               ...user,
               isFollowing,
            },
         },
      });
   } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching user',
      });
   }
};

/**
 * Search users
 */
const searchUsers = async (req, res) => {
   try {
      const { q, limit = 10, offset = 0 } = req.query;

      if (!q) {
         return res.status(400).json({
            success: false,
            error: 'Search query is required',
         });
      }

      const users = await prisma.user.findMany({
         where: {
            AND: [
               { isActive: true },
               {
                  OR: [
                     { username: { contains: q, mode: 'insensitive' } },
                     { displayName: { contains: q, mode: 'insensitive' } },
                  ],
               },
            ],
         },
         select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            isOnline: true,
            _count: {
               select: {
                  followers: true,
                  following: true,
               },
            },
         },
         take: parseInt(limit),
         skip: parseInt(offset),
         orderBy: {
            createdAt: 'desc',
         },
      });

      res.json({
         success: true,
         data: {
            users,
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               total: users.length,
            },
         },
      });
   } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while searching users',
      });
   }
};

/**
 * Follow user
 */
const followUser = async (req, res) => {
   try {
      const { id } = req.params;

      // Check if user exists
      const userToFollow = await prisma.user.findUnique({
         where: { id },
      });

      if (!userToFollow) {
         return res.status(404).json({
            success: false,
            error: 'User not found',
         });
      }

      // Check if user is trying to follow themselves
      if (id === req.user.id) {
         return res.status(400).json({
            success: false,
            error: 'You cannot follow yourself',
         });
      }

      // Check if already following
      const existingFollow = await prisma.follow.findUnique({
         where: {
            followerId_followingId: {
               followerId: req.user.id,
               followingId: id,
            },
         },
      });

      if (existingFollow) {
         return res.status(400).json({
            success: false,
            error: 'You are already following this user',
         });
      }

      // Create follow relationship
      await prisma.follow.create({
         data: {
            followerId: req.user.id,
            followingId: id,
         },
      });

      // Create notification
      await prisma.notification.create({
         data: {
            type: 'FOLLOW',
            title: 'New Follower',
            message: `${req.user.displayName} started following you`,
            receiverId: id,
            senderId: req.user.id,
         },
      });

      res.json({
         success: true,
         message: 'User followed successfully',
      });
   } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while following user',
      });
   }
};

/**
 * Unfollow user
 */
const unfollowUser = async (req, res) => {
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
         return res.status(400).json({
            success: false,
            error: 'You are not following this user',
         });
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

      res.json({
         success: true,
         message: 'User unfollowed successfully',
      });
   } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while unfollowing user',
      });
   }
};

/**
 * Get user followers
 */
const getFollowers = async (req, res) => {
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

      res.json({
         success: true,
         data: {
            followers: followers.map((f) => f.follower),
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               total: totalFollowers,
            },
         },
      });
   } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching followers',
      });
   }
};

/**
 * Get user following
 */
const getFollowing = async (req, res) => {
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

      res.json({
         success: true,
         data: {
            following: following.map((f) => f.following),
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               total: totalFollowing,
            },
         },
      });
   } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching following',
      });
   }
};

module.exports = {
   getUserById,
   searchUsers,
   followUser,
   unfollowUser,
   getFollowers,
   getFollowing,
};
