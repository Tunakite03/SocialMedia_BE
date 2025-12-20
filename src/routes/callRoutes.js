const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/authMiddleware');
const {
   initiateCall,
   answerCall,
   endCall,
   rejectCall,
   getCallHistory,
   saveTranscript,
   getIceServers,
   joinCallRoom,
   updateQualityMetrics,
   updateMediaState,
   getCallStats,
   markCallAsFailed,
   getActiveTimeouts,
   getCallSession,
} = require('../controllers/callController');

// Call management routes
router.post('/initiate', authenticate, initiateCall);
router.post('/:callId/answer', authenticate, answerCall);
router.post('/:callId/reject', authenticate, rejectCall);
router.post('/:callId/end', authenticate, endCall);
router.post('/:callId/fail', authenticate, markCallAsFailed);

// WebRTC specific routes
router.get('/ice-servers', authenticate, getIceServers);
router.post('/:callId/join', authenticate, joinCallRoom);
router.post('/:callId/quality', authenticate, updateQualityMetrics);
router.post('/:callId/media', authenticate, updateMediaState);
router.get('/:callId/stats', authenticate, getCallStats);

// Call history and transcripts
router.get('/history', authenticate, getCallHistory);
router.post('/:callId/transcript', authenticate, saveTranscript);

// Debug routes (consider protecting these in production)
if (process.env.NODE_ENV !== 'production') {
   router.get('/debug/timeouts', authenticate, getActiveTimeouts);
   router.get('/debug/session/:callId', authenticate, getCallSession);
}

module.exports = router;
