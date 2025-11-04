const express = require('express');
const router = express.Router();

const postController = require('../controllers/postController');
const reactionController = require('../controllers/reactionController');
const { authenticate, optionalAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

// Public routes (with optional auth for additional data)
router.get('/feed', optionalAuth, postController.getFeed);
router.get('/:id', optionalAuth, postController.getPostById);
router.get('/user/:userId', optionalAuth, postController.getUserPosts);

// Protected routes
router.post('/', authenticate, validate(schemas.createPost), postController.createPost);
router.put('/:id', authenticate, validate(schemas.updatePost), postController.updatePost);
router.delete('/:id', authenticate, postController.deletePost);

// Reaction routes
router.post('/:postId/reactions', authenticate, validate(schemas.addReaction), reactionController.addPostReaction);
router.get('/:postId/reactions', reactionController.getPostReactions);

module.exports = router;
