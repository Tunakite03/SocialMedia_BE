const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

// Public routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, validate(schemas.updateProfile), authController.updateProfile);
router.put('/password', authenticate, validate(schemas.changePassword), authController.changePassword);
router.get('/verify', authenticate, authController.verifyToken);

module.exports = router;
