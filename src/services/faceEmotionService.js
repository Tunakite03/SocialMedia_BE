const prisma = require('../config/database');

class FaceEmotionService {
   /**
    * Store face emotion detection data
    */
   async storeFaceEmotion({ userId, callId, emotion, confidence, metadata = {} }) {
      try {
         // Validate emotion type
         const validEmotions = [
            'ENJOYMENT',
            'SADNESS',
            'ANGER',
            'FEAR',
            'DISGUST',
            'SURPRISE',
            'OTHER',
         ];

         if (!validEmotions.includes(emotion)) {
            throw new Error(`Invalid emotion type: ${emotion}`);
         }

         // Store emotion in database
         const faceEmotion = await prisma.faceEmotion.create({
            data: {
               userId,
               callId: callId || null,
               emotion,
               confidence,
               metadata,
            },
         });

         return faceEmotion;
      } catch (error) {
         console.error('Error storing face emotion:', error);
         throw error;
      }
   }

   /**
    * Get face emotions for a specific call
    */
   async getCallEmotions(callId, options = {}) {
      const { userId, limit = 100, startTime, endTime } = options;

      try {
         const where = {
            callId,
            ...(userId && { userId }),
            ...(startTime &&
               endTime && {
                  timestamp: {
                     gte: startTime,
                     lte: endTime,
                  },
               }),
         };

         const emotions = await prisma.faceEmotion.findMany({
            where,
            orderBy: {
               timestamp: 'asc',
            },
            take: limit,
         });

         return emotions;
      } catch (error) {
         console.error('Error getting call emotions:', error);
         throw error;
      }
   }

   /**
    * Get emotion statistics for a user in a call
    */
   async getUserEmotionStats(userId, callId) {
      try {
         const emotions = await prisma.faceEmotion.findMany({
            where: {
               userId,
               callId,
            },
            select: {
               emotion: true,
               confidence: true,
            },
         });

         if (emotions.length === 0) {
            return {
               totalRecords: 0,
               distribution: {},
               averageConfidence: 0,
               dominantEmotion: null,
            };
         }

         // Calculate distribution
         const distribution = emotions.reduce((acc, curr) => {
            acc[curr.emotion] = (acc[curr.emotion] || 0) + 1;
            return acc;
         }, {});

         // Calculate percentages
         const distributionPercent = {};
         Object.keys(distribution).forEach((emotion) => {
            distributionPercent[emotion] = (distribution[emotion] / emotions.length) * 100;
         });

         // Find dominant emotion
         const dominantEmotion = Object.keys(distribution).reduce((a, b) =>
            distribution[a] > distribution[b] ? a : b
         );

         // Calculate average confidence
         const totalConfidence = emotions.reduce((sum, curr) => sum + curr.confidence, 0);
         const averageConfidence = totalConfidence / emotions.length;

         return {
            totalRecords: emotions.length,
            distribution: distributionPercent,
            averageConfidence: Math.round(averageConfidence * 100) / 100,
            dominantEmotion,
         };
      } catch (error) {
         console.error('Error getting user emotion stats:', error);
         throw error;
      }
   }

   /**
    * Get recent emotions for a user
    */
   async getUserRecentEmotions(userId, limit = 20) {
      try {
         const emotions = await prisma.faceEmotion.findMany({
            where: {
               userId,
            },
            orderBy: {
               timestamp: 'desc',
            },
            take: limit,
            include: {
               call: {
                  select: {
                     id: true,
                     type: true,
                     startedAt: true,
                     endedAt: true,
                  },
               },
            },
         });

         return emotions;
      } catch (error) {
         console.error('Error getting user recent emotions:', error);
         throw error;
      }
   }

   /**
    * Get emotion timeline for a call (grouped by time intervals)
    */
   async getEmotionTimeline(callId, intervalMinutes = 1) {
      try {
         const emotions = await prisma.faceEmotion.findMany({
            where: {
               callId,
            },
            orderBy: {
               timestamp: 'asc',
            },
            include: {
               call: {
                  select: {
                     startedAt: true,
                  },
               },
            },
         });

         if (emotions.length === 0) {
            return [];
         }

         // Group emotions by time intervals
         const startTime = emotions[0].timestamp;
         const intervalMs = intervalMinutes * 60 * 1000;

         const timeline = [];
         let currentInterval = {
            startTime: startTime,
            endTime: new Date(startTime.getTime() + intervalMs),
            emotions: {},
            count: 0,
         };

         emotions.forEach((emotion) => {
            const emotionTime = emotion.timestamp;

            // Check if emotion is in current interval
            if (emotionTime <= currentInterval.endTime) {
               currentInterval.emotions[emotion.emotion] =
                  (currentInterval.emotions[emotion.emotion] || 0) + 1;
               currentInterval.count++;
            } else {
               // Start new interval
               if (currentInterval.count > 0) {
                  timeline.push(currentInterval);
               }

               currentInterval = {
                  startTime: new Date(
                     Math.floor(emotionTime.getTime() / intervalMs) * intervalMs
                  ),
                  endTime: new Date(
                     (Math.floor(emotionTime.getTime() / intervalMs) + 1) * intervalMs
                  ),
                  emotions: {
                     [emotion.emotion]: 1,
                  },
                  count: 1,
               };
            }
         });

         // Add last interval
         if (currentInterval.count > 0) {
            timeline.push(currentInterval);
         }

         // Calculate percentages for each interval
         return timeline.map((interval) => {
            const emotionsPercent = {};
            Object.keys(interval.emotions).forEach((emotion) => {
               emotionsPercent[emotion] = Math.round(
                  (interval.emotions[emotion] / interval.count) * 100
               );
            });

            return {
               startTime: interval.startTime,
               endTime: interval.endTime,
               emotions: emotionsPercent,
               totalCount: interval.count,
            };
         });
      } catch (error) {
         console.error('Error getting emotion timeline:', error);
         throw error;
      }
   }

   /**
    * Delete old emotion records (for cleanup)
    */
   async deleteOldEmotions(daysOld = 30) {
      try {
         const cutoffDate = new Date();
         cutoffDate.setDate(cutoffDate.getDate() - daysOld);

         const result = await prisma.faceEmotion.deleteMany({
            where: {
               timestamp: {
                  lt: cutoffDate,
               },
            },
         });

         return result.count;
      } catch (error) {
         console.error('Error deleting old emotions:', error);
         throw error;
      }
   }

   /**
    * Get emotion comparison between multiple users in a call
    */
   async compareUserEmotions(callId, userIds) {
      try {
         const comparison = {};

         for (const userId of userIds) {
            const stats = await this.getUserEmotionStats(userId, callId);
            comparison[userId] = stats;
         }

         return comparison;
      } catch (error) {
         console.error('Error comparing user emotions:', error);
         throw error;
      }
   }
}

module.exports = new FaceEmotionService();
