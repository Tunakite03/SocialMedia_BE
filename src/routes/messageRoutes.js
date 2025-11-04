const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/authMiddleware');

// Placeholder routes - to be implemented
router.get('/', authenticate, (req, res) => {
   res.json({
      success: true,
      message: 'Messages feature coming soon',
      data: { messages: [] },
   });
});

router.post('/', authenticate, (req, res) => {
   res.json({
      success: true,
      message: 'Send message feature coming soon',
   });
});

module.exports = router;
