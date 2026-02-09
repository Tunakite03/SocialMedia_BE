const sentimentService = require('../services/sentimentService');
const { successResponse } = require('../utils/responseFormatter');
const { ValidationError, HTTP_STATUS } = require('../constants/errors');

/**
 * Analyze sentiment for a batch of texts
 * Useful for analyzing call transcripts, chat histories, etc.
 */
const analyzeBatch = async (req, res, next) => {
   try {
      const { texts } = req.body;
      const userId = req.user?.id;

      // Validate input
      if (!Array.isArray(texts)) {
         throw new ValidationError('texts must be an array');
      }

      if (texts.length === 0) {
         throw new ValidationError('texts array cannot be empty');
      }

      if (texts.length > 100) {
         throw new ValidationError('Maximum 100 texts allowed per batch');
      }

      // Validate that all items are strings
      const invalidTexts = texts.filter((text) => typeof text !== 'string');
      if (invalidTexts.length > 0) {
         throw new ValidationError('All items in texts array must be strings');
      }

      // Analyze sentiment for all texts
      const results = await sentimentService.analyzeBatchSentiment(texts, userId);

      return successResponse(
         res,
         {
            results,
            totalAnalyzed: results.length,
         },
         'Batch sentiment analysis completed successfully'
      );
   } catch (error) {
      next(error);
   }
};

/**
 * Analyze sentiment for a single text
 */
const analyzeSingle = async (req, res, next) => {
   try {
      const { text, entityId, entityType } = req.body;
      const userId = req.user?.id;

      // Validate input
      if (!text || typeof text !== 'string') {
         throw new ValidationError('text is required and must be a string');
      }

      if (text.trim().length === 0) {
         throw new ValidationError('text cannot be empty');
      }

      // Analyze sentiment
      const result = await sentimentService.analyzeSentiment(text, userId, entityId, entityType);

      return successResponse(res, result, 'Sentiment analysis completed successfully');
   } catch (error) {
      next(error);
   }
};

/**
 * Get sentiment statistics for a user
 */
const getUserStats = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const days = parseInt(req.query.days) || 30;

      if (days < 1 || days > 365) {
         throw new ValidationError('days must be between 1 and 365');
      }

      const stats = await sentimentService.getUserSentimentStats(userId, days);

      return successResponse(res, stats, `Sentiment statistics for last ${days} days`);
   } catch (error) {
      next(error);
   }
};

/**
 * Check sentiment service health
 */
const checkHealth = async (req, res, next) => {
   try {
      const isHealthy = await sentimentService.isHealthy();

      return successResponse(
         res,
         {
            healthy: isHealthy,
            status: isHealthy ? 'operational' : 'unavailable',
         },
         isHealthy ? 'Sentiment service is healthy' : 'Sentiment service is unavailable'
      );
   } catch (error) {
      next(error);
   }
};

/**
 * Get model information
 */
const getModelInfo = async (req, res, next) => {
   try {
      const modelInfo = await sentimentService.getModelInfo();

      if (!modelInfo) {
         throw new ValidationError('Unable to retrieve model information');
      }

      return successResponse(res, modelInfo, 'Model information retrieved successfully');
   } catch (error) {
      next(error);
   }
};

module.exports = {
   analyzeBatch,
   analyzeSingle,
   getUserStats,
   checkHealth,
   getModelInfo,
};
