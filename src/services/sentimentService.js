const axios = require('axios');
const prisma = require('../config/database');

class SentimentService {
   constructor() {
      this.serviceUrl = process.env.SENTIMENT_SERVICE_URL || 'http://localhost:8000';
      this.maxRetries = 3;
      this.retryDelay = 1000; // 1 second
   }

   /**
    * Check if sentiment service is healthy
    */
   async isHealthy() {
      try {
         const response = await axios.get(`${this.serviceUrl}/health`, {
            timeout: 5000,
         });
         return response.data.status === 'healthy' && response.data.model_loaded;
      } catch (error) {
         console.error('Sentiment service health check failed:', error.message);
         return false;
      }
   }

   /**
    * Analyze sentiment of a single text
    */
   async analyzeSentiment(text, userId = null, entityId = null, entityType = null) {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
         return this._getDefaultSentiment();
      }

      let lastError;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
         try {
            const response = await axios.post(
               `${this.serviceUrl}/analyze`,
               {
                  text: text.trim(),
                  user_id: userId,
                  entity_id: entityId,
                  entity_type: entityType,
               },
               {
                  timeout: 10000,
                  headers: {
                     'Content-Type': 'application/json',
                  },
               }
            );

            const result = {
               sentiment: response.data.sentiment,
               confidence: response.data.confidence,
               scores: response.data.scores,
               processingTime: response.data.processing_time,
            };

            // Store sentiment analysis in database if entityId is provided
            if (userId && entityId && entityType) {
               await this._storeSentimentAnalysis(
                  text,
                  result.sentiment,
                  result.confidence,
                  userId,
                  entityId,
                  entityType
               );
            }

            return result;
         } catch (error) {
            lastError = error;
            console.error(`Sentiment analysis attempt ${attempt} failed:`, error.message);

            if (attempt < this.maxRetries) {
               await this._sleep(this.retryDelay * attempt);
            }
         }
      }

      console.error('All sentiment analysis attempts failed:', lastError.message);
      return this._getDefaultSentiment();
   }

   /**
    * Analyze sentiment of multiple texts
    */
   async analyzeBatchSentiment(texts, userId = null) {
      if (!Array.isArray(texts) || texts.length === 0) {
         return [];
      }

      // Filter out empty texts
      const validTexts = texts.filter((text) => text && typeof text === 'string' && text.trim().length > 0);

      if (validTexts.length === 0) {
         return texts.map(() => this._getDefaultSentiment());
      }

      let lastError;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
         try {
            const response = await axios.post(
               `${this.serviceUrl}/analyze/batch`,
               {
                  texts: validTexts,
                  user_id: userId,
               },
               {
                  timeout: 30000,
                  headers: {
                     'Content-Type': 'application/json',
                  },
               }
            );

            return response.data.results.map((result) => ({
               sentiment: result.sentiment,
               confidence: result.confidence,
               scores: result.scores,
               processingTime: result.processing_time,
            }));
         } catch (error) {
            lastError = error;
            console.error(`Batch sentiment analysis attempt ${attempt} failed:`, error.message);

            if (attempt < this.maxRetries) {
               await this._sleep(this.retryDelay * attempt);
            }
         }
      }

      console.error('All batch sentiment analysis attempts failed:', lastError.message);
      return validTexts.map(() => this._getDefaultSentiment());
   }

   /**
    * Get sentiment statistics for a user
    */
   async getUserSentimentStats(userId, days = 30) {
      try {
         const cutoffDate = new Date();
         cutoffDate.setDate(cutoffDate.getDate() - days);

         const sentimentCounts = await prisma.sentimentAnalysis.groupBy({
            by: ['sentiment'],
            where: {
               userId,
               createdAt: {
                  gte: cutoffDate,
               },
            },
            _count: {
               sentiment: true,
            },
         });

         const stats = {
            POSITIVE: 0,
            NEUTRAL: 0,
            NEGATIVE: 0,
            total: 0,
         };

         sentimentCounts.forEach((item) => {
            stats[item.sentiment] = item._count.sentiment;
            stats.total += item._count.sentiment;
         });

         // Calculate percentages
         if (stats.total > 0) {
            stats.positivePercentage = (stats.POSITIVE / stats.total) * 100;
            stats.neutralPercentage = (stats.NEUTRAL / stats.total) * 100;
            stats.negativePercentage = (stats.NEGATIVE / stats.total) * 100;
         } else {
            stats.positivePercentage = 0;
            stats.neutralPercentage = 0;
            stats.negativePercentage = 0;
         }

         return stats;
      } catch (error) {
         console.error('Error getting user sentiment stats:', error);
         return {
            POSITIVE: 0,
            NEUTRAL: 0,
            NEGATIVE: 0,
            total: 0,
            positivePercentage: 0,
            neutralPercentage: 0,
            negativePercentage: 0,
         };
      }
   }

   /**
    * Get model information from sentiment service
    */
   async getModelInfo() {
      try {
         const response = await axios.get(`${this.serviceUrl}/models/info`, {
            timeout: 5000,
         });
         return response.data;
      } catch (error) {
         console.error('Error getting model info:', error);
         return null;
      }
   }

   /**
    * Store sentiment analysis result in database
    */
   async _storeSentimentAnalysis(content, sentiment, confidence, userId, entityId, entityType) {
      try {
         await prisma.sentimentAnalysis.create({
            data: {
               content,
               sentiment,
               confidence,
               userId,
               entityId,
               entityType,
            },
         });
      } catch (error) {
         console.error('Error storing sentiment analysis:', error);
         // Don't throw error as this is not critical for the main flow
      }
   }

   /**
    * Get default sentiment for fallback cases
    */
   _getDefaultSentiment() {
      return {
         sentiment: 'NEUTRAL',
         confidence: 0.0,
         scores: {
            POSITIVE: 0.0,
            NEUTRAL: 1.0,
            NEGATIVE: 0.0,
         },
         processingTime: 0.0,
      };
   }

   /**
    * Sleep for specified milliseconds
    */
   _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
   }
}

// Export singleton instance
module.exports = new SentimentService();
