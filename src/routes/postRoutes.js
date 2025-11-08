const express = require('express');
const router = express.Router();

const postController = require('../controllers/postController');
const reactionController = require('../controllers/reactionController');
const { authenticate, optionalAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');
const { uploadMiddleware, handleUploadError } = require('../middlewares/uploadMiddleware');

/**
 * @swagger
 * /posts/feed:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get posts feed
 *     description: Get paginated feed of posts from users the authenticated user follows, plus public posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of posts to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of posts to skip
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [TEXT, IMAGE, VIDEO]
 *         description: Filter posts by type
 *     responses:
 *       200:
 *         description: Posts feed retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/feed', optionalAuth, postController.getFeed);

/**
 * @swagger
 * /posts/{id}:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get post by ID
 *     description: Get detailed information about a specific post
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         post:
 *                           allOf:
 *                             - $ref: '#/components/schemas/Post'
 *                             - type: object
 *                               properties:
 *                                 author:
 *                                   $ref: '#/components/schemas/User'
 *                                 reactions:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       type:
 *                                         type: string
 *                                       count:
 *                                         type: integer
 *                                 userReaction:
 *                                   type: string
 *                                   nullable: true
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', optionalAuth, postController.getPostById);

/**
 * @swagger
 * /posts/user/{userId}:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get user posts
 *     description: Get posts created by a specific user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of posts to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of posts to skip
 *     responses:
 *       200:
 *         description: User posts retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/user/:userId', optionalAuth, postController.getUserPosts);

/**
 * @swagger
 * /posts:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Create post
 *     description: Create a new post with optional media upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Post content text
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the post is public
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: Media file (image or video)
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         post:
 *                           $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
   '/',
   authenticate,
   uploadMiddleware.single('media'), // Support single file upload with field name 'media'
   handleUploadError,
   validate(schemas.createPost),
   postController.createPost
);

/**
 * @swagger
 * /posts/{id}:
 *   put:
 *     tags:
 *       - Posts
 *     summary: Update post
 *     description: Update an existing post (only by the author)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated post content
 *               isPublic:
 *                 type: boolean
 *                 description: Whether the post is public
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: New media file (optional)
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         post:
 *                           $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - not the post author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
   '/:id',
   authenticate,
   uploadMiddleware.single('media'), // Support single file upload with field name 'media'
   handleUploadError,
   validate(schemas.updatePost),
   postController.updatePost
);

/**
 * @swagger
 * /posts/{id}:
 *   delete:
 *     tags:
 *       - Posts
 *     summary: Delete post
 *     description: Delete a post (only by the author)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - not the post author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authenticate, postController.deletePost);

/**
 * @swagger
 * /posts/{postId}/reactions:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Add reaction to post
 *     description: Add or update reaction (like, love, laugh, etc.) to a post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LIKE, LOVE, LAUGH, ANGRY, SAD, WOW]
 *                 description: Reaction type
 *     responses:
 *       200:
 *         description: Reaction added/updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         reaction:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             type:
 *                               type: string
 *                         action:
 *                           type: string
 *                           enum: [added, updated, removed]
 *                         counts:
 *                           type: object
 *                           description: Reaction counts by type
 *       400:
 *         description: Invalid reaction type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:postId/reactions', authenticate, validate(schemas.addReaction), reactionController.addPostReaction);

/**
 * @swagger
 * /posts/{postId}/reactions:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get post reactions
 *     description: Get reactions for a specific post
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Post ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LIKE, LOVE, LAUGH, ANGRY, SAD, WOW]
 *         description: Filter by reaction type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of reactions to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of reactions to skip
 *     responses:
 *       200:
 *         description: Post reactions retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:postId/reactions', reactionController.getPostReactions);

module.exports = router;
