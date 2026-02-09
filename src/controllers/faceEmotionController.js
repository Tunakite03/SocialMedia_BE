const faceEmotionService = require('../services/faceEmotionService');
const { successResponse } = require('../utils/responseFormatter');
const { ValidationError } = require('../constants/errors');

/**
 * Store face emotion detection manually (for testing or non-realtime scenarios)
 */
const storeEmotion = async (req, res, next) => {
   try {
      const { callId, emotion, confidence, metadata } = req.body;
      const userId = req.user.id;

      // Validate input
      if (!emotion || confidence === undefined) {
         throw new ValidationError('emotion and confidence are required');
      }

      const validEmotions = [
         'ENJOYMENT',
         'SADNESS',
         'ANGER',
         'FEAR',
         'DISGUST',
         'SURPRISE',
         'OTHER',
      ];

      if (!validEmotions.includes(emotion.toUpperCase())) {
         throw new ValidationError(`Invalid emotion type. Must be one of: ${validEmotions.join(', ')}`);
      }

      if (confidence < 0 || confidence > 1) {
         throw new ValidationError('confidence must be between 0 and 1');
      }

      // Store emotion
      const result = await faceEmotionService.storeFaceEmotion({
         userId,
         callId: callId || null,
         emotion: emotion.toUpperCase(),
         confidence,
         metadata: metadata || {},
      });

      return successResponse(res, result, 'Face emotion stored successfully');
   } catch (error) {
      next(error);
   }
};

/**
 * Get emotions for a specific call
 */
const getCallEmotions = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { userId, limit, startTime, endTime } = req.query;

      const options = {
         userId: userId || undefined,
         limit: limit ? parseInt(limit) : 100,
         startTime: startTime ? new Date(startTime) : undefined,
         endTime: endTime ? new Date(endTime) : undefined,
      };

      const emotions = await faceEmotionService.getCallEmotions(callId, options);

      return successResponse(res, emotions, `Retrieved ${emotions.length} emotion records`);
   } catch (error) {
      next(error);
   }
};

/**
 * Get emotion statistics for a user in a call
 */
const getUserEmotionStats = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { userId } = req.query;
      const targetUserId = userId || req.user.id;

      const stats = await faceEmotionService.getUserEmotionStats(targetUserId, callId);

      return successResponse(res, stats, 'Emotion statistics retrieved successfully');
   } catch (error) {
      next(error);
   }
};

/**
 * Get recent emotions for current user
 */
const getUserRecentEmotions = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;

      const emotions = await faceEmotionService.getUserRecentEmotions(userId, limit);

      return successResponse(res, emotions, `Retrieved ${emotions.length} recent emotions`);
   } catch (error) {
      next(error);
   }
};

/**
 * Get emotion timeline for a call
 */
const getEmotionTimeline = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const intervalMinutes = req.query.interval ? parseInt(req.query.interval) : 1;

      const timeline = await faceEmotionService.getEmotionTimeline(callId, intervalMinutes);

      return successResponse(res, timeline, 'Emotion timeline retrieved successfully');
   } catch (error) {
      next(error);
   }
};

/**
 * Compare emotions between multiple users in a call
 */
const compareUserEmotions = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { userIds } = req.query;

      if (!userIds) {
         throw new ValidationError('userIds query parameter is required');
      }

      const userIdArray = Array.isArray(userIds) ? userIds : userIds.split(',');

      if (userIdArray.length < 2) {
         throw new ValidationError('At least 2 user IDs are required for comparison');
      }

      const comparison = await faceEmotionService.compareUserEmotions(callId, userIdArray);

      return successResponse(res, comparison, 'Emotion comparison completed successfully');
   } catch (error) {
      next(error);
   }
};

/**
 * Delete old emotion records (admin only)
 */
const cleanupOldEmotions = async (req, res, next) => {
   try {
      const daysOld = req.query.days ? parseInt(req.query.days) : 30;

      if (daysOld < 1) {
         throw new ValidationError('days must be at least 1');
      }

      const deletedCount = await faceEmotionService.deleteOldEmotions(daysOld);

      return successResponse(
         res,
         { deletedCount },
         `Deleted ${deletedCount} emotion records older than ${daysOld} days`
      );
   } catch (error) {
      next(error);
   }
};

module.exports = {
   storeEmotion,
   getCallEmotions,
   getUserEmotionStats,
   getUserRecentEmotions,
   getEmotionTimeline,
   compareUserEmotions,
   cleanupOldEmotions,
};
