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
} = require('../controllers/callController');

// Call management routes
router.post('/initiate', authenticate, initiateCall);
router.post('/:callId/answer', authenticate, answerCall);
router.post('/:callId/reject', authenticate, rejectCall);
router.post('/:callId/end', authenticate, endCall);

// Call history and transcripts
router.get('/history', authenticate, getCallHistory);
router.post('/:callId/transcript', authenticate, saveTranscript);

module.exports = router;
