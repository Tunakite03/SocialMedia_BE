const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const webrtcService = require('../services/webrtcService');
const Logger = require('../utils/logger');

const connectedUsers = new Map(); // Store connected users
const userSockets = new Map(); // Map userId to socketId
const callIdMapping = global.callIdMapping || (global.callIdMapping = new Map()); // Map custom call IDs to real UUIDs

/**
 * Socket.IO authentication middleware
 */
const authenticateSocket = async (socket, next) => {
   try {
      const token = socket.handshake.auth.token;

      if (!token) {
         return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
         where: { id: decoded.userId },
         select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatar: true,
            isActive: true,
         },
      });

      if (!user || !user.isActive) {
         return next(new Error('Authentication error: Invalid user'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
   } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
   }
};

/**
 * Handle user connection
 */
const handleConnection = async (socket) => {
   const userId = socket.userId;
   const user = socket.user;

   // Store user connection
   connectedUsers.set(userId, {
      socketId: socket.id,
      user: user,
      connectedAt: new Date(),
   });

   userSockets.set(userId, socket.id);

   // Update user online status in database
   await prisma.user.update({
      where: { id: userId },
      data: {
         isOnline: true,
         lastSeen: new Date(),
      },
   });

   // Join user to their personal room
   socket.join(`user_${userId}`);

   // Auto-join user to their conversations
   try {
      const conversations = await prisma.conversationParticipant.findMany({
         where: {
            userId: userId,
            leftAt: null,
         },
         select: {
            conversationId: true,
         },
      });

      conversations.forEach(({ conversationId }) => {
         socket.join(`conversation_${conversationId}`);
      });
   } catch (error) {
      console.error('Error auto-joining conversations:', error);
   }

   // Notify friends about online status
   socket.broadcast.emit('user:online', {
      userId: userId,
      user: {
         id: user.id,
         username: user.username,
         displayName: user.displayName,
         avatar: user.avatar,
      },
   });

   // Send current online users to the newly connected user
   const onlineUsers = Array.from(connectedUsers.values()).map((conn) => ({
      userId: conn.user.id,
      user: {
         id: conn.user.id,
         username: conn.user.username,
         displayName: conn.user.displayName,
         avatar: conn.user.avatar,
      },
   }));

   socket.emit('users:online', onlineUsers);
};

/**
 * Handle user disconnection
 */
const handleDisconnection = async (socket) => {
   const userId = socket.userId;
   const user = socket.user;

   if (userId) {
      // Handle call disconnection first
      try {
         const { handleUserDisconnectFromCall } = require('../controllers/callController');
         await handleUserDisconnectFromCall(userId);
      } catch (error) {
         console.error('Error handling call disconnect:', error);
      }

      // Remove user from connected users
      connectedUsers.delete(userId);
      userSockets.delete(userId);

      // Update user offline status in database
      try {
         await prisma.user.update({
            where: { id: userId },
            data: {
               isOnline: false,
               lastSeen: new Date(),
            },
         });
      } catch (error) {
         // User might have been deleted, log and continue
         console.warn(`Failed to update offline status for user ${userId}:`, error.message);
      }

      // Notify friends about offline status
      socket.broadcast.emit('user:offline', {
         userId: userId,
         lastSeen: new Date(),
      });
   }
};

/**
 * Handle typing indicators (moved to handleMessaging)
 */
const handleTyping = (socket) => {
   // This function is now empty as typing is handled in handleMessaging
   // Keeping it for backward compatibility
};

/**
 * Handle conversation rooms
 */
const handleConversations = (socket) => {
   // Join conversation room
   socket.on('conversation:join', async (data) => {
      try {
         const { conversationId } = data;

         // Verify user is participant in this conversation
         const participant = await prisma.conversationParticipant.findFirst({
            where: {
               conversationId,
               userId: socket.userId,
               leftAt: null,
            },
         });

         if (participant) {
            socket.join(`conversation_${conversationId}`);

            // Notify others in conversation
            socket.to(`conversation_${conversationId}`).emit('user:joined_conversation', {
               userId: socket.userId,
               user: socket.user,
               conversationId,
            });
         }
      } catch (error) {
         console.error('Error joining conversation:', error);
      }
   });

   // Leave conversation room
   socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation_${conversationId}`);

      // Notify others in conversation
      socket.to(`conversation_${conversationId}`).emit('user:left_conversation', {
         userId: socket.userId,
         conversationId,
      });
   });

   // Auto-join user to their conversations when they connect
   socket.on('conversations:join_all', async () => {
      try {
         const conversations = await prisma.conversationParticipant.findMany({
            where: {
               userId: socket.userId,
               leftAt: null,
            },
            select: {
               conversationId: true,
            },
         });

         conversations.forEach(({ conversationId }) => {
            socket.join(`conversation_${conversationId}`);
         });
      } catch (error) {
         console.error('Error joining all conversations:', error);
      }
   });
};

/**
 * Handle real-time messaging
 */
const handleMessaging = (socket, io) => {
   // Send message to conversation
   socket.on('message:send', async (data) => {
      try {
         const { conversationId, content, replyToId } = data;

         // Verify user is participant in this conversation
         const participant = await prisma.conversationParticipant.findFirst({
            where: {
               conversationId,
               userId: socket.userId,
               leftAt: null,
            },
         });

         if (!participant) {
            socket.emit('message:error', { error: 'Access denied to this conversation' });
            return;
         }

         // Create message in database
         const message = await prisma.message.create({
            data: {
               content: content.trim(),
               conversationId,
               senderId: socket.userId,
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

         // Emit to conversation room
         io.to(`conversation_${conversationId}`).emit('message:new', message);
      } catch (error) {
         console.error('Error sending message:', error);
         socket.emit('message:error', { error: 'Failed to send message' });
      }
   });

   // React to message
   socket.on('message:react', async (data) => {
      try {
         const { messageId, emoji } = data;

         // Verify message exists and user has access
         const message = await prisma.message.findFirst({
            where: {
               id: messageId,
               conversation: {
                  participants: {
                     some: {
                        userId: socket.userId,
                        leftAt: null,
                     },
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
            socket.emit('message:error', { error: 'Message not found or access denied' });
            return;
         }

         // Check if user already reacted
         const existingReaction = await prisma.messageReaction.findFirst({
            where: {
               messageId,
               userId: socket.userId,
            },
         });

         let reaction;
         let action;

         if (existingReaction) {
            if (existingReaction.emoji === emoji) {
               // Remove reaction if same emoji
               await prisma.messageReaction.delete({
                  where: { id: existingReaction.id },
               });
               reaction = null;
               action = 'removed';
            } else {
               // Update reaction with new emoji
               reaction = await prisma.messageReaction.update({
                  where: { id: existingReaction.id },
                  data: { emoji },
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
               action = 'updated';
            }
         } else {
            // Create new reaction
            reaction = await prisma.messageReaction.create({
               data: {
                  messageId,
                  userId: socket.userId,
                  emoji,
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
            action = 'added';
         }

         // Emit to conversation room
         io.to(`conversation_${message.conversation.id}`).emit('message:reaction', {
            messageId,
            reaction,
            action,
         });
      } catch (error) {
         console.error('Error reacting to message:', error);
         socket.emit('message:error', { error: 'Failed to react to message' });
      }
   });

   // Typing indicators
   socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('typing:start', {
         userId: socket.userId,
         user: {
            id: socket.user.id,
            username: socket.user.username,
            displayName: socket.user.displayName,
            avatar: socket.user.avatar,
         },
         conversationId,
      });
   });

   socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('typing:stop', {
         userId: socket.userId,
         conversationId,
      });
   });

   // Edit message via socket
   socket.on('message:edit', async (data) => {
      try {
         const { messageId, content } = data;

         if (!content?.trim()) {
            socket.emit('message:error', { error: 'Message content is required' });
            return;
         }

         const message = await prisma.message.findUnique({
            where: { id: messageId },
         });

         if (!message || message.senderId !== socket.userId) {
            socket.emit('message:error', { error: 'Message not found or access denied' });
            return;
         }

         if (message.type !== 'TEXT') {
            socket.emit('message:error', { error: 'Only text messages can be edited' });
            return;
         }

         const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
               content: content.trim(),
               isEdited: true,
               editedAt: new Date(),
            },
            include: {
               sender: {
                  select: { id: true, username: true, displayName: true, avatar: true },
               },
               parent: message.parentId
                  ? {
                       include: {
                          sender: {
                             select: { id: true, username: true, displayName: true },
                          },
                       },
                    }
                  : false,
               attachments: true,
               reactions: {
                  include: {
                     user: {
                        select: { id: true, username: true, displayName: true },
                     },
                  },
               },
            },
         });

         io.to(`conversation_${message.conversationId}`).emit('message:updated', updatedMessage);
      } catch (error) {
         console.error('Error editing message:', error);
         socket.emit('message:error', { error: 'Failed to edit message' });
      }
   });

   // Delete message via socket
   socket.on('message:delete', async (data) => {
      try {
         const { messageId } = data;

         const message = await prisma.message.findUnique({
            where: { id: messageId },
         });

         if (!message || message.senderId !== socket.userId) {
            socket.emit('message:error', { error: 'Message not found or access denied' });
            return;
         }

         await prisma.message.delete({
            where: { id: messageId },
         });

         io.to(`conversation_${message.conversationId}`).emit('message:deleted', {
            id: messageId,
            conversationId: message.conversationId,
         });
      } catch (error) {
         console.error('Error deleting message:', error);
         socket.emit('message:error', { error: 'Failed to delete message' });
      }
   });

   // Optimized batch read with intelligent debouncing and caching
   const readOperationCache = new Map(); // Cache for recent read operations
   const pendingReads = new Map(); // Pending read operations for batching

   socket.on('conversation:markAsRead', async (data) => {
      try {
         const { conversationId, lastMessageId } = data;
         const userId = socket.userId;

         // Create cache key
         const cacheKey = `${userId}:${conversationId}`;
         const currentTime = Date.now();

         // Check if we've recently processed this read operation (within 5 seconds)
         const cachedOperation = readOperationCache.get(cacheKey);
         if (cachedOperation && currentTime - cachedOperation.timestamp < 5000) {
            // Return cached response to avoid duplicate processing
            socket.emit('conversation:read:success', {
               conversationId,
               unreadCount: cachedOperation.unreadCount,
               lastReadMessageId: cachedOperation.lastReadMessageId,
            });
            return;
         }

         // Debounce read operations - batch multiple reads within 1 second
         if (pendingReads.has(cacheKey)) {
            clearTimeout(pendingReads.get(cacheKey).timeout);
         }

         pendingReads.set(cacheKey, {
            conversationId,
            lastMessageId,
            timeout: setTimeout(async () => {
               await processReadOperation(userId, conversationId, lastMessageId, socket, io);
               pendingReads.delete(cacheKey);
            }, 500), // 500ms debounce
         });
      } catch (error) {
         console.error('Error marking conversation as read:', error);
         socket.emit('conversation:read:error', { error: 'Failed to mark as read' });
      }
   });

   // Optimized read operation processor
   async function processReadOperation(userId, conversationId, lastMessageId, socket, io) {
      try {
         const cacheKey = `${userId}:${conversationId}`;

         // Verify user is participant (with optimized query)
         const participant = await prisma.conversationParticipant.findFirst({
            where: {
               conversationId,
               userId,
               leftAt: null, // Only active participants
            },
            select: {
               id: true,
               lastReadMessageId: true,
               lastReadAt: true,
            },
         });

         if (!participant) {
            socket.emit('conversation:read:error', { error: 'Access denied to this conversation' });
            return;
         }

         // Get target message with optimized query
         let messageToMarkRead = lastMessageId;
         if (!messageToMarkRead) {
            const latestMessage = await prisma.message.findFirst({
               where: {
                  conversationId,
                  senderId: { not: userId }, // Only consider messages from others
               },
               orderBy: { createdAt: 'desc' },
               select: { id: true, createdAt: true },
            });
            messageToMarkRead = latestMessage?.id;
         }

         if (!messageToMarkRead) {
            // No messages to mark as read
            socket.emit('conversation:read:success', {
               conversationId,
               unreadCount: 0,
               lastReadMessageId: participant.lastReadMessageId,
            });
            return;
         }

         // Check if this message is already read (avoid unnecessary operations)
         if (participant.lastReadMessageId === messageToMarkRead) {
            socket.emit('conversation:read:success', {
               conversationId,
               unreadCount: 0,
               lastReadMessageId: messageToMarkRead,
            });
            return;
         }

         // Get target message timestamp for efficient querying
         const targetMessage = await prisma.message.findUnique({
            where: { id: messageToMarkRead },
            select: { createdAt: true },
         });

         if (!targetMessage) {
            socket.emit('conversation:read:error', { error: 'Message not found' });
            return;
         }

         // Use database transaction for consistency and performance
         const result = await prisma.$transaction(async (tx) => {
            // Update participant's last read message
            await tx.conversationParticipant.update({
               where: { id: participant.id },
               data: {
                  lastReadMessageId: messageToMarkRead,
                  lastReadAt: new Date(),
               },
            });

            // Get unread messages efficiently
            const unreadMessages = await tx.message.findMany({
               where: {
                  conversationId,
                  senderId: { not: userId },
                  createdAt: {
                     lte: targetMessage.createdAt,
                     gt: participant.lastReadAt || new Date('1970-01-01'),
                  },
               },
               select: { id: true },
            });

            // Bulk upsert read receipts efficiently
            if (unreadMessages.length > 0) {
               // Use raw query for better performance on bulk operations
               const messageIds = unreadMessages.map((m) => m.id);
               await tx.$executeRaw`
                  INSERT INTO message_read_receipts (id, "messageId", "userId", "readAt", "createdAt")
                  SELECT gen_random_uuid(), m.id, ${userId}::uuid, NOW(), NOW()
                  FROM unnest(${messageIds}::uuid[]) AS m(id)
                  ON CONFLICT ("messageId", "userId") 
                  DO UPDATE SET "readAt" = NOW()
               `;
            }

            // Calculate remaining unread count efficiently
            const unreadCount = await tx.message.count({
               where: {
                  conversationId,
                  senderId: { not: userId },
                  createdAt: {
                     gt: targetMessage.createdAt,
                  },
               },
            });

            return { unreadCount, processedMessages: unreadMessages.length };
         });

         // Cache the operation result
         readOperationCache.set(cacheKey, {
            timestamp: Date.now(),
            unreadCount: result.unreadCount,
            lastReadMessageId: messageToMarkRead,
         });

         // Clean up old cache entries (keep only last 100 entries)
         if (readOperationCache.size > 100) {
            const oldestKeys = Array.from(readOperationCache.keys()).slice(0, readOperationCache.size - 100);
            oldestKeys.forEach((key) => readOperationCache.delete(key));
         }

         // Emit optimized read status to conversation
         io.to(`conversation_${conversationId}`).emit('messages:read', {
            userId,
            conversationId,
            lastReadMessageId: messageToMarkRead,
            readAt: new Date().toISOString(),
         });

         // Send success response to initiating client
         socket.emit('conversation:read:success', {
            conversationId,
            unreadCount: result.unreadCount,
            lastReadMessageId: messageToMarkRead,
         });
      } catch (error) {
         console.error('Error processing read operation:', error);
         socket.emit('conversation:read:error', { error: 'Failed to process read operation' });
      }
   }

   // Enhanced single message read with smart deduplication
   socket.on('message:read', async (data) => {
      try {
         const { messageId } = data;
         const userId = socket.userId;

         // Check if read receipt already exists (avoid unnecessary DB operations)
         const existingReceipt = await prisma.messageReadReceipt.findUnique({
            where: {
               messageId_userId: {
                  messageId,
                  userId,
               },
            },
            select: { id: true, readAt: true },
         });

         let readAt;
         if (existingReceipt) {
            // Update existing receipt timestamp
            const updated = await prisma.messageReadReceipt.update({
               where: { id: existingReceipt.id },
               data: { readAt: new Date() },
               select: { readAt: true },
            });
            readAt = updated.readAt;
         } else {
            // Create new read receipt
            const created = await prisma.messageReadReceipt.create({
               data: {
                  messageId,
                  userId,
                  readAt: new Date(),
               },
               select: { readAt: true },
            });
            readAt = created.readAt;
         }

         // Get message info efficiently
         const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: {
               conversationId: true,
               senderId: true,
               createdAt: true,
            },
         });

         if (message) {
            // Only emit if the reader is not the sender (avoid self-notifications)
            if (message.senderId !== userId) {
               // Notify conversation about read receipt
               io.to(`conversation_${message.conversationId}`).emit('message:read', {
                  messageId,
                  readBy: userId,
                  readAt: readAt.toISOString(),
               });
            }
         }
      } catch (error) {
         console.error('Error marking message as read:', error);
         socket.emit('message:read:error', { error: 'Failed to mark message as read' });
      }
   });
};

/**
 * Handle notifications
 */
const handleNotifications = (socket, io) => {
   socket.on('notification:send', async (data) => {
      try {
         const { receiverId, type, title, message, entityId, entityType } = data;

         // Create notification in database
         const notification = await prisma.notification.create({
            data: {
               type,
               title,
               message,
               receiverId,
               senderId: socket.userId,
               entityId,
               entityType,
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
            },
         });

         // Send notification to receiver
         io.to(`user:${receiverId}`).emit('notification:new', notification);
      } catch (error) {
         console.error('Error sending notification:', error);
      }
   });
};

/**
 * Broadcast transcription to call participants
 * This can be called from services to push transcriptions via WebSocket
 */
const broadcastTranscription = async (io, callId, transcriptionData) => {
   try {
      Logger.info(`Broadcasting transcription to call room: call_${callId}`);
      Logger.debug('Transcription data:', transcriptionData);

      // Emit to the call room - all participants who joined this room will receive
      io.to(`call_${callId}`).emit('call:transcription', transcriptionData);

      Logger.info(`Transcription broadcast successful: "${transcriptionData.transcript?.substring(0, 50)}..."`);
   } catch (error) {
      Logger.error('Error broadcasting transcription:', error);
   }
};

/**
 * Handle call transcription events
 */
const handleCallTranscription = (socket, io) => {
   // Join call room to receive transcriptions
   socket.on('call:join-room', async (data) => {
      try {
         const { callId } = data;
         const userId = socket.userId;

         if (!callId) {
            socket.emit('call:error', { error: 'Call ID is required' });
            return;
         }

         // Verify user is participant in the call
         const participant = await prisma.callParticipant.findFirst({
            where: {
               callId,
               userId,
            },
         });

         if (!participant) {
            socket.emit('call:error', { error: 'User not in call' });
            return;
         }

         const roomName = `call_${callId}`;
         socket.join(roomName);

         Logger.info(`User ${userId} joined call room: ${roomName}`);
         socket.emit('call:room-joined', { callId, room: roomName });

         // Send any existing transcriptions
         const transcriptionService = require('../services/transcriptionService');
         const recentTranscripts = await transcriptionService.getCallTranscriptions(callId, {
            take: 50,
            isFinal: true,
         });

         if (recentTranscripts.length > 0) {
            Logger.info(`Sending ${recentTranscripts.length} recent transcripts to user ${userId}`);
            socket.emit('call:transcription-history', {
               callId,
               transcripts: recentTranscripts,
            });
         }
      } catch (error) {
         Logger.error('Error joining call room:', error);
         socket.emit('call:error', { error: 'Failed to join call room' });
      }
   });

   // Leave call room
   socket.on('call:leave-room', (data) => {
      try {
         const { callId } = data;
         const userId = socket.userId;

         if (!callId) return;

         const roomName = `call_${callId}`;
         socket.leave(roomName);

         Logger.info(`User ${userId} left call room: ${roomName}`);
         socket.emit('call:room-left', { callId, room: roomName });
      } catch (error) {
         Logger.error('Error leaving call room:', error);
      }
   });

   // Handle transcription text from Web Speech API
   socket.on('call:transcription:text', async (data) => {
      try {
         const {
            callId,
            transcript,
            isFinal,
            confidence,
            segmentId,
            speakerId,
            speakerName,
            speakerAvatar,
            language,
            source,
         } = data;
         const userId = socket.userId;

         Logger.info(
            `[Transcription] Received from ${speakerName || userId}: "${transcript?.substring(0, 50)}..." (isFinal: ${isFinal})`,
         );

         // Validate required fields
         if (!callId || !transcript) {
            Logger.warn('[Transcription] Missing required fields');
            return socket.emit('call:transcription:error', {
               error: 'Missing required fields: callId, transcript',
            });
         }

         // Verify user is in the call
         const participant = await prisma.callParticipant.findFirst({
            where: {
               callId,
               userId,
               status: 'JOINED',
            },
         });

         if (!participant) {
            Logger.warn(`[Transcription] User ${userId} not in call ${callId}`);
            return socket.emit('call:transcription:error', {
               error: 'User not in call',
            });
         }

         // Analyze sentiment for final transcripts
         let sentimentResult = null;
         if (isFinal && transcript.trim().length > 0) {
            try {
               const sentimentService = require('../services/sentimentService');
               sentimentResult = await sentimentService.analyzeSentiment(transcript, userId, callId, 'call_transcript');
               Logger.info(
                  `[Transcription] Sentiment: ${sentimentResult.emotion} (${Math.round(sentimentResult.confidence * 100)}%)`,
               );
            } catch (error) {
               Logger.warn('[Transcription] Failed to analyze sentiment:', error.message);
               // Continue without sentiment - not critical
            }
         }

         // Prepare transcription data
         const transcriptionData = {
            id: segmentId || `${callId}_${Date.now()}`,
            callId,
            transcript,
            isFinal,
            confidence,
            timestamp: new Date().toISOString(),
            segmentId: segmentId || `${callId}_${Date.now()}`,
            speakerId: speakerId || userId,
            speakerName: speakerName || socket.user?.displayName || socket.user?.username,
            speakerAvatar: speakerAvatar || socket.user?.avatar,
            language: language || 'en-US',
            source: source || 'web-speech-api',
            // Include sentiment data if available
            sentiment: sentimentResult
               ? {
                    emotion: sentimentResult.emotion,
                    emotionClass: sentimentResult.emotionClass,
                    confidence: sentimentResult.confidence,
                    scores: sentimentResult.scores,
                 }
               : null,
         };

         // Broadcast to all participants in the call room
         const roomName = `call_${callId}`;
         io.to(roomName).emit('call:transcription', transcriptionData);

         Logger.info(
            `[Transcription] Broadcasted to ${roomName}${sentimentResult ? ` with sentiment: ${sentimentResult.emotion}` : ''}`,
         );

         // Save final transcripts to database
         if (isFinal) {
            try {
               await prisma.callTranscript.create({
                  data: {
                     callId,
                     speakerId: userId,
                     transcript,
                     language: language || 'en-US',
                     confidence: confidence || null,
                     isFinal: true,
                     segmentId: segmentId || `${callId}_${Date.now()}`,
                     sentiment: sentimentResult ? sentimentResult.emotion : null,
                  },
               });
               Logger.info(`[Transcription] Saved to database: ${transcript.substring(0, 30)}...`);
            } catch (dbError) {
               Logger.error('[Transcription] Failed to save to database:', dbError);
               // Continue even if save fails
            }
         }
      } catch (error) {
         Logger.error('[Transcription] Error:', error);
         socket.emit('call:transcription:error', {
            error: error.message,
         });
      }
   });
};

/**
 * Handle face emotion detection during calls
 */
const handleFaceEmotion = (socket, io) => {
   const faceEmotionService = require('../services/faceEmotionService');

   // Receive emotion from user and broadcast to other participants
   socket.on('call:emotion', async (data) => {
      try {
         const { callId, emotion, confidence, metadata } = data;
         const userId = socket.userId;

         // Validate emotion data
         if (!callId || !emotion || confidence === undefined) {
            socket.emit('call:emotion:error', { error: 'Missing required emotion data' });
            return;
         }

         // Verify user is in the call
         const participant = await prisma.callParticipant.findFirst({
            where: {
               callId,
               userId,
               status: 'JOINED',
            },
         });

         if (!participant) {
            socket.emit('call:emotion:error', { error: 'User not in call' });
            return;
         }

         // Store emotion in database (async, non-blocking)
         faceEmotionService
            .storeFaceEmotion({
               userId,
               callId,
               emotion: emotion.toUpperCase(),
               confidence,
               metadata: metadata || {},
            })
            .catch((error) => {
               console.error('Error storing face emotion:', error);
            });

         // Get all participants in the call
         const call = await prisma.call.findUnique({
            where: { id: callId },
            include: {
               participants: {
                  where: {
                     status: 'JOINED',
                     userId: { not: userId }, // Exclude sender
                  },
                  select: {
                     userId: true,
                  },
               },
            },
         });

         if (call) {
            // Broadcast emotion to other participants
            const emotionData = {
               userId,
               callId,
               emotion: emotion.toUpperCase(),
               confidence,
               timestamp: new Date().toISOString(),
               user: {
                  id: socket.user.id,
                  displayName: socket.user.displayName,
                  avatar: socket.user.avatar,
               },
            };

            // Send to all other participants in the call
            call.participants.forEach((participant) => {
               const targetSocketId = getSocketId(participant.userId);
               if (targetSocketId) {
                  io.to(targetSocketId).emit('call:emotion', emotionData);
               }
            });
         }
      } catch (error) {
         console.error('Error handling face emotion:', error);
         socket.emit('call:emotion:error', { error: 'Failed to process emotion' });
      }
   });

   // Request emotion statistics for a call
   socket.on('call:emotion:stats', async (data) => {
      try {
         const { callId, userId } = data;

         // Verify user has access to the call
         const participant = await prisma.callParticipant.findFirst({
            where: {
               callId,
               userId: userId || socket.userId,
            },
         });

         if (!participant) {
            socket.emit('call:emotion:stats:error', { error: 'Access denied' });
            return;
         }

         // Get emotion statistics
         const stats = await faceEmotionService.getUserEmotionStats(userId || socket.userId, callId);

         socket.emit('call:emotion:stats', {
            callId,
            userId: userId || socket.userId,
            stats,
         });
      } catch (error) {
         console.error('Error getting emotion stats:', error);
         socket.emit('call:emotion:stats:error', { error: 'Failed to get emotion statistics' });
      }
   });
};

/**
 * Get connected user by ID
 */
const getConnectedUser = (userId) => {
   return connectedUsers.get(userId);
};

/**
 * Get socket ID by user ID
 */
const getSocketId = (userId) => {
   return userSockets.get(userId);
};

/**
 * Get all connected users
 */
const getAllConnectedUsers = () => {
   return Array.from(connectedUsers.values());
};

module.exports = {
   authenticateSocket,
   handleConnection,
   handleDisconnection,
   handleTyping,
   handleConversations,
   handleMessaging,
   handleNotifications,
   handleFaceEmotion,
   handleCallTranscription,
   broadcastTranscription,
   getConnectedUser,
   getSocketId,
   getAllConnectedUsers,
};
