const express = require('express');
const router = express.Router();
const sentimentController = require('../controllers/sentimentController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * tags:
 *   name: Sentiment
 *   description: Sentiment analysis API
 */

/**
 * @swagger
 * /api/sentiment/analyze/batch:
 *   post:
 *     summary: Analyze sentiment for multiple texts
 *     tags: [Sentiment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - texts
 *             properties:
 *               texts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of texts to analyze (max 100)
 *                 example: ["I love this product!", "This is terrible", "It's okay"]
 *     responses:
 *       200:
 *         description: Batch sentiment analysis completed
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/analyze/batch', authenticate, validate(schemas.analyzeBatchSentiment), sentimentController.analyzeBatch);

/**
 * @swagger
 * /api/sentiment/analyze:
 *   post:
 *     summary: Analyze sentiment for a single text
 *     tags: [Sentiment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to analyze
 *                 example: "I really enjoyed this experience!"
 *               entityId:
 *                 type: string
 *                 description: Optional entity ID for tracking
 *               entityType:
 *                 type: string
 *                 description: Optional entity type (e.g., 'post', 'comment', 'message')
 *     responses:
 *       200:
 *         description: Sentiment analysis completed
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/analyze', authenticate, validate(schemas.analyzeSingleSentiment), sentimentController.analyzeSingle);

/**
 * @swagger
 * /api/sentiment/stats:
 *   get:
 *     summary: Get sentiment statistics for the authenticated user
 *     tags: [Sentiment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Sentiment statistics retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', authenticate, sentimentController.getUserStats);

/**
 * @swagger
 * /api/sentiment/health:
 *   get:
 *     summary: Check sentiment service health
 *     tags: [Sentiment]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', sentimentController.checkHealth);

/**
 * @swagger
 * /api/sentiment/model/info:
 *   get:
 *     summary: Get sentiment model information
 *     tags: [Sentiment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Model information retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/model/info', authenticate, sentimentController.getModelInfo);

module.exports = router;
