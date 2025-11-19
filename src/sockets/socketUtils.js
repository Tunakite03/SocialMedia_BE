const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const connectedUsers = new Map(); // Store connected users
const userSockets = new Map(); // Map userId to socketId

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

   // Mark messages as read (batch)
   socket.on('conversation:markAsRead', async (data) => {
      try {
         const { conversationId, lastMessageId } = data;
         const userId = socket.userId;

         // Verify user is participant
         const participant = await prisma.conversationParticipant.findFirst({
            where: {
               conversationId,
               userId,
            },
         });

         if (!participant) {
            socket.emit('error', { message: 'Access denied to this conversation' });
            return;
         }

         // Get the message to mark as last read
         let messageToMarkRead = lastMessageId;
         if (!messageToMarkRead) {
            const latestMessage = await prisma.message.findFirst({
               where: { conversationId },
               orderBy: { createdAt: 'desc' },
               select: { id: true },
            });
            messageToMarkRead = latestMessage?.id;
         }

         if (!messageToMarkRead) return;

         // Update participant's lastReadMessage
         await prisma.conversationParticipant.update({
            where: { id: participant.id },
            data: {
               lastReadMessageId: messageToMarkRead,
               lastReadAt: new Date(),
            },
         });

         // Create read receipts for unread messages
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
               senderId: { not: userId },
            },
            select: { id: true },
         });

         // Bulk create read receipts
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

         // Emit read status to conversation
         io.to(`conversation_${conversationId}`).emit('messages:read', {
            userId,
            lastReadMessageId: messageToMarkRead,
            readAt: new Date(),
         });
      } catch (error) {
         console.error('Error marking conversation as read:', error);
         socket.emit('error', { message: 'Failed to mark as read' });
      }
   });

   // Mark single message as read (legacy support)
   socket.on('message:read', async (data) => {
      try {
         const { messageId } = data;

         // Create read receipt
         await prisma.messageReadReceipt.upsert({
            where: {
               messageId_userId: {
                  messageId,
                  userId: socket.userId,
               },
            },
            update: { readAt: new Date() },
            create: {
               messageId,
               userId: socket.userId,
            },
         });

         // Get message info
         const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
               conversation: { select: { id: true } },
               sender: { select: { id: true } },
            },
         });

         if (message) {
            // Notify conversation about read receipt
            io.to(`conversation_${message.conversation.id}`).emit('message:read', {
               messageId,
               readBy: socket.userId,
               readAt: new Date(),
            });
         }
      } catch (error) {
         console.error('Error marking message as read:', error);
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
   // Call events are now handled through conversation-based calls

   // WebRTC signaling events
   socket.on('webrtc:offer', (data) => {
      const { callId, offer } = data;
      // Broadcast to conversation participants
      socket.to(`call_${callId}`).emit('webrtc:offer', {
         senderId: socket.userId,
         offer,
         callId,
      });
   });

   socket.on('webrtc:answer', (data) => {
      const { callId, answer } = data;
      socket.to(`call_${callId}`).emit('webrtc:answer', {
         senderId: socket.userId,
         answer,
         callId,
      });
   });

   socket.on('webrtc:ice-candidate', (data) => {
      const { callId, candidate } = data;
      socket.to(`call_${callId}`).emit('webrtc:ice-candidate', {
         senderId: socket.userId,
         candidate,
         callId,
      });
   });

   // Join call room for WebRTC signaling
   socket.on('call:join_room', (data) => {
      const { callId } = data;
      socket.join(`call_${callId}`);
      console.log(`User ${socket.user.username} joined call room ${callId}`);
   });

   // Leave call room
   socket.on('call:leave_room', (data) => {
      const { callId } = data;
      socket.leave(`call_${callId}`);
      console.log(`User ${socket.user.username} left call room ${callId}`);
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
