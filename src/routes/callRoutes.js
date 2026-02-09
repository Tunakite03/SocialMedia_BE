const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for audio upload
const upload = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
   },
   fileFilter: (req, file, cb) => {
      // Accept audio files
      if (file.mimetype.startsWith('audio/')) {
         cb(null, true);
      } else {
         cb(new Error('Only audio files are allowed'));
      }
   },
});

const { authenticate } = require('../middlewares/authMiddleware');
const {
   initiateCall,
   answerCall,
   endCall,
   rejectCall,
   getCallHistory,
   saveTranscript,
   // LiveKit endpoints
   getLivekitToken,
   getLivekitRoomInfo,
   livekitHealthCheck,
   // Transcription endpoints
   enableTranscription,
   processAudioTranscription,
   getCallTranscriptions,
   getCallSummary,
   handleLivekitWebhook,
   // Deprecated WebRTC endpoints
   getIceServers,
   joinCallRoom,
   updateQualityMetrics,
   updateMediaState,
   getCallStats,
   markCallAsFailed,
   getActiveTimeouts,
   getCallSession,
} = require('../controllers/callController');

// ============================================================================
// Core Call Management Routes
// ============================================================================
router.post('/initiate', authenticate, initiateCall);
router.post('/:callId/answer', authenticate, answerCall);
router.post('/:callId/reject', authenticate, rejectCall);
router.post('/:callId/end', authenticate, endCall);
router.post('/:callId/fail', authenticate, markCallAsFailed);

// Call history and transcripts
router.get('/history', authenticate, getCallHistory);
router.post('/:callId/transcript', authenticate, saveTranscript);

// ============================================================================
// LiveKit Routes (NEW - Primary method for video/audio calls)
// ============================================================================
router.get('/:callId/livekit/token', authenticate, getLivekitToken);
router.get('/:callId/livekit/room', authenticate, getLivekitRoomInfo);
router.get('/livekit/health', authenticate, livekitHealthCheck);

// ============================================================================
// Transcription Routes
// ============================================================================
router.post('/:callId/transcription/enable', authenticate, enableTranscription);
router.post('/:callId/transcription/process', authenticate, upload.single('audio'), processAudioTranscription);
router.get('/:callId/transcriptions', authenticate, getCallTranscriptions);
router.get('/:callId/summary', authenticate, getCallSummary);

// Webhook endpoint (no authentication - verified by signature)
router.post('/livekit/webhook', handleLivekitWebhook);

// ============================================================================
// Legacy WebRTC Routes (DEPRECATED - Keeping for backward compatibility)
// TODO: Remove after complete frontend migration to LiveKit
// ============================================================================
router.get('/ice-servers', authenticate, getIceServers);
router.post('/:callId/join', authenticate, joinCallRoom);
router.post('/:callId/quality', authenticate, updateQualityMetrics);
router.post('/:callId/media', authenticate, updateMediaState);
router.get('/:callId/stats', authenticate, getCallStats);

// ============================================================================
// Debug Routes (Development only)
// ============================================================================
if (process.env.NODE_ENV !== 'production') {
   router.get('/debug/timeouts', authenticate, getActiveTimeouts);
   router.get('/debug/session/:callId', authenticate, getCallSession);
}

module.exports = router;
