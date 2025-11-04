/**
 * Example of how to apply the error handling pattern to other controllers
 */

const { successResponse } = require('../utils/responseFormatter');
const {
   NotFoundError,
   ValidationError,
   ConflictError,
   ERROR_MESSAGES,
   SUCCESS_MESSAGES,
   HTTP_STATUS,
} = require('../constants/errors');

// Example for userController.js
const getUserById = async (req, res, next) => {
   try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
         where: { id: parseInt(id) },
         select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            bio: true,
            // ... other fields
         },
      });

      if (!user) {
         throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      return successResponse(res, { user });
   } catch (error) {
      next(error);
   }
};

// Example for postController.js
const createPost = async (req, res, next) => {
   try {
      const { title, content, tags } = req.body;

      if (!title || !content) {
         throw new ValidationError('Title and content are required');
      }

      const post = await prisma.post.create({
         data: {
            title,
            content,
            authorId: req.user.id,
            tags: tags || [],
         },
         include: {
            author: {
               select: {
                  id: true,
                  username: true,
                  avatar: true,
               },
            },
         },
      });

      return successResponse(res, { post }, 'Post created successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      next(error);
   }
};

// Example with pagination
const getPosts = async (req, res, next) => {
   try {
      const { page = 1, limit = 10, search } = req.query;
      const skip = (page - 1) * limit;

      const where = search
         ? {
              OR: [
                 { title: { contains: search, mode: 'insensitive' } },
                 { content: { contains: search, mode: 'insensitive' } },
              ],
           }
         : {};

      const [posts, total] = await Promise.all([
         prisma.post.findMany({
            where,
            skip,
            take: parseInt(limit),
            include: {
               author: {
                  select: {
                     id: true,
                     username: true,
                     avatar: true,
                  },
               },
               _count: {
                  select: {
                     reactions: true,
                     comments: true,
                  },
               },
            },
            orderBy: { createdAt: 'desc' },
         }),
         prisma.post.count({ where }),
      ]);

      const pagination = {
         page: parseInt(page),
         limit: parseInt(limit),
         total,
         pages: Math.ceil(total / limit),
         hasNext: page * limit < total,
         hasPrev: page > 1,
      };

      return paginatedResponse(res, posts, pagination);
   } catch (error) {
      next(error);
   }
};

module.exports = {
   getUserById,
   createPost,
   getPosts,
};
