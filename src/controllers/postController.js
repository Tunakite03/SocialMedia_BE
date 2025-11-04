const prisma = require('../config/database');
const sentimentService = require('../services/sentimentService');

/**
 * Create a new post
 */
const createPost = async (req, res) => {
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

      res.status(201).json({
         success: true,
         message: 'Post created successfully',
         data: { post },
      });
   } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while creating post',
      });
   }
};

/**
 * Get posts feed
 */
const getFeed = async (req, res) => {
   try {
      const userId = req.user?.id;
      const { limit = 10, offset = 0, type = 'all' } = req.query;

      // Build where clause
      let whereClause = { isPublic: true };

      if (type !== 'all') {
         whereClause.type = type.toUpperCase();
      }

      // Get posts
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
         orderBy: {
            createdAt: 'desc',
         },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      // Process posts to include user's reaction
      const processedPosts = posts.map((post) => ({
         ...post,
         userReaction: post.reactions?.[0]?.type || null,
         reactions: undefined, // Remove reactions array from response
      }));

      res.json({
         success: true,
         data: {
            posts: processedPosts,
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               hasMore: posts.length === parseInt(limit),
            },
         },
      });
   } catch (error) {
      console.error('Get feed error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching feed',
      });
   }
};

/**
 * Get single post by ID
 */
const getPostById = async (req, res) => {
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
         return res.status(404).json({
            success: false,
            error: 'Post not found',
         });
      }

      // Check if user can view this post
      if (!post.isPublic && (!userId || post.authorId !== userId)) {
         return res.status(403).json({
            success: false,
            error: 'Access denied to this post',
         });
      }

      const processedPost = {
         ...post,
         userReaction: post.reactions?.[0]?.type || null,
         reactions: undefined,
      };

      res.json({
         success: true,
         data: { post: processedPost },
      });
   } catch (error) {
      console.error('Get post by ID error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching post',
      });
   }
};

/**
 * Update post
 */
const updatePost = async (req, res) => {
   try {
      const { id } = req.params;
      const { content, isPublic } = req.body;
      const userId = req.user.id;

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
         where: { id },
      });

      if (!existingPost) {
         return res.status(404).json({
            success: false,
            error: 'Post not found',
         });
      }

      if (existingPost.authorId !== userId) {
         return res.status(403).json({
            success: false,
            error: 'Access denied: You can only edit your own posts',
         });
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

      res.json({
         success: true,
         message: 'Post updated successfully',
         data: { post: updatedPost },
      });
   } catch (error) {
      console.error('Update post error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while updating post',
      });
   }
};

/**
 * Delete post
 */
const deletePost = async (req, res) => {
   try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if post exists and user owns it
      const existingPost = await prisma.post.findUnique({
         where: { id },
      });

      if (!existingPost) {
         return res.status(404).json({
            success: false,
            error: 'Post not found',
         });
      }

      if (existingPost.authorId !== userId) {
         return res.status(403).json({
            success: false,
            error: 'Access denied: You can only delete your own posts',
         });
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

      res.json({
         success: true,
         message: 'Post deleted successfully',
      });
   } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while deleting post',
      });
   }
};

/**
 * Get posts by user
 */
const getUserPosts = async (req, res) => {
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

      res.json({
         success: true,
         data: {
            posts: processedPosts,
            pagination: {
               limit: parseInt(limit),
               offset: parseInt(offset),
               hasMore: posts.length === parseInt(limit),
            },
         },
      });
   } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({
         success: false,
         error: 'Internal server error while fetching user posts',
      });
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
