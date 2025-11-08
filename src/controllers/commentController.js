const prisma = require('../config/database');
const sentimentService = require('../services/sentimentService');
const notificationService = require('../services/notificationService');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseFormatter');
const {
   NotFoundError,
   ValidationError,
   ERROR_MESSAGES,
   SUCCESS_MESSAGES,
   HTTP_STATUS,
} = require('../constants/errors');

/**
 * Create a new comment
 */
const createComment = async (req, res, next) => {
   try {
      const { content, parentId } = req.body;
      const { postId } = req.params;
      const userId = req.user.id;

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

      // If parentId is provided, check if parent comment exists
      if (parentId) {
         const parentComment = await prisma.comment.findUnique({
            where: { id: parentId },
         });

         if (!parentComment) {
            throw new NotFoundError('Parent comment not found');
         }

         if (parentComment.postId !== postId) {
            throw new ValidationError('Parent comment does not belong to this post');
         }
      }

      // Create comment
      const comment = await prisma.comment.create({
         data: {
            content,
            postId,
            authorId: userId,
            parentId,
         },
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            _count: {
               select: {
                  replies: true,
                  reactions: true,
               },
            },
         },
      });

      // Analyze sentiment asynchronously
      sentimentService.analyzeSentiment(content, userId, comment.id, 'comment').catch((error) => {
         console.error('Error analyzing comment sentiment:', error);
      });

      // Create notification for post author (if not commenting on own post)
      if (post.authorId !== userId) {
         await notificationService.createCommentNotification({
            authorId: userId,
            postId,
            postAuthorId: post.authorId,
            content,
         });

         // Emit notification via Socket.IO
         const io = req.app.get('socketio');
         if (io) {
            io.to(`user:${post.authorId}`).emit('notification:new', {
               type: 'COMMENT',
               title: 'New Comment',
               message: `${req.user.displayName} commented on your post`,
               senderId: userId,
               entityId: comment.id,
               entityType: 'comment',
            });
         }
      }

      // Emit comment creation to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('comment:new', { postId, comment });
      }

      return successResponse(res, { comment }, 'Comment created successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Create comment error:', error);
      next(error);
   }
};

/**
 * Get comments for a post
 */
const getPostComments = async (req, res, next) => {
   try {
      const { postId } = req.params;
      const userId = req.user?.id;
      const { limit = 10, offset = 0, sortBy = 'newest' } = req.query;

      // Check if post exists
      const post = await prisma.post.findUnique({
         where: { id: postId },
      });

      if (!post) {
         throw new NotFoundError('Post not found');
      }

      // Build order clause
      let orderBy = { createdAt: 'desc' };
      if (sortBy === 'oldest') {
         orderBy = { createdAt: 'asc' };
      }

      // Get top-level comments (no parent)
      const comments = await prisma.comment.findMany({
         where: {
            postId,
            parentId: null,
         },
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            replies: {
               include: {
                  author: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
                  reactions: userId
                     ? {
                          where: { userId },
                          select: { type: true },
                       }
                     : false,
                  _count: {
                     select: {
                        reactions: true,
                     },
                  },
               },
               orderBy: {
                  createdAt: 'asc',
               },
               take: 3, // Limit replies shown initially
            },
            reactions: userId
               ? {
                    where: { userId },
                    select: { type: true },
                 }
               : false,
            _count: {
               select: {
                  replies: true,
                  reactions: true,
               },
            },
         },
         orderBy,
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      // Process comments to include user reactions
      const processedComments = comments.map((comment) => ({
         ...comment,
         userReaction: comment.reactions?.[0]?.type || null,
         reactions: undefined,
         replies: comment.replies.map((reply) => ({
            ...reply,
            userReaction: reply.reactions?.[0]?.type || null,
            reactions: undefined,
         })),
      }));

      return paginatedResponse(
         res,
         { comments: processedComments },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: comments.length === parseInt(limit),
         }
      );
   } catch (error) {
      console.error('Get post comments error:', error);
      next(error);
   }
};

/**
 * Get replies for a comment
 */
const getCommentReplies = async (req, res, next) => {
   try {
      const { commentId } = req.params;
      const userId = req.user?.id;
      const { limit = 10, offset = 0 } = req.query;

      // Check if comment exists
      const comment = await prisma.comment.findUnique({
         where: { id: commentId },
      });

      if (!comment) {
         throw new NotFoundError('Comment not found');
      }

      const replies = await prisma.comment.findMany({
         where: {
            parentId: commentId,
         },
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            reactions: userId
               ? {
                    where: { userId },
                    select: { type: true },
                 }
               : false,
            _count: {
               select: {
                  reactions: true,
               },
            },
         },
         orderBy: {
            createdAt: 'asc',
         },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      const processedReplies = replies.map((reply) => ({
         ...reply,
         userReaction: reply.reactions?.[0]?.type || null,
         reactions: undefined,
      }));

      return paginatedResponse(
         res,
         { replies: processedReplies },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: replies.length === parseInt(limit),
         }
      );
   } catch (error) {
      console.error('Get comment replies error:', error);
      next(error);
   }
};

/**
 * Update comment
 */
const updateComment = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      // Check if comment exists and user owns it
      const existingComment = await prisma.comment.findUnique({
         where: { id },
      });

      if (!existingComment) {
         throw new NotFoundError('Comment not found');
      }

      if (existingComment.authorId !== userId) {
         throw new ValidationError('Access denied: You can only edit your own comments');
      }

      // Update comment
      const updatedComment = await prisma.comment.update({
         where: { id },
         data: { content },
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            _count: {
               select: {
                  replies: true,
                  reactions: true,
               },
            },
         },
      });

      // Re-analyze sentiment
      sentimentService.analyzeSentiment(content, userId, id, 'comment').catch((error) => {
         console.error('Error re-analyzing comment sentiment:', error);
      });

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('comment:updated', updatedComment);
      }

      return successResponse(res, { comment: updatedComment }, 'Comment updated successfully');
   } catch (error) {
      console.error('Update comment error:', error);
      next(error);
   }
};

/**
 * Delete comment
 */
const deleteComment = async (req, res, next) => {
   try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if comment exists and user owns it
      const existingComment = await prisma.comment.findUnique({
         where: { id },
      });

      if (!existingComment) {
         throw new NotFoundError('Comment not found');
      }

      if (existingComment.authorId !== userId) {
         throw new ValidationError('Access denied: You can only delete your own comments');
      }

      // Delete comment (cascade will handle replies and reactions)
      await prisma.comment.delete({
         where: { id },
      });

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('comment:deleted', { id, postId: existingComment.postId });
      }

      return successResponse(res, null, 'Comment deleted successfully');
   } catch (error) {
      console.error('Delete comment error:', error);
      next(error);
   }
};

module.exports = {
   createComment,
   getPostComments,
   getCommentReplies,
   updateComment,
   deleteComment,
};
