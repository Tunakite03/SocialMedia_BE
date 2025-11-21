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
} = require('../controllers/callController');

// Call management routes
router.post('/initiate', authenticate, initiateCall);
router.post('/:callId/answer', authenticate, answerCall);
router.post('/:callId/reject', authenticate, rejectCall);
router.post('/:callId/end', authenticate, endCall);

// WebRTC specific routes
router.get('/ice-servers', authenticate, getIceServers);
router.post('/:callId/join', authenticate, joinCallRoom);
router.post('/:callId/quality', authenticate, updateQualityMetrics);
router.post('/:callId/media', authenticate, updateMediaState);
router.get('/:callId/stats', authenticate, getCallStats);

// Call history and transcripts
router.get('/history', authenticate, getCallHistory);
router.post('/:callId/transcript', authenticate, saveTranscript);

module.exports = router;
