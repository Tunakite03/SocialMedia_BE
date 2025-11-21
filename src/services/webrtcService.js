const prisma = require('../config/database');
const Logger = require('../utils/logger');

/**
 * WebRTC Service for managing peer connections and signaling
 */
class WebRTCService {
   constructor() {
      this.activeCalls = new Map(); // callId -> call metadata
      this.userConnections = new Map(); // userId -> { callId, socketId, peerConnections }
      this.rtcConfiguration = this.getRTCConfiguration();
   }

   /**
    * Get ICE servers configuration (STUN/TURN)
    */
   getIceServers() {
      const iceServersArray = [
         {
            urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
         },
         // Add TURN servers for production
         ...(process.env.TURN_SERVER_URL
            ? [
                 {
                    urls: process.env.TURN_SERVER_URL,
                    username: process.env.TURN_USERNAME,
                    credential: process.env.TURN_CREDENTIAL,
                 },
              ]
            : []),
      ];

      return iceServersArray;
   }

   /**
    * Get RTCConfiguration object for WebRTC
    */
   getRTCConfiguration() {
      return {
         iceServers: this.getIceServers(),
         iceCandidatePoolSize: 10,
      };
   }

   /**
    * Initialize call session
    */
   async initializeCall(callId, initiatorId, participants) {
      try {
         Logger.info(`Initializing WebRTC call: ${callId}`);

         const callSession = {
            id: callId,
            initiatorId,
            participants: new Map(), // userId -> { socketId, joinedAt, connectionState }
            rtcConfiguration: this.rtcConfiguration,
            startedAt: new Date(),
            status: 'initializing',
         };

         // Add participants to session
         participants.forEach((participant) => {
            callSession.participants.set(participant.userId, {
               userId: participant.userId,
               status: participant.status,
               socketId: null,
               joinedAt: null,
               connectionState: 'new',
               mediaState: {
                  audio: true,
                  video: participant.callType === 'VIDEO',
               },
            });
         });

         this.activeCalls.set(callId, callSession);

         // Update call in database with ICE servers config
         await prisma.call.update({
            where: { id: callId },
            data: {
               iceServers: this.getIceServers(),
               metadata: {
                  participantCount: participants.length,
                  callType: participants[0]?.type || 'AUDIO',
               },
            },
         });

         return callSession;
      } catch (error) {
         Logger.error('Error initializing WebRTC call:', error);
         throw error;
      }
   }

   /**
    * Handle user joining call room
    */
   async joinCallRoom(callId, userId, socketId) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (!callSession) {
            throw new Error('Call session not found');
         }

         const participant = callSession.participants.get(userId);
         if (!participant) {
            throw new Error('User not authorized for this call');
         }

         // Update participant info
         participant.socketId = socketId;
         participant.joinedAt = new Date();
         participant.connectionState = 'connecting';

         // Update user connection mapping
         this.userConnections.set(userId, {
            callId,
            socketId,
            joinedAt: new Date(),
         });

         // Update database
         await prisma.callParticipant.update({
            where: {
               callId_userId: { callId, userId },
            },
            data: {
               status: 'JOINED',
               joinedAt: new Date(),
               metadata: {
                  connectionState: 'connecting',
                  joinedVia: 'webrtc',
               },
            },
         });

         Logger.info(`User ${userId} joined call room ${callId}`);
         return participant;
      } catch (error) {
         Logger.error('Error joining call room:', error);
         throw error;
      }
   }

   /**
    * Handle user leaving call room
    */
   async leaveCallRoom(callId, userId) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (callSession) {
            const participant = callSession.participants.get(userId);
            if (participant) {
               participant.connectionState = 'disconnected';
               participant.leftAt = new Date();
            }
         }

         // Remove user connection
         this.userConnections.delete(userId);

         // Update database
         await prisma.callParticipant.update({
            where: {
               callId_userId: { callId, userId },
            },
            data: {
               status: 'LEFT',
               leftAt: new Date(),
               metadata: {
                  connectionState: 'disconnected',
                  leftAt: new Date(),
               },
            },
         });

         Logger.info(`User ${userId} left call room ${callId}`);

         // Check if call should be ended
         await this.checkCallCompletion(callId);
      } catch (error) {
         Logger.error('Error leaving call room:', error);
         throw error;
      }
   }

   /**
    * Process WebRTC signaling event
    */
   async processSignalingEvent(callId, userId, eventType, data) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (!callSession) {
            throw new Error('Call session not found');
         }

         const participant = callSession.participants.get(userId);
         if (!participant) {
            throw new Error('User not authorized for this call');
         }

         // Log signaling event to database
         await prisma.callSignalingEvent.create({
            data: {
               callId,
               userId,
               eventType,
               data: data || {},
               timestamp: new Date(),
            },
         });

         // Update participant connection state based on event
         switch (eventType) {
            case 'offer':
               participant.connectionState = 'have-local-offer';
               break;
            case 'answer':
               participant.connectionState = 'stable';
               break;
            case 'ice-candidate':
               // Keep current state for ICE candidates
               break;
            case 'connection-state-change':
               participant.connectionState = data.connectionState;
               break;
         }

         Logger.debug(`WebRTC signaling event: ${eventType} for call ${callId} from user ${userId}`);
         return true;
      } catch (error) {
         Logger.error('Error processing signaling event:', error);
         throw error;
      }
   }

   /**
    * Update call quality metrics
    */
   async updateQualityMetrics(callId, userId, metrics) {
      try {
         await prisma.callQualityMetric.create({
            data: {
               callId,
               userId,
               packetLoss: metrics.packetLoss,
               jitter: metrics.jitter,
               roundTripTime: metrics.roundTripTime,
               audioLevel: metrics.audioLevel,
               videoResolution: metrics.videoResolution,
               frameRate: metrics.frameRate,
               bandwidth: metrics.bandwidth,
               connectionState: metrics.connectionState,
               timestamp: new Date(),
            },
         });

         Logger.debug(`Updated quality metrics for call ${callId} user ${userId}`);
      } catch (error) {
         Logger.error('Error updating quality metrics:', error);
         throw error;
      }
   }

   /**
    * Handle media state changes (mute/unmute, video on/off)
    */
   async updateMediaState(callId, userId, mediaState) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (!callSession) {
            throw new Error('Call session not found');
         }

         const participant = callSession.participants.get(userId);
         if (!participant) {
            throw new Error('User not authorized for this call');
         }

         // Update media state
         participant.mediaState = { ...participant.mediaState, ...mediaState };

         // Update database participant metadata
         await prisma.callParticipant.update({
            where: {
               callId_userId: { callId, userId },
            },
            data: {
               metadata: {
                  ...participant.metadata,
                  mediaState: participant.mediaState,
                  lastMediaUpdate: new Date(),
               },
            },
         });

         Logger.info(`Media state updated for call ${callId} user ${userId}:`, mediaState);
         return participant.mediaState;
      } catch (error) {
         Logger.error('Error updating media state:', error);
         throw error;
      }
   }

   /**
    * Check if call should be completed
    */
   async checkCallCompletion(callId) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (!callSession) {
            return;
         }

         const activeParticipants = Array.from(callSession.participants.values()).filter(
            (p) => p.connectionState !== 'disconnected'
         );

         // End call if no active participants or only one remains
         if (activeParticipants.length <= 1) {
            await this.endCall(callId);
         }
      } catch (error) {
         Logger.error('Error checking call completion:', error);
      }
   }

   /**
    * End call session
    */
   async endCall(callId) {
      try {
         const callSession = this.activeCalls.get(callId);
         if (!callSession) {
            return;
         }

         // Calculate call duration
         const duration = Math.floor((new Date() - callSession.startedAt) / 1000);

         // Update call in database
         await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'ENDED',
               endedAt: new Date(),
               duration,
            },
         });

         // Update all participants to LEFT status
         await prisma.callParticipant.updateMany({
            where: {
               callId,
               status: { in: ['INVITED', 'JOINED'] },
            },
            data: {
               status: 'LEFT',
               leftAt: new Date(),
            },
         });

         // Remove from active calls
         this.activeCalls.delete(callId);

         // Remove user connections for this call
         for (const [userId, connection] of this.userConnections.entries()) {
            if (connection.callId === callId) {
               this.userConnections.delete(userId);
            }
         }

         Logger.info(`Call ${callId} ended. Duration: ${duration} seconds`);
         return { callId, duration, endedAt: new Date() };
      } catch (error) {
         Logger.error('Error ending call:', error);
         throw error;
      }
   }

   /**
    * Get call session info
    */
   getCallSession(callId) {
      return this.activeCalls.get(callId);
   }

   /**
    * Get user's current call
    */
   getUserCall(userId) {
      const connection = this.userConnections.get(userId);
      return connection ? this.activeCalls.get(connection.callId) : null;
   }

   /**
    * Get active calls count
    */
   getActiveCallsCount() {
      return this.activeCalls.size;
   }

   /**
    * Get call statistics
    */
   getCallStats(callId) {
      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
         return null;
      }

      const participants = Array.from(callSession.participants.values());
      const connected = participants.filter((p) => p.connectionState === 'connected' || p.connectionState === 'stable');
      const duration = Math.floor((new Date() - callSession.startedAt) / 1000);

      return {
         callId,
         participantCount: participants.length,
         connectedCount: connected.length,
         duration,
         status: callSession.status,
      };
   }
}

module.exports = new WebRTCService();
