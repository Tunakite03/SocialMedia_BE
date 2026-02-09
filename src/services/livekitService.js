const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const prisma = require('../config/database');
const Logger = require('../utils/logger');

/**
 * LiveKit Service for managing video/audio calls
 * Replaces the complex WebRTC signaling logic
 */
class LiveKitService {
   constructor() {
      // LiveKit configuration from environment variables
      this.apiKey = process.env.LIVEKIT_API_KEY;
      this.apiSecret = process.env.LIVEKIT_API_SECRET;
      this.wsUrl = process.env.LIVEKIT_WS_URL ;

      if (!this.apiKey || !this.apiSecret) {
         Logger.warn('LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET');
      }

      // Initialize RoomServiceClient for room management
      this.roomService = new RoomServiceClient(this.wsUrl, this.apiKey, this.apiSecret);

      // Track active rooms
      this.activeRooms = new Map(); // callId -> roomName
   }

   /**
    * Generate access token for a participant to join a room
    * @param {string} roomName - Name of the room
    * @param {string} participantIdentity - Unique identifier for participant (userId)
    * @param {object} participantMetadata - Additional metadata (username, avatar, etc.)
    * @param {object} permissions - Participant permissions
    * @returns {string} JWT token for client to connect
    */
   async generateToken(roomName, participantIdentity, participantMetadata = {}, permissions = {}) {
      try {
         const at = new AccessToken(this.apiKey, this.apiSecret, {
            identity: participantIdentity,
            name: participantMetadata.displayName || participantMetadata.username,
            metadata: JSON.stringify(participantMetadata),
         });

         // Set permissions
         at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: permissions.canPublish !== false,
            canSubscribe: permissions.canSubscribe !== false,
            canPublishData: permissions.canPublishData !== false,
            canUpdateOwnMetadata: permissions.canUpdateOwnMetadata !== false,
            // Recorder permission for call recording feature
            recorder: permissions.recorder || false,
         });

         const token = at.toJwt();
         Logger.info(`Generated LiveKit token for ${participantIdentity} in room ${roomName}`);

         return token;
      } catch (error) {
         Logger.error('Error generating LiveKit token:', error);
         throw error;
      }
   }

   /**
    * Create a new room for a call
    * @param {string} callId - Unique call identifier
    * @param {object} options - Room configuration options
    * @returns {object} Room information
    */
   async createRoom(callId, options = {}) {
      try {
         const roomName = `call_${callId}`;

         const roomOptions = {
            name: roomName,
            emptyTimeout: options.emptyTimeout || 300, // 5 minutes default
            maxParticipants: options.maxParticipants || 50,
            metadata: JSON.stringify({
               callId,
               type: options.type || 'AUDIO',
               createdAt: new Date().toISOString(),
               transcriptionEnabled: options.enableTranscription !== false, // Enable by default
               transcriptionLanguage: options.transcriptionLanguage || 'en-US',
               ...options.metadata,
            }),
         };

         // Create room via LiveKit API
         const room = await this.roomService.createRoom(roomOptions);

         this.activeRooms.set(callId, roomName);
         Logger.info(`Created LiveKit room: ${roomName} for call: ${callId}`);

         return {
            roomName: room.name,
            roomSid: room.sid,
            createdAt: room.creationTime,
            metadata: room.metadata,
         };
      } catch (error) {
         // Room might already exist, try to get it
         if (error.message?.includes('already exists')) {
            Logger.info(`Room for call ${callId} already exists, retrieving...`);
            return await this.getRoom(callId);
         }
         Logger.error('Error creating LiveKit room:', error);
         throw error;
      }
   }

   /**
    * Get room information
    * @param {string} callId - Call identifier
    * @returns {object} Room details
    */
   async getRoom(callId) {
      try {
         const roomName = `call_${callId}`;
         const rooms = await this.roomService.listRooms([roomName]);

         if (rooms.length === 0) {
            return null;
         }

         return {
            roomName: rooms[0].name,
            roomSid: rooms[0].sid,
            numParticipants: rooms[0].numParticipants,
            metadata: rooms[0].metadata,
         };
      } catch (error) {
         Logger.error('Error getting LiveKit room:', error);
         return null;
      }
   }

   /**
    * End a room (when call ends)
    * @param {string} callId - Call identifier
    */
   async endRoom(callId) {
      try {
         const roomName = `call_${callId}`;
         await this.roomService.deleteRoom(roomName);

         this.activeRooms.delete(callId);
         Logger.info(`Ended LiveKit room: ${roomName}`);

         return true;
      } catch (error) {
         Logger.error('Error ending LiveKit room:', error);
         return false;
      }
   }

   /**
    * List participants in a room
    * @param {string} callId - Call identifier
    * @returns {array} List of participants
    */
   async listParticipants(callId) {
      try {
         const roomName = `call_${callId}`;
         const participants = await this.roomService.listParticipants(roomName);

         return participants.map((p) => ({
            identity: p.identity,
            name: p.name,
            metadata: p.metadata ? JSON.parse(p.metadata) : {},
            state: p.state,
            joinedAt: p.joinedAt,
         }));
      } catch (error) {
         Logger.error('Error listing room participants:', error);
         return [];
      }
   }

   /**
    * Remove a participant from a room
    * @param {string} callId - Call identifier
    * @param {string} participantIdentity - Participant to remove (userId)
    */
   async removeParticipant(callId, participantIdentity) {
      try {
         const roomName = `call_${callId}`;
         await this.roomService.removeParticipant(roomName, participantIdentity);

         Logger.info(`Removed participant ${participantIdentity} from room ${roomName}`);
         return true;
      } catch (error) {
         Logger.error('Error removing participant:', error);
         return false;
      }
   }

   /**
    * Mute/unmute a participant's track
    * @param {string} callId - Call identifier
    * @param {string} participantIdentity - Participant identifier
    * @param {string} trackType - 'audio' or 'video'
    * @param {boolean} muted - Mute state
    */
   async muteParticipant(callId, participantIdentity, trackType, muted) {
      try {
         const roomName = `call_${callId}`;
         await this.roomService.mutePublishedTrack(roomName, participantIdentity, trackType, muted);

         Logger.info(`${muted ? 'Muted' : 'Unmuted'} ${trackType} for ${participantIdentity}`);
         return true;
      } catch (error) {
         Logger.error('Error muting participant:', error);
         return false;
      }
   }

   /**
    * Get room statistics
    * @param {string} callId - Call identifier
    * @returns {object} Room stats
    */
   async getRoomStats(callId) {
      try {
         const roomName = `call_${callId}`;
         const room = await this.getRoom(callId);
         const participants = await this.listParticipants(callId);

         return {
            roomName,
            numParticipants: participants.length,
            participants: participants,
            metadata: room?.metadata ? JSON.parse(room.metadata) : {},
         };
      } catch (error) {
         Logger.error('Error getting room stats:', error);
         return null;
      }
   }

   /**
    * Initialize call with LiveKit room
    * @param {string} callId - Call identifier
    * @param {string} initiatorId - User who initiated the call
    * @param {array} participants - List of call participants
    * @param {string} callType - 'AUDIO' or 'VIDEO'
    * @param {object} options - Additional options (transcriptionLanguage, etc.)
    * @returns {object} Room details and tokens
    */
   async initializeCall(callId, initiatorId, participants, callType = 'AUDIO', options = {}) {
      try {
         Logger.info(`Initializing LiveKit call: ${callId}`);

         // Create room with transcription enabled
         const room = await this.createRoom(callId, {
            type: callType,
            maxParticipants: participants.length,
            enableTranscription: true, // Enable native LiveKit transcription
            transcriptionLanguage: options.transcriptionLanguage || 'en-US',
            metadata: {
               initiatorId,
               participantCount: participants.length,
            },
         });

         // Generate tokens for all participants
         const tokens = {};
         for (const participant of participants) {
            const token = await this.generateToken(
               room.roomName,
               participant.userId,
               {
                  username: participant.user?.username,
                  displayName: participant.user?.displayName,
                  avatar: participant.user?.avatar,
               },
               {
                  canPublish: true,
                  canSubscribe: true,
                  canPublishData: true,
               },
            );
            tokens[participant.userId] = token;
         }

         // Update call in database with LiveKit info
         await prisma.call.update({
            where: { id: callId },
            data: {
               roomName: room.roomName,
               livekitRoomId: room.roomSid,
               metadata: {
                  livekitEnabled: true,
                  participantCount: participants.length,
                  callType,
               },
            },
         });

         return {
            room,
            tokens,
            wsUrl: this.wsUrl,
         };
      } catch (error) {
         Logger.error('Error initializing LiveKit call:', error);
         throw error;
      }
   }

   /**
    * Handle call end - cleanup room
    * @param {string} callId - Call identifier
    */
   async handleCallEnd(callId) {
      try {
         await this.endRoom(callId);

         // Update database
         await prisma.call.update({
            where: { id: callId },
            data: {
               endedAt: new Date(),
            },
         });

         Logger.info(`Cleaned up LiveKit resources for call: ${callId}`);
         return true;
      } catch (error) {
         Logger.error('Error handling call end:', error);
         return false;
      }
   }

   /**
    * Send data message to participants in a room
    * @param {string} callId - Call identifier
    * @param {object} data - Data to send
    * @param {array} destinationIdentities - Specific participants (optional, null = broadcast to all)
    * @param {string} topic - Data topic/channel (e.g., 'transcription', 'chat')
    */
   async sendDataMessage(callId, data, destinationIdentities = null, topic = 'default') {
      try {
         const roomName = `call_${callId}`;
         const payload = JSON.stringify(data);
         const encoder = new TextEncoder();
         const encodedPayload = encoder.encode(payload);

         // LiveKit Data API: send data to specific participants or broadcast
         await this.roomService.sendData(roomName, encodedPayload, {
            destinationIdentities: destinationIdentities, // null = broadcast to all
            topic: topic,
         });

         Logger.info(`Sent data message to room ${roomName}, topic: ${topic}`);
         return true;
      } catch (error) {
         Logger.error('Error sending data message:', error);
         return false;
      }
   }

   /**
    * Send transcription to all participants in real-time
    * @param {string} callId - Call identifier
    * @param {object} transcription - Transcription data
    */
   async sendTranscription(callId, transcription) {
      try {
         const transcriptionData = {
            type: 'transcription',
            callId,
            transcript: transcription.transcript,
            speakerId: transcription.speakerId,
            speakerName: transcription.speakerName,
            isFinal: transcription.isFinal,
            confidence: transcription.confidence,
            timestamp: transcription.timestamp || new Date().toISOString(),
            segmentId: transcription.segmentId,
            startTime: transcription.startTime,
            endTime: transcription.endTime,
         };

         return await this.sendDataMessage(callId, transcriptionData, null, 'transcription');
      } catch (error) {
         Logger.error('Error sending transcription:', error);
         return false;
      }
   }

   /**
    * Enable/Configure room-level transcription
    * @param {string} callId - Call identifier
    * @param {object} options - Transcription options
    */
   async enableTranscription(callId, options = {}) {
      try {
         const roomName = `call_${callId}`;

         // Update room metadata to indicate transcription is enabled
         const metadata = {
            transcriptionEnabled: true,
            transcriptionLanguage: options.language || 'en-US',
            transcriptionModel: options.model || 'default',
         };

         await this.roomService.updateRoomMetadata(roomName, JSON.stringify(metadata));

         Logger.info(`Enabled transcription for room ${roomName}`);
         return true;
      } catch (error) {
         Logger.error('Error enabling transcription:', error);
         return false;
      }
   }

   /**
    * Health check - verify LiveKit connection
    */
   async healthCheck() {
      try {
         await this.roomService.listRooms();
         return { status: 'healthy', service: 'livekit' };
      } catch (error) {
         Logger.error('LiveKit health check failed:', error);
         return { status: 'unhealthy', service: 'livekit', error: error.message };
      }
   }
}

// Export singleton instance
module.exports = new LiveKitService();
