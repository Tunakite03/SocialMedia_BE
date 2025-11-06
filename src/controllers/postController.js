const prisma = require('../config/database');
const sentimentService = require('../services/sentimentService');
const { validatePaginationParams, createPaginationConfig, processPaginatedResults } = require('../utils/pagination');
const { successResponse, paginatedResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');

/**
 * Create a new post
 */
const createPost = async (req, res, next) => {
   try {
      const { content, type = 'TEXT', isPublic = true } = req.body;
      const userId = req.user.id;

      // Create post
      const post = await prisma.post.create({
         data: {
            content,
            type,
            isPublic,
            authorId: userId,
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
                  comments: true,
                  reactions: true,
               },
            },
         },
      });

      // Analyze sentiment asynchronously (don't wait for it)
      sentimentService.analyzeSentiment(content, userId, post.id, 'post').catch((error) => {
         console.error('Error analyzing post sentiment:', error);
      });

      // Emit to Socket.IO for real-time updates
      const io = req.app.get('socketio');
      if (io && isPublic) {
         io.emit('post:new', post);
      }

      return successResponse(res, { post }, 'Post created successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Create post error:', error);
      next(error);
   }
};

/**
 * Get posts feed
 */
const getFeed = async (req, res, next) => {
   try {
      const userId = req.user?.id;
      const { type = 'all', ...paginationParams } = req.query;

      // Validate and optimize pagination parameters
      const validatedParams = validatePaginationParams(paginationParams);
      const paginationConfig = createPaginationConfig(validatedParams);

      // Build where clause
      let whereClause = { isPublic: true };

      if (type !== 'all') {
         whereClause.type = type.toUpperCase();
      }

      // Merge with cursor-based where conditions
      whereClause = { ...whereClause, ...paginationConfig.where };

      // Get posts with optimized query
      const posts = await prisma.post.findMany({
         where: whereClause,
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
                  comments: true,
                  reactions: true,
               },
            },
         },
         orderBy: paginationConfig.orderBy,
         take: paginationConfig.take,
         skip: paginationConfig.skip,
         cursor: paginationConfig.cursor,
      });

      // Process pagination results
      const { items: processedPosts, pagination } = processPaginatedResults(posts, paginationConfig);

      // Process posts to include user's reaction
      const finalPosts = processedPosts.map((post) => ({
         ...post,
         userReaction: post.reactions?.[0]?.type || null,
         reactions: undefined, // Remove reactions array from response
      }));

      return paginatedResponse(res, { posts: finalPosts }, pagination);
   } catch (error) {
      console.error('Get feed error:', error);
      next(error);
   }
};

/**
 * Get single post by ID
 */
const getPostById = async (req, res, next) => {
   try {
      const { id } = req.params;
      const userId = req.user?.id;

      const post = await prisma.post.findUnique({
         where: { id },
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
                  comments: true,
                  reactions: true,
               },
            },
         },
      });

      if (!post) {
         throw new NotFoundError('Post not found');
      }

      // Check if user can view this post
      if (!post.isPublic && (!userId || post.authorId !== userId)) {
         throw new ValidationError('Access denied to this post');
      }

      const processedPost = {
         ...post,
         userReaction: post.reactions?.[0]?.type || null,
         reactions: undefined,
      };

      return successResponse(res, { post: processedPost });
   } catch (error) {
      console.error('Get post by ID error:', error);
      next(error);
   }
};

/**
 * Update post
 */
const updatePost = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { content, isPublic } = req.body;
      const userId = req.user.id;

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
         where: { id },
      });

      if (!existingPost) {
         throw new NotFoundError('Post not found');
      }

      if (existingPost.authorId !== userId) {
         throw new ValidationError('Access denied: You can only edit your own posts');
      }

      // Update post
      const updatedPost = await prisma.post.update({
         where: { id },
         data: {
            content,
            isPublic,
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
                  comments: true,
                  reactions: true,
               },
            },
         },
      });

      // Re-analyze sentiment if content changed
      if (content && content !== existingPost.content) {
         sentimentService.analyzeSentiment(content, userId, id, 'post').catch((error) => {
            console.error('Error re-analyzing post sentiment:', error);
         });
      }

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('post:updated', updatedPost);
      }

      return successResponse(res, { post: updatedPost }, 'Post updated successfully');
   } catch (error) {
      console.error('Update post error:', error);
      next(error);
   }
};

/**
 * Delete post
 */
const deletePost = async (req, res, next) => {
   try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
         where: { id },
      });

      if (!existingPost) {
         throw new NotFoundError('Post not found');
      }

      if (existingPost.authorId !== userId) {
         throw new ValidationError('Access denied: You can only delete your own posts');
      }

      // Delete post (cascade will handle comments and reactions)
      await prisma.post.delete({
         where: { id },
      });

      // Emit to Socket.IO
      const io = req.app.get('socketio');
      if (io) {
         io.emit('post:deleted', { id });
      }

      return successResponse(res, null, 'Post deleted successfully');
   } catch (error) {
      console.error('Delete post error:', error);
      next(error);
   }
};

/**
 * Get posts by user
 */
const getUserPosts = async (req, res, next) => {
   try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;
      const { limit = 10, offset = 0 } = req.query;

      // Build where clause - show public posts or own posts
      let whereClause = { authorId: userId };
      if (currentUserId !== userId) {
         whereClause.isPublic = true;
      }

      const posts = await prisma.post.findMany({
         where: whereClause,
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            reactions: currentUserId
               ? {
                    where: { userId: currentUserId },
                    select: { type: true },
                 }
               : false,
            _count: {
               select: {
                  comments: true,
                  reactions: true,
               },
            },
         },
         orderBy: {
            createdAt: 'desc',
         },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      const processedPosts = posts.map((post) => ({
         ...post,
         userReaction: post.reactions?.[0]?.type || null,
         reactions: undefined,
      }));

      return paginatedResponse(
         res,
         { posts: processedPosts },
         {
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: posts.length === parseInt(limit),
         }
      );
   } catch (error) {
      console.error('Get user posts error:', error);
      next(error);
   }
};

module.exports = {
   createPost,
   getFeed,
   getPostById,
   updatePost,
   deletePost,
   getUserPosts,
};
