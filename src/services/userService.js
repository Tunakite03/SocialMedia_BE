const prisma = require('../config/database');

class UserService {
   async checkUserExistsById(id) {
      const user = await prisma.user.findUnique({
         where: { id },
         select: { id: true },
      });
      return !!user;
   }
   async checkUserExistsByUsername(username) {
      const user = await prisma.user.findUnique({
         where: { username },
         select: { id: true },
      });
      return !!user;
   }
   async getUserById(id) {
      return prisma.user.findUnique({
         where: { id },
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
      });
   }

   async getUserByUsername(username) {
      return prisma.user.findUnique({
         where: { username },
      });
   }
   async searchUsers(query, limit = 10, offset = 0, excludeUserId = null) {
      return prisma.user.findMany({
         where: {
            AND: [
               { id: { not: excludeUserId } },
               { isActive: true },
               {
                  OR: [
                     { username: { contains: query, mode: 'insensitive' } },
                     { displayName: { contains: query, mode: 'insensitive' } },
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
   }

   async checkFollowingExists(followerId, followingId) {
      const follow = await prisma.follow.findUnique({
         where: {
            followerId_followingId: {
               followerId,
               followingId,
            },
         },
         select: { id: true },
      });
      return !!follow;
   }
}

module.exports = new UserService();
