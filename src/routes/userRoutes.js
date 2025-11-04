const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authenticate, optionalAuth } = require('../middlewares/authMiddleware');

// Public routes (with optional authentication for additional data)
router.get('/search', optionalAuth, userController.searchUsers);
router.get('/:id', optionalAuth, userController.getUserById);
router.get('/:id/followers', userController.getFollowers);
router.get('/:id/following', userController.getFollowing);

// Protected routes
router.post('/:id/follow', authenticate, userController.followUser);
router.delete('/:id/follow', authenticate, userController.unfollowUser);

module.exports = router;
