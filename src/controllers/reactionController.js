const prisma = require('../config/database');
const { successResponse, paginatedResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');

/**
 * Add or update reaction to post
 */
const addPostReaction = async (req, res, next) => {
   try {
      const { postId } = req.params;
      const { type } = req.body;
      const userId = req.user.id;

      // Validate reaction type
      const validTypes = ['LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW'];
      if (!validTypes.includes(type)) {
         throw new ValidationError('Invalid reaction type');
      }

      // Check if post exists
      const post = await prisma.post.findUnique({
         where: { id: postId },
         include: {
            author: {
               select: { id: true, displayName: true },
            },
         },
      });

      if (!post) {
         throw new NotFoundError('Post not found');
      }

      // Check if user already reacted to this post
      const existingReaction = await prisma.reaction.findUnique({
         where: {
            userId_postId: {
               userId,
               postId,
            },
         },
      });

      let reaction;
      let action;

      if (existingReaction) {
         if (existingReaction.type === type) {
            // Same reaction - remove it
            await prisma.reaction.delete({
               where: { id: existingReaction.id },
            });
            action = 'removed';
            reaction = null;
         } else {
            // Different reaction - update it
            reaction = await prisma.reaction.update({
               where: { id: existingReaction.id },
               data: { type },
            });
            action = 'updated';
         }
      } else {
         // New reaction - create it
         reaction = await prisma.reaction.create({
            data: {
               type,
               userId,
               postId,
            },
         });
         action = 'added';
      }

      // Create notification for post author (if not reacting to own post and reaction was added)
      if (action === 'added' && post.authorId !== userId) {
         await prisma.notification.create({
            data: {
               type: 'LIKE',
               title: 'New Reaction',
               message: `${req.user.displayName} reacted to your post`,
               receiverId: post.authorId,
               senderId: userId,
               entityId: postId,
               entityType: 'post',
            },
         });

         // Emit notification via Socket.IO
         const io = req.app.get('socketio');
         if (io) {
            io.to(`user:${post.authorId}`).emit('notification:new', {
               type: 'LIKE',
               title: 'New Reaction',
               message: `${req.user.displayName} reacted to your post`,
               senderId: userId,
               entityId: postId,
               entityType: 'post',
            });
         }
      }

      // Get updated reaction counts
      const reactionCounts = await prisma.reaction.groupBy({
         by: ['type'],
         where: { postId },
         _count: { type: true },
      });

      const counts = {};
      reactionCounts.forEach((count) => {
         counts[count.type] = count._count.type;
      });

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('post:reaction', {
            postId,
            userId,
            reaction: reaction ? { type: reaction.type } : null,
            action,
            counts,
         });
      }

      return successResponse(
         res,
         {
            reaction: reaction ? { type: reaction.type } : null,
            action,
            counts,
         },
         `Reaction ${action} successfully`
      );
   } catch (error) {
      console.error('Add post reaction error:', error);
      next(error);
   }
};

/**
 * Add or update reaction to comment
 */
const addCommentReaction = async (req, res, next) => {
   try {
      const { commentId } = req.params;
      const { type } = req.body;
      const userId = req.user.id;

      // Validate reaction type
      const validTypes = ['LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW'];
      if (!validTypes.includes(type)) {
         throw new ValidationError('Invalid reaction type');
      }

      // Check if comment exists
      const comment = await prisma.comment.findUnique({
         where: { id: commentId },
         include: {
            author: {
               select: { id: true, displayName: true },
            },
         },
      });

      if (!comment) {
         throw new NotFoundError('Comment not found');
      }

      // Check if user already reacted to this comment
      const existingReaction = await prisma.reaction.findUnique({
         where: {
            userId_commentId: {
               userId,
               commentId,
            },
         },
      });

      let reaction;
      let action;

      if (existingReaction) {
         if (existingReaction.type === type) {
            // Same reaction - remove it
            await prisma.reaction.delete({
               where: { id: existingReaction.id },
            });
            action = 'removed';
            reaction = null;
         } else {
            // Different reaction - update it
            reaction = await prisma.reaction.update({
               where: { id: existingReaction.id },
               data: { type },
            });
            action = 'updated';
         }
      } else {
         // New reaction - create it
         reaction = await prisma.reaction.create({
            data: {
               type,
               userId,
               commentId,
            },
         });
         action = 'added';
      }

      // Create notification for comment author (if not reacting to own comment and reaction was added)
      if (action === 'added' && comment.authorId !== userId) {
         await prisma.notification.create({
            data: {
               type: 'LIKE',
               title: 'New Reaction',
               message: `${req.user.displayName} reacted to your comment`,
               receiverId: comment.authorId,
               senderId: userId,
               entityId: commentId,
               entityType: 'comment',
            },
         });

         // Emit notification via Socket.IO
         const io = req.app.get('socketio');
         if (io) {
            io.to(`user:${comment.authorId}`).emit('notification:new', {
               type: 'LIKE',
               title: 'New Reaction',
               message: `${req.user.displayName} reacted to your comment`,
               senderId: userId,
               entityId: commentId,
               entityType: 'comment',
            });
         }
      }

      // Get updated reaction counts
      const reactionCounts = await prisma.reaction.groupBy({
         by: ['type'],
         where: { commentId },
         _count: { type: true },
      });

      const counts = {};
      reactionCounts.forEach((count) => {
         counts[count.type] = count._count.type;
      });

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('comment:reaction', {
            commentId,
            userId,
            reaction: reaction ? { type: reaction.type } : null,
            action,
            counts,
         });
      }

      return successResponse(
         res,
         {
            reaction: reaction ? { type: reaction.type } : null,
            action,
            counts,
         },
         `Reaction ${action} successfully`
      );
   } catch (error) {
      console.error('Add comment reaction error:', error);
      next(error);
   }
};

/**
 * Get post reactions
 */
const getPostReactions = async (req, res, next) => {
   try {
      const { postId } = req.params;
      const { type, limit = 50, offset = 0 } = req.query;

      // Check if post exists
      const post = await prisma.post.findUnique({
         where: { id: postId },
      });

      if (!post) {
         throw new NotFoundError('Post not found');
      }

      // Build where clause
      let whereClause = { postId };
      if (type) {
         whereClause.type = type.toUpperCase();
      }

      const reactions = await prisma.reaction.findMany({
         where: whereClause,
         include: {
            user: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
         orderBy: {
            createdAt: 'desc',
         },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      return paginatedResponse(
         res,
         { reactions },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: reactions.length === parseInt(limit),
         }
      );
   } catch (error) {
      console.error('Get post reactions error:', error);
      next(error);
   }
};

/**
 * Get comment reactions
 */
const getCommentReactions = async (req, res, next) => {
   try {
      const { commentId } = req.params;
      const { type, limit = 50, offset = 0 } = req.query;

      // Check if comment exists
      const comment = await prisma.comment.findUnique({
         where: { id: commentId },
      });

      if (!comment) {
         throw new NotFoundError('Comment not found');
      }

      // Build where clause
      let whereClause = { commentId };
      if (type) {
         whereClause.type = type.toUpperCase();
      }

      const reactions = await prisma.reaction.findMany({
         where: whereClause,
         include: {
            user: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
         orderBy: {
            createdAt: 'desc',
         },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      return paginatedResponse(
         res,
         { reactions },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: reactions.length === parseInt(limit),
         }
      );
   } catch (error) {
      console.error('Get comment reactions error:', error);
      next(error);
   }
};

module.exports = {
   addPostReaction,
   addCommentReaction,
   getPostReactions,
   getCommentReactions,
};
