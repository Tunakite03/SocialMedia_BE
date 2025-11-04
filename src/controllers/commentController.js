const prisma = require('../config/database');
const sentimentService = require('../services/sentimentService');

/**
 * Create a new comment
 */
const createComment = async (req, res) => {
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
         return res.status(404).json({
            success: false,
            error: 'Post not found',
         });
      }

      // If parentId is provided, check if parent comment exists
      if (parentId) {
         const parentComment = await prisma.comment.findUnique({
            where: { id: parentId },
         });

         if (!parentComment) {
            return res.status(404).json({
               success: false,
               error: 'Parent comment not found',
            });
         }

         if (parentComment.postId !== postId) {
            return res.status(400).json({
               success: false,
               error: 'Parent comment does not belong to this post',
            });
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
         await prisma.notification.create({
            data: {
               type: 'COMMENT',
               title: 'New Comment',
               message: `${req.user.displayName} commented on your post`,
               receiverId: post.authorId,
               senderId: userId,
               entityId: comment.id,
               entityType: 'comment',
            },
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

      res.status(201).json({
         success: true,
         message: 'Comment created successfully',
         data: { comment },
      });
   } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while creating comment',
      });
   }
};

/**
 * Get comments for a post
 */
const getPostComments = async (req, res) => {
   try {
      const { postId } = req.params;
      const userId = req.user?.id;
      const { limit = 10, offset = 0, sortBy = 'newest' } = req.query;

      // Check if post exists
      const post = await prisma.post.findUnique({
         where: { id: postId },
      });

      if (!post) {
         return res.status(404).json({
            success: false,
            error: 'Post not found',
         });
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

      res.json({
         success: true,
         data: {
            comments: processedComments,
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               hasMore: comments.length === parseInt(limit),
            },
         },
      });
   } catch (error) {
      console.error('Get post comments error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching comments',
      });
   }
};

/**
 * Get replies for a comment
 */
const getCommentReplies = async (req, res) => {
   try {
      const { commentId } = req.params;
      const userId = req.user?.id;
      const { limit = 10, offset = 0 } = req.query;

      // Check if comment exists
      const comment = await prisma.comment.findUnique({
         where: { id: commentId },
      });

      if (!comment) {
         return res.status(404).json({
            success: false,
            error: 'Comment not found',
         });
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

      res.json({
         success: true,
         data: {
            replies: processedReplies,
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               hasMore: replies.length === parseInt(limit),
            },
         },
      });
   } catch (error) {
      console.error('Get comment replies error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching replies',
      });
   }
};

/**
 * Update comment
 */
const updateComment = async (req, res) => {
   try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      // Check if comment exists and user owns it
      const existingComment = await prisma.comment.findUnique({
         where: { id },
      });

      if (!existingComment) {
         return res.status(404).json({
            success: false,
            error: 'Comment not found',
         });
      }

      if (existingComment.authorId !== userId) {
         return res.status(403).json({
            success: false,
            error: 'Access denied: You can only edit your own comments',
         });
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

      res.json({
         success: true,
         message: 'Comment updated successfully',
         data: { comment: updatedComment },
      });
   } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while updating comment',
      });
   }
};

/**
 * Delete comment
 */
const deleteComment = async (req, res) => {
   try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if comment exists and user owns it
      const existingComment = await prisma.comment.findUnique({
         where: { id },
      });

      if (!existingComment) {
         return res.status(404).json({
            success: false,
            error: 'Comment not found',
         });
      }

      if (existingComment.authorId !== userId) {
         return res.status(403).json({
            success: false,
            error: 'Access denied: You can only delete your own comments',
         });
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

      res.json({
         success: true,
         message: 'Comment deleted successfully',
      });
   } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while deleting comment',
      });
   }
};

module.exports = {
   createComment,
   getPostComments,
   getCommentReplies,
   updateComment,
   deleteComment,
};
