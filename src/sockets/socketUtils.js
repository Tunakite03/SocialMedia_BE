const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

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
 * Handle WebRTC signaling for calls
 */
const handleWebRTC = (socket, io) => {
   const webrtcService = require('../services/webrtcService');

   // Debug: Log all events
   socket.onAny((event, data) => {
      console.log(`[DEBUG] Socket event received: ${event}`, JSON.stringify(data, null, 2));
   });

   // Helper function to resolve call ID (handle custom call IDs)
   const resolveCallId = (callId) => {
      // If it's a UUID (36 chars with dashes), use it directly
      if (callId && callId.length === 36 && callId.includes('-')) {
         return callId;
      }
      // Otherwise, check if it's a mapped custom call ID
      return callIdMapping.get(callId) || callId;
   };

   // Initiate call via WebSocket (alternative to REST API)
   // Handle multiple possible event names that frontend might use
   const callInitiateHandler = async (data) => {
      console.log('[DEBUG] Call initiate event received:', data);
      try {
         const { receiverId, type = 'AUDIO', callId: customCallId } = data;
         const initiatorId = socket.userId;

         console.log(
            `[DEBUG] WebSocket call initiate - Custom CallID: ${customCallId}, Initiator: ${initiatorId}, Receiver: ${receiverId}, Type: ${type}`
         );

         // If no custom callId provided, generate one based on timestamp
         const finalCustomCallId = customCallId || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

         console.log(`[DEBUG] Using call ID: ${finalCustomCallId}`);

         // Find or create direct conversation between initiator and receiver
         let conversation = await prisma.conversation.findFirst({
            where: {
               type: 'DIRECT',
               participants: {
                  every: {
                     userId: {
                        in: [initiatorId, receiverId],
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
            },
         });

         // If no conversation exists, create one
         if (!conversation) {
            conversation = await prisma.conversation.create({
               data: {
                  type: 'DIRECT',
                  participants: {
                     create: [{ userId: initiatorId }, { userId: receiverId }],
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
         }

         // Check if there's already an active call in this conversation
         const activeCall = await prisma.call.findFirst({
            where: {
               conversationId: conversation.id,
               status: {
                  in: ['RINGING', 'ONGOING'],
               },
            },
         });

         if (activeCall) {
            socket.emit('call:error', { error: 'There is already an active call in this conversation' });
            return;
         }

         // Create call
         const call = await prisma.call.create({
            data: {
               conversationId: conversation.id,
               initiatorId,
               type: type.toUpperCase(),
               status: 'RINGING',
            },
            include: {
               initiator: {
                  select: {
                     id: true,
                     username: true,
                     displayName: true,
                     avatar: true,
                  },
               },
               conversation: {
                  include: {
                     participants: {
                        include: {
                           user: {
                              select: {
                                 id: true,
                                 username: true,
                                 displayName: true,
                                 avatar: true,
                              },
                           },
                        },
                     },
                  },
               },
            },
         });

         // Create call participants for all conversation participants
         const callParticipants = await Promise.all(
            conversation.participants.map((participant) =>
               prisma.callParticipant.create({
                  data: {
                     callId: call.id,
                     userId: participant.userId,
                     status: participant.userId === initiatorId ? 'JOINED' : 'INVITED',
                  },
                  include: {
                     user: {
                        select: {
                           id: true,
                           username: true,
                           displayName: true,
                           avatar: true,
                        },
                     },
                  },
               })
            )
         );

         // Initialize WebRTC session
         await webrtcService.initializeCall(call.id, initiatorId, callParticipants);

         // Store mapping from custom call ID to real UUID
         callIdMapping.set(finalCustomCallId, call.id);
         console.log(`[DEBUG] Mapped custom call ID ${finalCustomCallId} to real UUID ${call.id}`);

         console.log(`[DEBUG] Created call via WebSocket with ID: ${call.id}`);

         // Send call initiated event to initiator with the custom call ID
         socket.emit('call:initiated', {
            call: {
               ...call,
               id: finalCustomCallId, // Return custom call ID if provided
               iceServers: webrtcService.getIceServers(),
            },
            participants: callParticipants,
         });

         // Notify all participants except initiator
         conversation.participants.forEach((participant) => {
            if (participant.userId !== initiatorId) {
               io.to(`user_${participant.userId}`).emit('call:incoming', {
                  call: {
                     ...call,
                     id: finalCustomCallId, // Use custom call ID for consistency
                     iceServers: webrtcService.getIceServers(),
                  },
                  participants: callParticipants,
               });
            }
         });

         // Update conversation room
         io.to(`conversation_${conversation.id}`).emit('call:initiated', {
            call: {
               ...call,
               id: finalCustomCallId, // Use custom call ID for consistency
               iceServers: webrtcService.getIceServers(),
            },
            participants: callParticipants,
         });
      } catch (error) {
         console.error('Error initiating call via WebSocket:', error);
         socket.emit('call:error', { error: error.message });
      }
   };

   // Register multiple possible event names for call initiation
   socket.on('call:initiate', callInitiateHandler);
   socket.on('call:start', callInitiateHandler);
   socket.on('webrtc:initiate', callInitiateHandler);
   socket.on('call:create', callInitiateHandler);

   // Join call room for WebRTC signaling
   socket.on('call:join_room', async (data) => {
      try {
         const { callId } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         console.log(`[DEBUG] Join call room - Custom: ${callId}, Real: ${realCallId}, User: ${userId}`);

         // Verify call access and join WebRTC session
         await webrtcService.joinCallRoom(realCallId, userId, socket.id);

         // Join socket room
         socket.join(`call_${realCallId}`);

         // Notify others in the call
         socket.to(`call_${realCallId}`).emit('call:user_joined', {
            userId,
            user: socket.user,
            joinedAt: new Date(),
         });

         // Send current call state to joining user
         const callSession = webrtcService.getCallSession(realCallId);
         if (callSession) {
            socket.emit('call:session_state', {
               callId: callId, // Return the original call ID to frontend
               participants: Array.from(callSession.participants.values()),
               iceServers: callSession.iceServers,
            });
         }

         console.log(`User ${socket.user.username} joined call room ${realCallId}`);
      } catch (error) {
         console.error('Error joining call room:', error);
         socket.emit('call:error', { error: error.message });
      }
   });

   // Leave call room
   socket.on('call:leave_room', async (data) => {
      try {
         const { callId } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Leave WebRTC session
         await webrtcService.leaveCallRoom(realCallId, userId);

         // Leave socket room
         socket.leave(`call_${realCallId}`);

         // Notify others in the call
         socket.to(`call_${realCallId}`).emit('call:user_left', {
            userId,
            leftAt: new Date(),
         });

         console.log(`User ${socket.user.username} left call room ${realCallId}`);
      } catch (error) {
         console.error('Error leaving call room:', error);
      }
   });

   // WebRTC Offer
   socket.on('webrtc:offer', async (data) => {
      try {
         const { callId, targetUserId, offer } = data;
         const userId = socket.userId;
         let realCallId = resolveCallId(callId);

         // If call doesn't exist, try to create it automatically
         if (!realCallId || !(await prisma.call.findUnique({ where: { id: realCallId } }))) {
            console.log(`[DEBUG] Call ${callId} not found, attempting auto-creation`);
            // This is a fallback - ideally the call should be created via call:initiate first
            // But for now, we'll try to handle it
            socket.emit('webrtc:error', { error: 'Call session not found. Please initiate call first.' });
            return;
         }

         // Process signaling event
         await webrtcService.processSignalingEvent(realCallId, userId, 'offer', {
            offer,
            targetUserId,
         });

         // Forward offer to target user
         if (targetUserId) {
            socket.to(`call_${realCallId}`).emit('webrtc:offer', {
               callId,
               fromUserId: userId,
               targetUserId,
               offer,
            });
         } else {
            // Broadcast to all participants
            socket.to(`call_${realCallId}`).emit('webrtc:offer', {
               callId,
               fromUserId: userId,
               offer,
            });
         }

         console.log(`WebRTC offer sent in call ${realCallId} from user ${userId}`);
      } catch (error) {
         console.error('Error handling WebRTC offer:', error);
         socket.emit('webrtc:error', { error: error.message });
      }
   });

   // WebRTC Answer
   socket.on('webrtc:answer', async (data) => {
      try {
         const { callId, targetUserId, answer } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Process signaling event
         await webrtcService.processSignalingEvent(realCallId, userId, 'answer', {
            answer,
            targetUserId,
         });

         // Forward answer to target user
         if (targetUserId) {
            socket.to(`call_${realCallId}`).emit('webrtc:answer', {
               callId,
               fromUserId: userId,
               targetUserId,
               answer,
            });
         } else {
            // Broadcast to all participants
            socket.to(`call_${realCallId}`).emit('webrtc:answer', {
               callId,
               fromUserId: userId,
               answer,
            });
         }

         console.log(`WebRTC answer sent in call ${realCallId} from user ${userId}`);
      } catch (error) {
         console.error('Error handling WebRTC answer:', error);
         socket.emit('webrtc:error', { error: error.message });
      }
   });

   // ICE Candidate
   socket.on('webrtc:ice-candidate', async (data) => {
      try {
         const { callId, targetUserId, candidate } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Process signaling event
         await webrtcService.processSignalingEvent(realCallId, userId, 'ice-candidate', {
            candidate,
            targetUserId,
         });

         // Forward ICE candidate to target user or broadcast
         if (targetUserId) {
            socket.to(`call_${realCallId}`).emit('webrtc:ice-candidate', {
               callId,
               fromUserId: userId,
               targetUserId,
               candidate,
            });
         } else {
            socket.to(`call_${realCallId}`).emit('webrtc:ice-candidate', {
               callId,
               fromUserId: userId,
               candidate,
            });
         }

         console.log(`ICE candidate sent in call ${realCallId} from user ${userId}`);
      } catch (error) {
         console.error('Error handling ICE candidate:', error);
         socket.emit('webrtc:error', { error: error.message });
      }
   });

   // Connection state change
   socket.on('webrtc:connection-state', async (data) => {
      try {
         const { callId, connectionState, targetUserId } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Process signaling event
         await webrtcService.processSignalingEvent(realCallId, userId, 'connection-state-change', {
            connectionState,
            targetUserId,
         });

         // Notify others about connection state change
         socket.to(`call_${realCallId}`).emit('webrtc:connection-state', {
            callId,
            userId,
            connectionState,
            timestamp: new Date(),
         });

         console.log(`Connection state changed for call ${realCallId} user ${userId}: ${connectionState}`);
      } catch (error) {
         console.error('Error handling connection state change:', error);
      }
   });

   // Media state change (mute/unmute, video on/off)
   socket.on('call:media_state', async (data) => {
      try {
         const { callId, mediaState } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Update media state in service
         const updatedState = await webrtcService.updateMediaState(realCallId, userId, mediaState);

         // Notify others in the call
         socket.to(`call_${realCallId}`).emit('call:media_state_changed', {
            callId,
            userId,
            mediaState: updatedState,
            timestamp: new Date(),
         });

         console.log(`Media state updated for call ${realCallId} user ${userId}:`, updatedState);
      } catch (error) {
         console.error('Error updating media state:', error);
         socket.emit('call:error', { error: error.message });
      }
   });

   // Quality metrics update
   socket.on('call:quality_metrics', async (data) => {
      try {
         const { callId, metrics } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // Update quality metrics
         await webrtcService.updateQualityMetrics(realCallId, userId, metrics);

         console.log(`Quality metrics updated for call ${realCallId} user ${userId}`);
      } catch (error) {
         console.error('Error updating quality metrics:', error);
      }
   });

   // Handle call end from WebRTC side
   socket.on('call:end_webrtc', async (data) => {
      try {
         const { callId } = data;
         const userId = socket.userId;
         const realCallId = resolveCallId(callId);

         // End call through service
         const result = await webrtcService.endCall(realCallId);

         // Notify all participants
         io.to(`call_${realCallId}`).emit('call:ended', {
            callId,
            endedBy: userId,
            endedAt: result.endedAt,
            duration: result.duration,
         });

         // Clean up mapping
         if (callId !== realCallId) {
            callIdMapping.delete(callId);
         }

         console.log(`Call ${realCallId} ended by user ${userId}`);
      } catch (error) {
         console.error('Error ending call:', error);
         socket.emit('call:error', { error: error.message });
      }
   });

   // Handle automatic cleanup on socket disconnect
   socket.on('disconnect', async () => {
      try {
         const userId = socket.userId;
         const userCall = webrtcService.getUserCall(userId);

         if (userCall) {
            await webrtcService.leaveCallRoom(userCall.id, userId);

            // Notify others in the call
            socket.to(`call_${userCall.id}`).emit('call:user_left', {
               userId,
               leftAt: new Date(),
               reason: 'disconnected',
            });
         }
      } catch (error) {
         console.error('Error handling WebRTC disconnect cleanup:', error);
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
   handleWebRTC,
   getConnectedUser,
   getSocketId,
   getAllConnectedUsers,
};
