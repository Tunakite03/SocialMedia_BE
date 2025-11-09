// server.js
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
const { swaggerUi, specs } = require('./config/swagger');

const app = express();
const server = createServer(app);

// ===== CORS allowed origins =====
const allowedOrigins =
   process.env.NODE_ENV === 'production'
      ? ['https://otakomi.netlify.app', 'http://localhost:3000'] // Hardcoded for production
      : process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : ['http://localhost:3000', 'http://localhost:3001', 'https://otakomi.netlify.app'];

// ===== Trust proxy for Render/Netlify =====
app.set('trust proxy', 1);

// ===== CORS đặt lên đầu tiên =====
const corsOptions = {
   origin(origin, callback) {
      logger.info(`CORS request from origin: ${origin}`);

      // Cho phép request không có Origin (curl, mobile app, health checks…)
      if (!origin) {
         logger.info('Request with no origin - allowing');
         return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
         logger.info(`Origin ${origin} is allowed`);
         return callback(null, true);
      }

      logger.warn(`CORS request blocked from origin: ${origin}`);
      logger.warn(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      return callback(new Error('Not allowed by CORS'));
   },
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization'],
   preflightContinue: false,
   optionsSuccessStatus: 200,
};

// Áp dụng CORS càng sớm càng tốt
app.use(cors(corsOptions));

// Handle preflight TOÀN CỤC trước mọi middleware khác
app.options('*', cors(corsOptions));

// (Tùy chọn) fail-safe: trả 200 thật nhanh cho OPTIONS, tránh dính các middleware khác
app.use((req, res, next) => {
   if (req.method === 'OPTIONS') return res.sendStatus(200);
   return next();
});

// ===== Security/Compression/Logging =====
app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));

// ===== Rate limit SAU CORS và bỏ qua OPTIONS =====
const limiter = rateLimit({
   windowMs: (Number(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // default 15 phút
   max: Number(process.env.RATE_LIMIT_MAX) || 100,
   standardHeaders: true,
   legacyHeaders: false,
   skip: (req) => req.method === 'OPTIONS',
   message: 'Too many requests from this IP, please try again later.',
});
// app.use(limiter);

// ===== Body parsers =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== Static files =====
app.use('/uploads', express.static('uploads'));

// ===== Socket.IO init =====
const io = new Server(server, {
   cors: {
      origin: process.env.NODE_ENV === 'production' ? ['https://otakomi.netlify.app'] : allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
   },
});
app.set('socketio', io);
socketHandler(io);

// ===== Health check =====
app.get('/health', (req, res) => {
   res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
   });
});

// ===== Swagger Documentation =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ===== API routes =====
app.use('/api/v1', require('./routes'));

// ===== Errors =====
app.use(notFound);
app.use(errorHandler);

// ===== DB & Cloudinary tests =====
const testDatabaseConnection = async () => {
   try {
      await prisma.$connect();
      logger.info('Database connected successfully');
      const userCount = await prisma.user.count();
      logger.info(`Database status: ${userCount} users in database`);
   } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
   }
};

const testConnections = async () => {
   await testDatabaseConnection();
   await testCloudinaryConnection();
};

// ===== Start server =====
const PORT = process.env.PORT || 8080;
server.listen(PORT, async () => {
   logger.info(`Server running on port ${PORT}`);
   logger.info(`Environment: ${process.env.NODE_ENV}`);
   logger.info('Socket.IO server ready');
   await testConnections();
});

// ===== Graceful shutdown =====
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
