const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/authMiddleware');
const { uploadMiddleware } = require('../middlewares/uploadMiddleware');
const {
   getOrCreateDirectConversation,
   createGroupConversation,
   getConversations,
   sendMessage,
   getMessages,
   reactToMessage,
   uploadAttachment,
   getConversation,
   markConversationAsRead,
   getUnreadMessagesCount,
   getAllUnreadCounts,
} = require('../controllers/messageController');

// Conversation routes
router.get('/', authenticate, getConversations);
router.get('/:conversationId', authenticate, getConversation);
router.post('/group', authenticate, createGroupConversation);
router.get('/direct/:userId', authenticate, getOrCreateDirectConversation);

// Message routes
router.get('/:conversationId/messages', authenticate, getMessages);
router.post('/:conversationId/messages', authenticate, sendMessage);

// Message interaction routes
router.post('/messages/:messageId/react', authenticate, reactToMessage);
router.post('/messages/:messageId/attachments', authenticate, uploadMiddleware.single('file'), uploadAttachment);

// Read status routes
router.post('/:conversationId/read', authenticate, markConversationAsRead);
router.get('/:conversationId/unread-count', authenticate, getUnreadMessagesCount);
router.get('/unread-counts', authenticate, getAllUnreadCounts);

module.exports = router;
