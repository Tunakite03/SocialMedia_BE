const axios = require('axios');
const prisma = require('../config/database');
const Logger = require('../utils/logger');
const livekitService = require('./livekitService');

/**
 * Transcription Service
 * Handles audio transcription using various providers (OpenAI Whisper, Google STT, etc.)
 */
class TranscriptionService {
   constructor() {
      // Configuration for transcription provider
      this.provider = process.env.TRANSCRIPTION_PROVIDER || 'whisper'; // 'whisper', 'google', 'deepgram'
      this.whisperApiKey = process.env.OPENAI_API_KEY;
      this.whisperApiUrl = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';

      // For custom whisper deployment
      this.customWhisperUrl = process.env.CUSTOM_WHISPER_URL;

      // Transcription settings
      this.language = process.env.TRANSCRIPTION_LANGUAGE || 'en';
      this.model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';

      Logger.info(`Transcription Service initialized with provider: ${this.provider}`);
   }

   /**
    * Transcribe audio buffer using configured provider
    * @param {Buffer} audioBuffer - Audio data
    * @param {object} options - Transcription options
    * @returns {object} Transcription result
    */
   async transcribeAudio(audioBuffer, options = {}) {
      try {
         switch (this.provider) {
            case 'whisper':
               return await this.transcribeWithWhisper(audioBuffer, options);
            case 'google':
               return await this.transcribeWithGoogle(audioBuffer, options);
            case 'deepgram':
               return await this.transcribeWithDeepgram(audioBuffer, options);
            case 'custom':
               return await this.transcribeWithCustom(audioBuffer, options);
            default:
               throw new Error(`Unsupported transcription provider: ${this.provider}`);
         }
      } catch (error) {
         Logger.error('Error transcribing audio:', error);
         throw error;
      }
   }

   /**
    * Transcribe using OpenAI Whisper API
    */
   async transcribeWithWhisper(audioBuffer, options = {}) {
      try {
         const FormData = require('form-data');
         const form = new FormData();

         form.append('file', audioBuffer, {
            filename: 'audio.webm',
            contentType: 'audio/webm',
         });
         form.append('model', options.model || this.model);
         form.append('language', options.language || this.language);
         form.append('response_format', 'verbose_json'); // Get timestamps

         if (options.prompt) {
            form.append('prompt', options.prompt);
         }

         const response = await axios.post(this.whisperApiUrl, form, {
            headers: {
               ...form.getHeaders(),
               Authorization: `Bearer ${this.whisperApiKey}`,
            },
            timeout: 30000,
         });

         return {
            text: response.data.text,
            language: response.data.language,
            duration: response.data.duration,
            segments: response.data.segments || [],
            words: response.data.words || [],
         };
      } catch (error) {
         Logger.error('Whisper transcription error:', error.response?.data || error.message);
         throw error;
      }
   }

   /**
    * Transcribe using custom Whisper deployment
    */
   async transcribeWithCustom(audioBuffer, options = {}) {
      try {
         if (!this.customWhisperUrl) {
            throw new Error('CUSTOM_WHISPER_URL not configured');
         }

         const FormData = require('form-data');
         const form = new FormData();

         form.append('audio', audioBuffer, {
            filename: 'audio.webm',
            contentType: 'audio/webm',
         });
         form.append('language', options.language || this.language);

         const response = await axios.post(this.customWhisperUrl, form, {
            headers: form.getHeaders(),
            timeout: 30000,
         });

         return {
            text: response.data.text || response.data.transcript,
            language: response.data.language || this.language,
            segments: response.data.segments || [],
            words: response.data.words || [],
         };
      } catch (error) {
         Logger.error('Custom Whisper transcription error:', error.response?.data || error.message);
         throw error;
      }
   }

   /**
    * Transcribe using Google Cloud Speech-to-Text
    */
   async transcribeWithGoogle(audioBuffer, options = {}) {
      // TODO: Implement Google STT
      throw new Error('Google STT not yet implemented');
   }

   /**
    * Transcribe using Deepgram
    */
   async transcribeWithDeepgram(audioBuffer, options = {}) {
      // TODO: Implement Deepgram
      throw new Error('Deepgram not yet implemented');
   }

   /**
    * Process LiveKit native transcription (no audio transcription needed)
    * @param {string} callId - Call identifier
    * @param {string} participantIdentity - Participant identity from LiveKit
    * @param {object} transcriptionData - LiveKit transcription data
    */
   async processLivekitTranscription(callId, participantIdentity, transcriptionData) {
      try {
         Logger.info(`Processing LiveKit transcription for call ${callId}`);

         if (!transcriptionData.text || transcriptionData.text.trim() === '') {
            Logger.debug('Empty transcription text, skipping...');
            return null;
         }

         // Get speaker info - participantIdentity is the userId
         const speaker = await prisma.user.findUnique({
            where: { id: participantIdentity },
            select: {
               id: true,
               username: true,
               displayName: true,
               avatar: true,
            },
         });

         if (!speaker) {
            Logger.warn(`Speaker not found for identity: ${participantIdentity}`);
            // Continue anyway with unknown speaker
         }

         const segmentId = transcriptionData.segmentId || `${callId}_${Date.now()}`;
         const isFinal = transcriptionData.isFinal !== false;

         // Analyze sentiment for final transcripts
         let sentimentResult = null;
         if (isFinal && transcriptionData.text.trim().length > 0) {
            try {
               const sentimentService = require('./sentimentService');
               sentimentResult = await sentimentService.analyzeSentiment(
                  transcriptionData.text,
                  speaker?.id || participantIdentity,
                  callId,
                  'call_transcript'
               );
               Logger.info(`Sentiment analyzed: ${sentimentResult.emotion} (${Math.round(sentimentResult.confidence * 100)}%)`);
            } catch (error) {
               Logger.warn('Failed to analyze sentiment:', error.message);
               // Continue without sentiment - not critical
            }
         }

         // Save transcription to database
         const transcript = await prisma.callTranscript.create({
            data: {
               callId,
               speakerId: speaker?.id || participantIdentity,
               transcript: transcriptionData.text,
               language: transcriptionData.language || 'en-US',
               confidence: transcriptionData.confidence,
               isFinal,
               segmentId,
               startTime: transcriptionData.startTime,
               endTime: transcriptionData.endTime,
               words: transcriptionData.segments ? JSON.stringify(transcriptionData.segments) : null,
               // Save sentiment if available
               sentiment: sentimentResult ? sentimentResult.emotion : null,
            },
         });

         const broadcastData = {
            id: transcript.id,
            transcript: transcriptionData.text,
            speakerId: speaker?.id || participantIdentity,
            speakerName: speaker?.displayName || speaker?.username || 'Unknown',
            speakerAvatar: speaker?.avatar,
            isFinal,
            confidence: transcriptionData.confidence,
            timestamp: transcript.timestamp,
            segmentId,
            startTime: transcriptionData.startTime,
            endTime: transcriptionData.endTime,
            language: transcriptionData.language,
            // Include sentiment data if available
            sentiment: sentimentResult ? {
               emotion: sentimentResult.emotion,
               emotionClass: sentimentResult.emotionClass,
               confidence: sentimentResult.confidence,
               scores: sentimentResult.scores,
            } : undefined,
         };

         // Broadcast via LiveKit data channel
         await livekitService.sendTranscription(callId, broadcastData);

         // Also broadcast via WebSocket for backup
         try {
            const { broadcastTranscription } = require('../sockets/socketUtils');
            const io = global.io;
            if (io && broadcastTranscription) {
               await broadcastTranscription(io, callId, broadcastData);
            }
         } catch (socketError) {
            Logger.warn('Could not broadcast via WebSocket:', socketError.message);
         }

         Logger.info(`LiveKit transcription saved and broadcast: ${transcriptionData.text.substring(0, 50)}...`);

         return transcript;
      } catch (error) {
         Logger.error('Error processing LiveKit transcription:', error);
         throw error;
      }
   }

   /**
    * Process audio chunk and send transcription to call participants
    * @param {string} callId - Call identifier
    * @param {string} speakerId - User ID of speaker
    * @param {Buffer} audioBuffer - Audio chunk data
    * @param {object} options - Processing options
    */
   async processAudioChunk(callId, speakerId, audioBuffer, options = {}) {
      try {
         Logger.info(`Processing audio chunk for call ${callId}, speaker ${speakerId}`);

         // Transcribe audio
         const transcriptionResult = await this.transcribeAudio(audioBuffer, {
            language: options.language,
            prompt: options.prompt,
         });

         if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
            Logger.debug('Empty transcription, skipping...');
            return null;
         }

         // Get speaker info
         const speaker = await prisma.user.findUnique({
            where: { id: speakerId },
            select: {
               id: true,
               username: true,
               displayName: true,
            },
         });

         const segmentId = options.segmentId || `${callId}_${Date.now()}`;
         const isFinal = options.isFinal !== false; // Default to true

         // Save transcription to database
         const transcript = await prisma.callTranscript.create({
            data: {
               callId,
               speakerId,
               transcript: transcriptionResult.text,
               language: transcriptionResult.language || options.language,
               confidence: transcriptionResult.confidence || null,
               isFinal,
               segmentId,
               startTime: options.startTime,
               endTime: options.endTime,
               words: transcriptionResult.words || null,
            },
         });

         const transcriptionData = {
            id: transcript.id,
            transcript: transcriptionResult.text,
            speakerId,
            speakerName: speaker?.displayName || speaker?.username,
            isFinal,
            confidence: transcriptionResult.confidence,
            timestamp: transcript.timestamp,
            segmentId,
            startTime: options.startTime,
            endTime: options.endTime,
            language: transcriptionResult.language,
         };

         // Send transcription to all participants via LiveKit
         await livekitService.sendTranscription(callId, transcriptionData);

         // Also broadcast via WebSocket for clients not using LiveKit data channels
         try {
            const { broadcastTranscription } = require('../sockets/socketUtils');
            const io = global.io; // Socket.io instance should be stored globally
            if (io && broadcastTranscription) {
               await broadcastTranscription(io, callId, transcriptionData);
            }
         } catch (socketError) {
            Logger.warn('Could not broadcast via WebSocket, continuing...', socketError.message);
         }

         Logger.info(`Sent transcription for call ${callId}: ${transcriptionResult.text.substring(0, 50)}...`);

         return transcript;
      } catch (error) {
         Logger.error('Error processing audio chunk:', error);
         throw error;
      }
   }

   /**
    * Get transcriptions for a call
    * @param {string} callId - Call identifier
    * @param {object} filters - Query filters
    */
   async getCallTranscriptions(callId, filters = {}) {
      try {
         const where = {
            callId,
            ...(filters.isFinal !== undefined && { isFinal: filters.isFinal }),
            ...(filters.speakerId && { speakerId: filters.speakerId }),
         };

         const transcripts = await prisma.callTranscript.findMany({
            where,
            include: {
               speaker: {
                  select: {
                     id: true,
                     username: true,
                     displayName: true,
                     avatar: true,
                  },
               },
            },
            orderBy: {
               timestamp: 'asc',
            },
            skip: filters.skip || 0,
            take: filters.take || 100,
         });

         return transcripts;
      } catch (error) {
         Logger.error('Error getting call transcriptions:', error);
         throw error;
      }
   }

   /**
    * Generate call summary from transcriptions
    * @param {string} callId - Call identifier
    */
   async generateCallSummary(callId) {
      try {
         const transcripts = await this.getCallTranscriptions(callId, { isFinal: true });

         if (transcripts.length === 0) {
            return { summary: 'No transcriptions available', wordCount: 0 };
         }

         // Combine all transcripts
         const fullTranscript = transcripts
            .map((t) => `${t.speaker?.displayName || 'Unknown'}: ${t.transcript}`)
            .join('\n');

         // Calculate statistics
         const wordCount = fullTranscript.split(/\s+/).length;
         const speakerCount = new Set(transcripts.map((t) => t.speakerId)).size;

         // TODO: Use AI to generate actual summary
         // For now, return basic info
         return {
            fullTranscript,
            wordCount,
            speakerCount,
            segmentCount: transcripts.length,
            duration: transcripts[transcripts.length - 1].endTime - transcripts[0].startTime,
            summary: `Call with ${speakerCount} participants, ${transcripts.length} segments, ${wordCount} words.`,
         };
      } catch (error) {
         Logger.error('Error generating call summary:', error);
         throw error;
      }
   }

   /**
    * Enable transcription for a call
    * @param {string} callId - Call identifier
    * @param {object} options - Transcription options
    */
   async enableCallTranscription(callId, options = {}) {
      try {
         // Update call metadata
         await prisma.call.update({
            where: { id: callId },
            data: {
               metadata: {
                  transcriptionEnabled: true,
                  transcriptionLanguage: options.language || this.language,
                  transcriptionStartedAt: new Date().toISOString(),
               },
            },
         });

         // Enable transcription in LiveKit room
         await livekitService.enableTranscription(callId, options);

         Logger.info(`Enabled transcription for call ${callId}`);
         return true;
      } catch (error) {
         Logger.error('Error enabling call transcription:', error);
         throw error;
      }
   }
}

module.exports = new TranscriptionService();
