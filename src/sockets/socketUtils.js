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

   console.log(`User ${user.username} connected (${socket.id})`);

   // Join user to their personal room
   socket.join(`user:${userId}`);

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
      await prisma.user.update({
         where: { id: userId },
         data: {
            isOnline: false,
            lastSeen: new Date(),
         },
      });

      console.log(`User ${user?.username} disconnected (${socket.id})`);

      // Notify friends about offline status
      socket.broadcast.emit('user:offline', {
         userId: userId,
         lastSeen: new Date(),
      });
   }
};

/**
 * Handle typing indicators
 */
const handleTyping = (socket) => {
   socket.on('typing:start', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
         userId: socket.userId,
         user: socket.user,
         conversationId,
      });
   });

   socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
         userId: socket.userId,
         conversationId,
      });
   });
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
            socket.join(`conversation:${conversationId}`);
            console.log(`User ${socket.user.username} joined conversation ${conversationId}`);
         }
      } catch (error) {
         console.error('Error joining conversation:', error);
      }
   });

   // Leave conversation room
   socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.user.username} left conversation ${conversationId}`);
   });
};

/**
 * Handle real-time messaging
 */
const handleMessaging = (socket, io) => {
   socket.on('message:send', async (data) => {
      try {
         const { conversationId, content, type = 'TEXT', receiverId } = data;

         // Create message in database
         const message = await prisma.message.create({
            data: {
               content,
               type,
               conversationId,
               senderId: socket.userId,
               receiverId,
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
               receiver: {
                  select: {
                     id: true,
                     username: true,
                     displayName: true,
                     avatar: true,
                  },
               },
            },
         });

         // Emit to conversation room
         io.to(`conversation:${conversationId}`).emit('message:new', message);

         // If direct message, also emit to receiver's personal room
         if (receiverId) {
            io.to(`user:${receiverId}`).emit('message:received', message);
         }

         console.log(`Message sent in conversation ${conversationId}`);
      } catch (error) {
         console.error('Error sending message:', error);
         socket.emit('message:error', { error: 'Failed to send message' });
      }
   });

   // Mark message as read
   socket.on('message:read', async (data) => {
      try {
         const { messageId } = data;

         await prisma.message.update({
            where: { id: messageId },
            data: {
               isRead: true,
               readAt: new Date(),
            },
         });

         // Notify sender about read receipt
         const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: { senderId: true, conversationId: true },
         });

         if (message) {
            io.to(`user:${message.senderId}`).emit('message:read', {
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

         console.log(`Notification sent to user ${receiverId}`);
      } catch (error) {
         console.error('Error sending notification:', error);
      }
   });
};

/**
 * Handle WebRTC signaling for calls
 */
const handleWebRTC = (socket, io) => {
   // Call initiation
   socket.on('call:initiate', async (data) => {
      try {
         const { receiverId, type = 'VOICE' } = data;

         // Create call record
         const call = await prisma.call.create({
            data: {
               type,
               callerId: socket.userId,
               receiverId,
               status: 'PENDING',
            },
            include: {
               caller: {
                  select: {
                     id: true,
                     username: true,
                     displayName: true,
                     avatar: true,
                  },
               },
            },
         });

         // Send call invitation to receiver
         io.to(`user:${receiverId}`).emit('call:incoming', {
            call,
            caller: call.caller,
         });

         // Confirm call initiation to caller
         socket.emit('call:initiated', { callId: call.id });

         console.log(`Call initiated by ${socket.user.username} to user ${receiverId}`);
      } catch (error) {
         console.error('Error initiating call:', error);
         socket.emit('call:error', { error: 'Failed to initiate call' });
      }
   });

   // Call response (accept/decline)
   socket.on('call:response', async (data) => {
      try {
         const { callId, accepted } = data;

         const call = await prisma.call.update({
            where: { id: callId },
            data: {
               status: accepted ? 'ONGOING' : 'MISSED',
               startedAt: accepted ? new Date() : null,
            },
         });

         // Notify caller about response
         io.to(`user:${call.callerId}`).emit('call:response', {
            callId,
            accepted,
            status: call.status,
         });

         if (accepted) {
            console.log(`Call ${callId} accepted`);
         } else {
            console.log(`Call ${callId} declined`);
         }
      } catch (error) {
         console.error('Error responding to call:', error);
      }
   });

   // WebRTC signaling events
   socket.on('webrtc:offer', (data) => {
      const { receiverId, offer, callId } = data;
      io.to(`user:${receiverId}`).emit('webrtc:offer', {
         senderId: socket.userId,
         offer,
         callId,
      });
   });

   socket.on('webrtc:answer', (data) => {
      const { senderId, answer, callId } = data;
      io.to(`user:${senderId}`).emit('webrtc:answer', {
         receiverId: socket.userId,
         answer,
         callId,
      });
   });

   socket.on('webrtc:ice-candidate', (data) => {
      const { targetId, candidate, callId } = data;
      io.to(`user:${targetId}`).emit('webrtc:ice-candidate', {
         senderId: socket.userId,
         candidate,
         callId,
      });
   });

   // Call end
   socket.on('call:end', async (data) => {
      try {
         const { callId } = data;

         const call = await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'ENDED',
               endedAt: new Date(),
               duration: call.startedAt ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000) : null,
            },
         });

         // Notify other participant
         const otherUserId = call.callerId === socket.userId ? call.receiverId : call.callerId;
         io.to(`user:${otherUserId}`).emit('call:ended', { callId });

         console.log(`Call ${callId} ended`);
      } catch (error) {
         console.error('Error ending call:', error);
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
