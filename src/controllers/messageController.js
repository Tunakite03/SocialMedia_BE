const prisma = require('../config/database');
const { successResponse, paginatedResponse } = require('../utils/responseFormatter');
const { validatePaginationParams, createPaginationConfig, processPaginatedResults } = require('../utils/pagination');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');

/**
 * Get or create direct conversation between two users
 */
const getOrCreateDirectConversation = async (req, res, next) => {
   try {
      const currentUserId = req.user.id;
      const { userId } = req.params;

      if (currentUserId === userId) {
         throw new ValidationError('Cannot create conversation with yourself');
      }

      // Check if conversation already exists
      let conversation = await prisma.conversation.findFirst({
         where: {
            type: 'DIRECT',
            participants: {
               every: {
                  userId: {
                     in: [currentUserId, userId],
                  },
               },
            },
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isOnline: true,
                     },
                  },
               },
            },
            messages: {
               take: 1,
               orderBy: { createdAt: 'desc' },
               include: {
                  sender: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
            _count: {
               select: {
                  messages: true,
               },
            },
         },
      });

      // Create new conversation if doesn't exist
      if (!conversation) {
         // First verify that both users exist
         const users = await prisma.user.findMany({
            where: {
               id: {
                  in: [currentUserId, userId],
               },
            },
            select: {
               id: true,
            },
         });

         if (users.length !== 2) {
            const missingUserIds = [currentUserId, userId].filter((id) => !users.some((user) => user.id === id));
            throw new NotFoundError(`User(s) not found: ${missingUserIds.join(', ')}`);
         }

         conversation = await prisma.conversation.create({
            data: {
               type: 'DIRECT',
               participants: {
                  create: [
                     { userId: currentUserId, role: 'MEMBER' },
                     { userId: userId, role: 'MEMBER' },
                  ],
               },
            },
            include: {
               participants: {
                  include: {
                     user: {
                        select: {
                           id: true,
                           username: true,
                           displayName: true,
                           avatar: true,
                           isOnline: true,
                        },
                     },
                  },
               },
               messages: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  include: {
                     sender: {
                        select: {
                           id: true,
                           username: true,
                           displayName: true,
                        },
                     },
                  },
               },
               _count: {
                  select: {
                     messages: true,
                  },
               },
            },
         });
      }
      // Transform messages array to lastMessage
      const { messages, ...conversationData } = conversation;
      const conversationWithLastMessage = {
         ...conversationData,
         lastMessage: messages.length > 0 ? messages[0] : null,
      };
      return successResponse(res, { conversation: conversationWithLastMessage }, 'Conversation retrieved successfully');
   } catch (error) {
      console.error('Get/Create direct conversation error:', error);
      next(error);
   }
};

const getConversation = async (req, res, next) => {
   try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      // Check if conversation already exists and user is participant
      let conversation = await prisma.conversation.findFirst({
         where: {
            id: conversationId,
            participants: {
               some: {
                  userId: userId,
                  leftAt: null, // Only active conversations
               },
            },
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isOnline: true,
                     },
                  },
               },
            },
            messages: {
               take: 1,
               orderBy: { createdAt: 'desc' },
               include: {
                  sender: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
            _count: {
               select: {
                  messages: true,
               },
            },
         },
      });
      if (!conversation) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      // Get unread count for this conversation
      const unreadCount = await getUnreadCount(conversation.id, userId);

      // Transform messages array to lastMessage
      const { messages, ...conversationData } = conversation;
      const conversationWithLastMessage = {
         ...conversationData,
         _count: {
            messages: conversation._count.messages,
            unreadMessages: unreadCount,
         },
         lastMessage: messages.length > 0 ? messages[0] : null,
      };

      return successResponse(res, { conversation: conversationWithLastMessage }, 'Conversation retrieved successfully');
   } catch (error) {
      console.error('Get conversation error:', error);
      next(error);
   }
};

/**
 * Create group conversation
 */
const createGroupConversation = async (req, res, next) => {
   try {
      const currentUserId = req.user.id;
      const { title, participantIds = [] } = req.body;

      if (!title?.trim()) {
         throw new ValidationError('Group conversation title is required');
      }

      // Verify all users exist
      const allUserIds = [currentUserId, ...participantIds];
      const users = await prisma.user.findMany({
         where: {
            id: {
               in: allUserIds,
            },
         },
         select: {
            id: true,
         },
      });

      if (users.length !== allUserIds.length) {
         const missingUserIds = allUserIds.filter((id) => !users.some((user) => user.id === id));
         throw new NotFoundError(`User(s) not found: ${missingUserIds.join(', ')}`);
      }

      // Add current user as admin
      const participants = [
         { userId: currentUserId, role: 'ADMIN' },
         ...participantIds.map((id) => ({ userId: id, role: 'MEMBER' })),
      ];

      const conversation = await prisma.conversation.create({
         data: {
            type: 'GROUP',
            title: title.trim(),
            participants: {
               create: participants,
            },
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isOnline: true,
                     },
                  },
               },
            },
         },
      });

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         // Notify all participants
         participants.forEach((participant) => {
            io.to(`user_${participant.userId}`).emit('conversation:new', conversation);
         });
      }

      return successResponse(res, { conversation }, 'Group conversation created successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Create group conversation error:', error);
      next(error);
   }
};

/**
 * Get user's conversations
 */
const getConversations = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const { ...paginationParams } = req.query;

      const validatedParams = validatePaginationParams(paginationParams);
      const paginationConfig = createPaginationConfig(validatedParams);

      const conversations = await prisma.conversation.findMany({
         where: {
            participants: {
               some: {
                  userId: userId,
                  leftAt: null, // Only active conversations
               },
            },
            ...paginationConfig.where,
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isOnline: true,
                     },
                  },
               },
            },
            messages: {
               take: 1,
               orderBy: { createdAt: 'desc' },
               include: {
                  sender: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
                  readReceipts: {
                     select: {
                        userId: true,
                        readAt: true,
                     },
                  },
               },
            },
            _count: {
               select: {
                  messages: true,
               },
            },
         },
         orderBy: paginationConfig.orderBy || { updatedAt: 'desc' },
         take: paginationConfig.take,
         skip: paginationConfig.skip,
         cursor: paginationConfig.cursor,
      });

      // Transform conversations with additional info
      const transformedConversations = await Promise.all(
         conversations.map(async (conversation) => {
            const { messages, ...conversationData } = conversation;

            // Get unread count for this conversation
            const unreadCount = await getUnreadCount(conversation.id, userId);

            // Get current user's participant info
            const currentParticipant = conversation.participants.find((p) => p.userId === userId);

            // Process last message
            const lastMessage =
               messages.length > 0
                  ? {
                       ...messages[0],
                       isReadByCurrentUser: messages[0].readReceipts.some((receipt) => receipt.userId === userId),
                       readCount: messages[0].readReceipts.length,
                    }
                  : null;

            return {
               ...conversationData,
               _count: {
                  messages: conversation._count.messages,
                  unreadMessages: unreadCount,
               },
               lastMessage,
               lastReadMessageId: currentParticipant?.lastReadMessageId,
               lastReadAt: currentParticipant?.lastReadAt,
               // For direct conversations, get the other participant info
               otherParticipant:
                  conversation.type === 'DIRECT'
                     ? conversation.participants.find((p) => p.userId !== userId)?.user
                     : null,
            };
         })
      );

      const { items, pagination } = processPaginatedResults(transformedConversations, paginationConfig);

      return paginatedResponse(res, { conversations: items }, pagination);
   } catch (error) {
      console.error('Get conversations error:', error);
      next(error);
   }
};

/**
 * Send message to conversation
 */
const sendMessage = async (req, res, next) => {
   try {
      const { conversationId } = req.params;
      const { content, replyToId } = req.body;
      const senderId = req.user.id;

      if (!content?.trim()) {
         throw new ValidationError('Message content is required');
      }

      // Verify user is participant of conversation
      const conversation = await prisma.conversation.findFirst({
         where: {
            id: conversationId,
            participants: {
               some: { userId: senderId },
            },
         },
      });

      if (!conversation) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      // Verify reply message exists in same conversation if replying
      if (replyToId) {
         const replyMessage = await prisma.message.findFirst({
            where: {
               id: replyToId,
               conversationId: conversationId,
            },
         });

         if (!replyMessage) {
            throw new ValidationError('Reply message not found in this conversation');
         }
      }

      // Create message
      const message = await prisma.message.create({
         data: {
            content: content.trim(),
            conversationId,
            senderId,
            parentId: replyToId || null,
         },
         include: {
            sender: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            parent: replyToId
               ? {
                    include: {
                       sender: {
                          select: {
                             id: true,
                             username: true,
                             displayName: true,
                          },
                       },
                    },
                 }
               : false,
            attachments: true,
            reactions: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
         },
      });

      // Update conversation's updatedAt
      await prisma.conversation.update({
         where: { id: conversationId },
         data: { updatedAt: new Date() },
      });

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${conversationId}`).emit('message:new', message);
      }

      return successResponse(res, { message }, 'Message sent successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Send message error:', error);
      next(error);
   }
};

/**
 * Get messages in conversation
 */
const getMessages = async (req, res, next) => {
   try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      const { ...paginationParams } = req.query;

      // Verify user is participant of conversation
      const conversation = await prisma.conversation.findFirst({
         where: {
            id: conversationId,
            participants: {
               some: { userId },
            },
         },
         include: {
            participants: {
               select: {
                  userId: true,
                  lastReadMessageId: true,
                  lastReadAt: true,
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
         },
      });

      if (!conversation) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      const validatedParams = validatePaginationParams(paginationParams);
      const paginationConfig = createPaginationConfig(validatedParams);

      const messages = await prisma.message.findMany({
         where: {
            conversationId,
            ...paginationConfig.where,
         },
         include: {
            sender: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            parent: {
               include: {
                  sender: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
            attachments: true,
            reactions: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
            readReceipts: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                     },
                  },
               },
            },
         },
         orderBy: paginationConfig.orderBy || { createdAt: 'desc' },
         take: paginationConfig.take,
         skip: paginationConfig.skip,
         cursor: paginationConfig.cursor,
      });

      // Add read status information to each message
      const messagesWithReadStatus = messages.map((message) => {
         // Check if current user has read this message
         const currentUserReadReceipt = message.readReceipts.find((receipt) => receipt.userId === userId);
         const isReadByCurrentUser = !!currentUserReadReceipt;

         // Get read by info (exclude current user for group chats)
         const readBy = message.readReceipts
            .filter((receipt) => receipt.userId !== userId)
            .map((receipt) => ({
               user: receipt.user,
               readAt: receipt.readAt,
            }));

         return {
            ...message,
            isReadByCurrentUser,
            readBy,
            readCount: message.readReceipts.length,
         };
      });

      const { items, pagination } = processPaginatedResults(messagesWithReadStatus, paginationConfig);

      // Get unread count for this conversation
      // const unreadCount = await getUnreadCount(conversationId, userId);

      // Get current user's read status
      // const currentParticipant = conversation.participants.find((p) => p.userId === userId);

      return paginatedResponse(
         res,
         {
            messages: items,
            // lastReadMessageId: currentParticipant?.lastReadMessageId,
            // lastReadAt: currentParticipant?.lastReadAt,
         },
         pagination
      );
   } catch (error) {
      console.error('Get messages error:', error);
      next(error);
   }
};

/**
 * React to message
 */
const reactToMessage = async (req, res, next) => {
   try {
      const { messageId } = req.params;
      const { type } = req.body;
      const userId = req.user.id;

      // Validate reaction type
      const validReactionTypes = ['LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW'];
      if (!type || !validReactionTypes.includes(type.toUpperCase())) {
         throw new ValidationError(`Invalid reaction type. Must be one of: ${validReactionTypes.join(', ')}`);
      }

      const reactionType = type.toUpperCase();

      // Verify message exists and user has access
      const message = await prisma.message.findFirst({
         where: {
            id: messageId,
            conversation: {
               participants: {
                  some: { userId },
               },
            },
         },
         include: {
            conversation: {
               select: { id: true },
            },
         },
      });

      if (!message) {
         throw new NotFoundError('Message not found or access denied');
      }

      // Check if user already reacted with the same type
      const existingReaction = await prisma.messageReaction.findFirst({
         where: {
            messageId,
            userId,
            type: reactionType,
         },
      });

      let reaction;
      if (existingReaction) {
         // Remove reaction if same type (toggle off)
         await prisma.messageReaction.delete({
            where: { id: existingReaction.id },
         });
         reaction = null;
      } else {
         // Remove any existing reaction from this user for this message
         await prisma.messageReaction.deleteMany({
            where: {
               messageId,
               userId,
            },
         });

         // Create new reaction
         reaction = await prisma.messageReaction.create({
            data: {
               messageId,
               userId,
               type: reactionType,
            },
            include: {
               user: {
                  select: {
                     id: true,
                     username: true,
                     displayName: true,
                  },
               },
            },
         });
      }

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${message.conversation.id}`).emit('message:reaction', {
            messageId,
            reaction,
            action: reaction ? 'added' : 'removed',
         });
      }

      return successResponse(
         res,
         { reaction },
         reaction ? 'Reaction added successfully' : 'Reaction removed successfully'
      );
   } catch (error) {
      console.error('React to message error:', error);
      next(error);
   }
};

/**
 * Mark conversation as read (batch update)
 */
const markConversationAsRead = async (req, res, next) => {
   try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      const { lastMessageId } = req.body;

      // Verify user is participant of conversation
      const participant = await prisma.conversationParticipant.findFirst({
         where: {
            conversationId,
            userId,
         },
      });

      if (!participant) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      // If lastMessageId is provided, verify it exists in this conversation
      if (lastMessageId) {
         const message = await prisma.message.findFirst({
            where: {
               id: lastMessageId,
               conversationId,
            },
         });

         if (!message) {
            throw new ValidationError('Message not found in this conversation');
         }
      }

      // Get the latest message if no lastMessageId provided
      let messageToMarkRead = lastMessageId;
      if (!messageToMarkRead) {
         const latestMessage = await prisma.message.findFirst({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
         });
         messageToMarkRead = latestMessage?.id;
      }

      if (!messageToMarkRead) {
         return successResponse(res, { unreadCount: 0 }, 'No messages to mark as read');
      }

      // Update participant's lastReadMessage
      await prisma.conversationParticipant.update({
         where: {
            id: participant.id,
         },
         data: {
            lastReadMessageId: messageToMarkRead,
            lastReadAt: new Date(),
         },
      });

      // Create read receipts for all messages up to the specified message
      const messagesToMarkRead = await prisma.message.findMany({
         where: {
            conversationId,
            createdAt: {
               lte: (
                  await prisma.message.findUnique({
                     where: { id: messageToMarkRead },
                     select: { createdAt: true },
                  })
               )?.createdAt,
            },
            senderId: { not: userId }, // Don't create read receipts for own messages
         },
         select: { id: true },
      });

      // Bulk create read receipts (upsert to avoid duplicates)
      const readReceiptData = messagesToMarkRead.map((msg) => ({
         messageId: msg.id,
         userId,
      }));

      if (readReceiptData.length > 0) {
         await Promise.all(
            readReceiptData.map((data) =>
               prisma.messageReadReceipt.upsert({
                  where: {
                     messageId_userId: {
                        messageId: data.messageId,
                        userId: data.userId,
                     },
                  },
                  update: { readAt: new Date() },
                  create: data,
               })
            )
         );
      }

      // Get updated unread count
      const unreadCount = await getUnreadCount(conversationId, userId);

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${conversationId}`).emit('messages:read', {
            userId,
            lastReadMessageId: messageToMarkRead,
            readAt: new Date(),
         });
      }

      return successResponse(res, { unreadCount, lastReadMessageId: messageToMarkRead }, 'Messages marked as read');
   } catch (error) {
      console.error('Mark conversation as read error:', error);
      next(error);
   }
};

/**
 * Get unread messages count for a conversation
 */
const getUnreadMessagesCount = async (req, res, next) => {
   try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      // Verify user is participant of conversation
      const participant = await prisma.conversationParticipant.findFirst({
         where: {
            conversationId,
            userId,
         },
         select: {
            lastReadMessageId: true,
            lastReadAt: true,
         },
      });

      if (!participant) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      const unreadCount = await getUnreadCount(conversationId, userId);

      return successResponse(
         res,
         {
            unreadCount,
            lastReadMessageId: participant.lastReadMessageId,
            lastReadAt: participant.lastReadAt,
         },
         'Unread count retrieved successfully'
      );
   } catch (error) {
      console.error('Get unread count error:', error);
      next(error);
   }
};

/**
 * Get all unread messages count grouped by conversation
 */
const getAllUnreadCounts = async (req, res, next) => {
   try {
      const userId = req.user.id;

      // Get all conversations where user is a participant
      const conversations = await prisma.conversationParticipant.findMany({
         where: {
            userId,
            leftAt: null, // Only active conversations
         },
         select: {
            conversationId: true,
            lastReadMessageId: true,
            lastReadAt: true,
            conversation: {
               select: {
                  id: true,
                  title: true,
                  type: true,
               },
            },
         },
      });

      // Get unread counts for each conversation
      const unreadCounts = await Promise.all(
         conversations.map(async (conv) => {
            const unreadCount = await getUnreadCount(conv.conversationId, userId);
            return {
               conversationId: conv.conversationId,
               conversation: conv.conversation,
               unreadCount,
               lastReadMessageId: conv.lastReadMessageId,
               lastReadAt: conv.lastReadAt,
            };
         })
      );

      // Calculate total unread count
      const totalUnreadCount = unreadCounts.reduce((total, conv) => total + conv.unreadCount, 0);

      return successResponse(
         res,
         {
            totalUnreadCount,
            conversations: unreadCounts,
         },
         'All unread counts retrieved successfully'
      );
   } catch (error) {
      console.error('Get all unread counts error:', error);
      next(error);
   }
};

/**
 * Helper function to calculate unread count for a conversation
 */
const getUnreadCount = async (conversationId, userId) => {
   const participant = await prisma.conversationParticipant.findFirst({
      where: {
         conversationId,
         userId,
      },
      select: {
         lastReadAt: true,
         lastReadMessage: {
            select: {
               createdAt: true,
            },
         },
      },
   });

   if (!participant) return 0;

   // Count messages created after the last read message/time
   const whereCondition = {
      conversationId,
      senderId: { not: userId }, // Exclude own messages
   };

   if (participant.lastReadMessage) {
      whereCondition.createdAt = {
         gt: participant.lastReadMessage.createdAt,
      };
   } else if (participant.lastReadAt) {
      whereCondition.createdAt = {
         gt: participant.lastReadAt,
      };
   }

   return await prisma.message.count({ where: whereCondition });
};

/**
 * Upload message attachment
 */
const uploadAttachment = async (req, res, next) => {
   try {
      const { messageId } = req.params;
      const userId = req.user.id;

      if (!req.file) {
         throw new ValidationError('File is required');
      }

      // Verify message exists and user has access
      const message = await prisma.message.findFirst({
         where: {
            id: messageId,
            senderId: userId,
         },
      });

      if (!message) {
         throw new NotFoundError('Message not found or access denied');
      }

      // Map file type to MessageType enum
      let messageType = 'TEXT'; // default
      if (req.file.mimetype.startsWith('image/')) {
         messageType = 'IMAGE';
      } else if (req.file.mimetype.startsWith('video/')) {
         messageType = 'VIDEO';
      } else if (req.file.mimetype.startsWith('audio/')) {
         messageType = 'VOICE';
      } else {
         messageType = 'FILE';
      }

      // Create attachment
      const attachment = await prisma.messageAttachment.create({
         data: {
            messageId,
            url: req.file.path, // Cloudinary URL
            type: messageType,
            size: req.file.size,
         },
      });

      return successResponse(res, { attachment }, 'Attachment uploaded successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Upload attachment error:', error);
      next(error);
   }
};

module.exports = {
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
};
