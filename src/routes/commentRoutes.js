const express = require('express');
const router = express.Router();

const commentController = require('../controllers/commentController');
const reactionController = require('../controllers/reactionController');
const { authenticate, optionalAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

// Comment routes
router.get('/post/:postId', optionalAuth, commentController.getPostComments);
router.get('/:commentId/replies', optionalAuth, commentController.getCommentReplies);
router.post('/post/:postId', authenticate, validate(schemas.createComment), commentController.createComment);
router.put('/:id', authenticate, validate(schemas.updateComment), commentController.updateComment);
router.delete('/:id', authenticate, commentController.deleteComment);

// Reaction routes
router.post(
   '/:commentId/reactions',
   authenticate,
   validate(schemas.addReaction),
   reactionController.addCommentReaction
);
router.get('/:commentId/reactions', reactionController.getCommentReactions);

module.exports = router;
