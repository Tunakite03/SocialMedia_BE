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

      // Check if conversation already exists
      let conversation = await prisma.conversation.findFirst({
         where: {
            id: conversationId,
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
         throw new NotFoundError('Conversation not found');
      }

      // Transform messages array to lastMessage
      const { messages, ...conversationData } = conversation;
      const conversationWithLastMessage = {
         ...conversationData,
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
      const transformedConversations = conversations.map((conversation) => {
         const { messages, ...conversationData } = conversation;
         return { ...conversationData, lastMessage: messages.length > 0 ? messages[0] : null };
      });

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
         },
         orderBy: paginationConfig.orderBy || { createdAt: 'desc' },
         take: paginationConfig.take,
         skip: paginationConfig.skip,
         cursor: paginationConfig.cursor,
      });

      const { items, pagination } = processPaginatedResults(messages, paginationConfig);

      return paginatedResponse(res, { messages: items }, pagination);
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
};
