const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/authMiddleware');

// Placeholder routes - to be implemented
router.get('/', authenticate, (req, res) => {
   res.json({
      success: true,
      message: 'Notifications feature coming soon',
      data: { notifications: [] },
   });
});

router.put('/:id/read', authenticate, (req, res) => {
   res.json({
      success: true,
      message: 'Mark notification as read feature coming soon',
   });
});

module.exports = router;
