const prisma = require('../config/database');
const Logger = require('../utils/logger');
const transcriptionService = require('../services/transcriptionService');
const { WebhookReceiver } = require('livekit-server-sdk');

/**
 * LiveKit Webhook Handler
 * Handles webhooks from LiveKit for various events (transcription, participant joined/left, etc.)
 */
class LiveKitWebhookHandler {
   constructor() {
      this.apiKey = process.env.LIVEKIT_API_KEY;
      this.apiSecret = process.env.LIVEKIT_API_SECRET;

      // Initialize webhook receiver for signature verification
      this.webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret);
   }

   /**
    * Verify webhook signature and parse event
    * @param {string} body - Raw request body
    * @param {string} authHeader - Authorization header
    */
   async verifyAndParseWebhook(body, authHeader) {
      try {
         // LiveKit webhook verification
         const event = this.webhookReceiver.receive(body, authHeader);
         return event;
      } catch (error) {
         Logger.error('Webhook verification failed:', error);
         throw new Error('Invalid webhook signature');
      }
   }

   /**
    * Handle incoming webhook event
    * @param {object} event - Parsed webhook event
    */
   async handleWebhookEvent(event) {
      try {
         Logger.info(`\n========== LIVEKIT WEBHOOK ==========`);
         Logger.info(`Event Type: ${event.event}`);
         Logger.info(`Event Data:`, JSON.stringify(event, null, 2));
         Logger.info(`=====================================\n`);

         switch (event.event) {
            case 'room_started':
               await this.handleRoomStarted(event);
               break;
            case 'room_finished':
               await this.handleRoomFinished(event);
               break;
            case 'participant_joined':
               await this.handleParticipantJoined(event);
               break;
            case 'participant_left':
               await this.handleParticipantLeft(event);
               break;
            case 'track_published':
               await this.handleTrackPublished(event);
               break;
            case 'track_unpublished':
               await this.handleTrackUnpublished(event);
               break;
            case 'transcription_received':
               await this.handleTranscriptionReceived(event);
               break;
            default:
               Logger.debug(`Unhandled webhook event: ${event.event}`);
         }

         return { success: true };
      } catch (error) {
         Logger.error('Error handling webhook event:', error);
         throw error;
      }
   }

   /**
    * Handle room started event
    */
   async handleRoomStarted(event) {
      try {
         const roomName = event.room?.name;
         if (!roomName) return;

         // Extract call ID from room name (format: call_{callId})
         const callId = roomName.replace('call_', '');

         await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'ONGOING',
               startedAt: new Date(),
            },
         });

         Logger.info(`Room started: ${roomName}, call: ${callId}`);
      } catch (error) {
         Logger.error('Error handling room started:', error);
      }
   }

   /**
    * Handle room finished event
    */
   async handleRoomFinished(event) {
      try {
         const roomName = event.room?.name;
         if (!roomName) return;

         const callId = roomName.replace('call_', '');

         await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'COMPLETED',
               endedAt: new Date(),
            },
         });

         Logger.info(`Room finished: ${roomName}, call: ${callId}`);
      } catch (error) {
         Logger.error('Error handling room finished:', error);
      }
   }

   /**
    * Handle participant joined event
    */
   async handleParticipantJoined(event) {
      try {
         const roomName = event.room?.name;
         const participant = event.participant;

         if (!roomName || !participant) return;

         const callId = roomName.replace('call_', '');
         const userId = participant.identity;

         await prisma.callParticipant.updateMany({
            where: {
               callId,
               userId,
            },
            data: {
               status: 'JOINED',
               joinedAt: new Date(),
            },
         });

         Logger.info(`Participant ${userId} joined call ${callId}`);
      } catch (error) {
         Logger.error('Error handling participant joined:', error);
      }
   }

   /**
    * Handle participant left event
    */
   async handleParticipantLeft(event) {
      try {
         const roomName = event.room?.name;
         const participant = event.participant;

         if (!roomName || !participant) return;

         const callId = roomName.replace('call_', '');
         const userId = participant.identity;

         await prisma.callParticipant.updateMany({
            where: {
               callId,
               userId,
            },
            data: {
               status: 'LEFT',
               leftAt: new Date(),
            },
         });

         Logger.info(`Participant ${userId} left call ${callId}`);
      } catch (error) {
         Logger.error('Error handling participant left:', error);
      }
   }

   /**
    * Handle track published event (audio/video track)
    */
   async handleTrackPublished(event) {
      try {
         const roomName = event.room?.name;
         const participant = event.participant;
         const track = event.track;

         if (!roomName || !participant || !track) return;

         Logger.info(`Track published in ${roomName}: ${track.type} by ${participant.identity}`);
      } catch (error) {
         Logger.error('Error handling track published:', error);
      }
   }

   /**
    * Handle track unpublished event
    */
   async handleTrackUnpublished(event) {
      try {
         const roomName = event.room?.name;
         const participant = event.participant;
         const track = event.track;

         if (!roomName || !participant || !track) return;

         Logger.info(`Track unpublished in ${roomName}: ${track.type} by ${participant.identity}`);
      } catch (error) {
         Logger.error('Error handling track unpublished:', error);
      }
   }

   /**
    * Handle transcription received event
    * This is called when LiveKit's native transcription produces results
    */
   async handleTranscriptionReceived(event) {
      try {
         Logger.info(`\n ========== TRANSCRIPTION EVENT ==========`);
         Logger.info(`Raw Event:`, JSON.stringify(event, null, 2));

         const roomName = event.room?.name;
         const transcription = event.transcription;

         if (!roomName || !transcription) {
            Logger.error('Transcription event missing room or transcription data');
            Logger.error('Room:', roomName);
            Logger.error('Transcription:', transcription);
            return;
         }

         const callId = roomName.replace('call_', '');

         // Get participant info
         const participantIdentity = transcription.participantIdentity || transcription.participantSid;

         Logger.info(`LiveKit transcription received for call ${callId}:`);
         Logger.info(`   Text: "${transcription.text}"`);
         Logger.info(`   Is Final: ${transcription.final}`);
         Logger.info(`   Speaker: ${participantIdentity}`);
         Logger.info(`   Language: ${transcription.language}`);
         Logger.info(`   Confidence: ${transcription.confidence}`);

         // Process and save transcription using LiveKit native data
         await transcriptionService.processLivekitTranscription(callId, participantIdentity, {
            text: transcription.text,
            language: transcription.language || 'en-US',
            isFinal: transcription.final || false,
            confidence: transcription.confidence,
            segmentId: transcription.id || transcription.segmentId,
            startTime: transcription.startTime,
            endTime: transcription.endTime,
            segments: transcription.segments,
         });

         Logger.info(`Successfully processed and broadcast transcription for call ${callId}`);
         Logger.info(`==========================================\n`);
      } catch (error) {
         Logger.error('Error handling transcription received:', error);
         Logger.error('Stack:', error.stack);
      }
   }
}

module.exports = new LiveKitWebhookHandler();
