const Logger = require('../utils/logger');
const {
   authenticateSocket,
   handleConnection,
   handleDisconnection,
   handleTyping,
   handleConversations,
   handleMessaging,
   handleNotifications,
   handleWebRTC,
} = require('./socketUtils');

/**
 * Initialize Socket.IO server with all event handlers
 */
const socketHandler = (io) => {
   // Authentication middleware
   io.use(authenticateSocket);

   // Handle connections
   io.on('connection', async (socket) => {
      Logger.logSocket('connection', socket.id, { userId: socket.user?.id });

      // Log all WebRTC events for debugging
      if (process.env.NODE_ENV !== 'production') {
         socket.onAny((event, ...args) => {
            if (event.includes('webrtc') || event.includes('call:')) {
               console.log(`📡 [Socket Event] ${socket.id} -> ${event}`, {
                  userId: socket.user?.id,
                  timestamp: new Date().toISOString(),
                  data: args[0],
               });
            }
         });
      }

      // Handle user connection
      await handleConnection(socket);

      // Set up event handlers
      handleTyping(socket);
      handleConversations(socket);
      handleMessaging(socket, io);
      handleNotifications(socket, io);
      handleWebRTC(socket, io);

      // Handle disconnection
      socket.on('disconnect', async () => {
         Logger.logSocket('disconnect', socket.id, { userId: socket.user?.id });
         await handleDisconnection(socket);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
         socket.emit('pong');
      });

      // Handle errors
      socket.on('error', (error) => {
         Logger.error(`Socket error for ${socket.id}:`, error);
      });
   });

   // Handle global events
   io.on('error', (error) => {
      Logger.error('Socket.IO server error:', error);
   });

   Logger.info('Socket.IO server initialized successfully');
};

module.exports = socketHandler;
