const express = require('express');
const router = express.Router();
const faceEmotionController = require('../controllers/faceEmotionController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Face Emotion
 *   description: Face emotion detection and tracking API
 */

/**
 * @swagger
 * /api/face-emotions:
 *   post:
 *     summary: Store face emotion manually
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emotion
 *               - confidence
 *             properties:
 *               callId:
 *                 type: string
 *                 description: ID of the call (optional)
 *               emotion:
 *                 type: string
 *                 enum: [ENJOYMENT, SADNESS, ANGER, FEAR, DISGUST, SURPRISE, OTHER]
 *               confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Emotion stored successfully
 */
router.post('/', authenticate, faceEmotionController.storeEmotion);

/**
 * @swagger
 * /api/face-emotions/recent:
 *   get:
 *     summary: Get recent emotions for current user
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of recent emotions to retrieve
 *     responses:
 *       200:
 *         description: Recent emotions retrieved successfully
 */
router.get('/recent', authenticate, faceEmotionController.getUserRecentEmotions);

/**
 * @swagger
 * /api/face-emotions/call/{callId}:
 *   get:
 *     summary: Get all emotions for a specific call
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Call emotions retrieved successfully
 */
router.get('/call/:callId', authenticate, faceEmotionController.getCallEmotions);

/**
 * @swagger
 * /api/face-emotions/call/{callId}/stats:
 *   get:
 *     summary: Get emotion statistics for a user in a call
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID (defaults to current user)
 *     responses:
 *       200:
 *         description: Emotion statistics retrieved successfully
 */
router.get('/call/:callId/stats', authenticate, faceEmotionController.getUserEmotionStats);

/**
 * @swagger
 * /api/face-emotions/call/{callId}/timeline:
 *   get:
 *     summary: Get emotion timeline for a call
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: interval
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Time interval in minutes
 *     responses:
 *       200:
 *         description: Emotion timeline retrieved successfully
 */
router.get('/call/:callId/timeline', authenticate, faceEmotionController.getEmotionTimeline);

/**
 * @swagger
 * /api/face-emotions/call/{callId}/compare:
 *   get:
 *     summary: Compare emotions between multiple users in a call
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userIds
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of user IDs
 *     responses:
 *       200:
 *         description: Emotion comparison completed successfully
 */
router.get('/call/:callId/compare', authenticate, faceEmotionController.compareUserEmotions);

/**
 * @swagger
 * /api/face-emotions/cleanup:
 *   delete:
 *     summary: Delete old emotion records (admin only)
 *     tags: [Face Emotion]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Delete records older than this many days
 *     responses:
 *       200:
 *         description: Old emotions deleted successfully
 */
router.delete('/cleanup', authenticate, faceEmotionController.cleanupOldEmotions);

module.exports = router;
