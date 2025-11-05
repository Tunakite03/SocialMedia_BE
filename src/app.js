const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');
const socketHandler = require('./sockets/socketHandler');
const prisma = require('./config/database');
const { testCloudinaryConnection } = require('./config/cloudinary');

const app = express();
const server = createServer(app);

// Socket.IO setup
const allowedOrigins = process.env.ALLOWED_ORIGINS
   ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
   : ['http://localhost:3000', 'http://localhost:3001', 'https://otakomi.netlify.app'];

const io = new Server(server, {
   cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
   },
});

// Rate limiting
const limiter = rateLimit({
   windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
   max: process.env.RATE_LIMIT_MAX || 100,
   message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));
app.use(limiter);

// Handle preflight requests for private network access (before CORS)
app.use((req, res, next) => {
   const origin = req.get('origin');
   if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Private-Network', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
         return res.status(200).send();
      }
   }
   next();
});

app.use(
   cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 200,
   })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Make io accessible to routes
app.set('socketio', io);

// Health check
app.get('/health', (req, res) => {
   res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
   });
});

// API routes
app.use('/api/v1', require('./routes'));

// Socket handling
socketHandler(io);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

// Test database connection
const testDatabaseConnection = async () => {
   try {
      await prisma.$connect();
      logger.info('Database connected successfully');

      // Test a simple query
      const userCount = await prisma.user.count();
      logger.info(`Database status: ${userCount} users in database`);
   } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
   }
};

// Test Cloudinary connection
const testConnections = async () => {
   await testDatabaseConnection();
   await testCloudinaryConnection();
};

server.listen(PORT, async () => {
   logger.info(`Server running on port ${PORT}`);
   logger.info(`Environment: ${process.env.NODE_ENV}`);
   logger.info(`Socket.IO server ready`);

   // Test connections
   await testConnections();
});

// Graceful shutdown
process.on('SIGINT', async () => {
   logger.info('Shutting down server...');
   await prisma.$disconnect();
   logger.info('Database disconnected');
   process.exit(0);
});

process.on('SIGTERM', async () => {
   logger.info('Shutting down server...');
   await prisma.$disconnect();
   logger.info('Database disconnected');
   process.exit(0);
});

module.exports = app;
