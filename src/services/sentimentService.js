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

            // Map emotion class index to emotion name
            const emotionMap = {
               0: 'ENJOYMENT',
               1: 'SADNESS',
               2: 'ANGER',
               3: 'FEAR',
               4: 'DISGUST',
               5: 'SURPRISE',
               6: 'OTHER',
            };

            // Get emotion from class index
            const emotionClass = response.data.emotion_class;
            const emotion = emotionMap[emotionClass] || 'OTHER';

            // Map scores to emotion names
            const scores = {
               ENJOYMENT: response.data.scores[0],
               SADNESS: response.data.scores[1],
               ANGER: response.data.scores[2],
               FEAR: response.data.scores[3],
               DISGUST: response.data.scores[4],
               SURPRISE: response.data.scores[5],
               OTHER: response.data.scores[6],
            };

            const result = {
               emotion: emotion,
               emotionClass: emotionClass,
               confidence: response.data.confidence,
               scores: scores,
               processingTime: response.data.processing_time,
            };

            // Store sentiment analysis in database if entityId is provided
            if (userId && entityId && entityType) {
               await this._storeSentimentAnalysis(
                  text,
                  result.emotion,
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
    * Analyze sentiment of multiple texts and return a single aggregated sentiment
    * This is useful for analyzing a conversation and getting the overall sentiment
    */
   async analyzeBatchSentiment(texts, userId = null) {
      if (!Array.isArray(texts) || texts.length === 0) {
         return this._getDefaultSentiment();
      }

      // Filter out empty texts
      const validTexts = texts.filter((text) => text && typeof text === 'string' && text.trim().length > 0);

      if (validTexts.length === 0) {
         return this._getDefaultSentiment();
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

            // Map emotion class index to emotion name
            const emotionMap = {
               0: 'ENJOYMENT',
               1: 'SADNESS',
               2: 'ANGER',
               3: 'FEAR',
               4: 'DISGUST',
               5: 'SURPRISE',
               6: 'OTHER',
            };

            const emotionClass = response.data.emotion_class;
            const emotion = emotionMap[emotionClass] || 'OTHER';

            return {
               emotion: emotion,
               emotionClass: emotionClass,
               confidence: response.data.confidence,
               scores: {
                  ENJOYMENT: response.data.scores[0],
                  SADNESS: response.data.scores[1],
                  ANGER: response.data.scores[2],
                  FEAR: response.data.scores[3],
                  DISGUST: response.data.scores[4],
                  SURPRISE: response.data.scores[5],
                  OTHER: response.data.scores[6],
               },
               textsAnalyzed: response.data.texts_analyzed,
               processingTime: response.data.processing_time,
            };
         } catch (error) {
            lastError = error;
            console.error(`Batch sentiment analysis attempt ${attempt} failed:`, error.message);

            if (attempt < this.maxRetries) {
               await this._sleep(this.retryDelay * attempt);
            }
         }
      }

      console.error('All batch sentiment analysis attempts failed:', lastError.message);
      return this._getDefaultSentiment();
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
            ENJOYMENT: 0,
            SADNESS: 0,
            ANGER: 0,
            FEAR: 0,
            DISGUST: 0,
            SURPRISE: 0,
            OTHER: 0,
            total: 0,
         };

         sentimentCounts.forEach((item) => {
            stats[item.sentiment] = item._count.sentiment;
            stats.total += item._count.sentiment;
         });

         // Calculate percentages
         if (stats.total > 0) {
            stats.enjoymentPercentage = (stats.ENJOYMENT / stats.total) * 100;
            stats.sadnessPercentage = (stats.SADNESS / stats.total) * 100;
            stats.angerPercentage = (stats.ANGER / stats.total) * 100;
            stats.fearPercentage = (stats.FEAR / stats.total) * 100;
            stats.disgustPercentage = (stats.DISGUST / stats.total) * 100;
            stats.surprisePercentage = (stats.SURPRISE / stats.total) * 100;
            stats.otherPercentage = (stats.OTHER / stats.total) * 100;
         } else {
            stats.enjoymentPercentage = 0;
            stats.sadnessPercentage = 0;
            stats.angerPercentage = 0;
            stats.fearPercentage = 0;
            stats.disgustPercentage = 0;
            stats.surprisePercentage = 0;
            stats.otherPercentage = 0;
         }

         return stats;
      } catch (error) {
         console.error('Error getting user sentiment stats:', error);
         return {
            ENJOYMENT: 0,
            SADNESS: 0,
            ANGER: 0,
            FEAR: 0,
            DISGUST: 0,
            SURPRISE: 0,
            OTHER: 0,
            total: 0,
            enjoymentPercentage: 0,
            sadnessPercentage: 0,
            angerPercentage: 0,
            fearPercentage: 0,
            disgustPercentage: 0,
            surprisePercentage: 0,
            otherPercentage: 0,
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
    * Get default emotion for fallback cases
    */
   _getDefaultSentiment() {
      return {
         emotion: 'OTHER',
         emotionClass: 6,
         confidence: 0.0,
         scores: {
            ENJOYMENT: 0.0,
            SADNESS: 0.0,
            ANGER: 0.0,
            FEAR: 0.0,
            DISGUST: 0.0,
            SURPRISE: 0.0,
            OTHER: 1.0,
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
