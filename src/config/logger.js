const winston = require('winston');
const path = require('path');

// Tạo format custom cho log
const customFormat = winston.format.combine(
   winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
   }),
   winston.format.errors({ stack: true }),
   winston.format.printf(({ level, message, timestamp, stack }) => {
      if (stack) {
         return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
      }
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
   })
);

// Tạo format cho file JSON
const jsonFormat = winston.format.combine(
   winston.format.timestamp(),
   winston.format.errors({ stack: true }),
   winston.format.json()
);

// Tạo logger
const logger = winston.createLogger({
   level: process.env.LOG_LEVEL || 'info',
   format: jsonFormat,
   defaultMeta: { service: 'onway-backend' },
   transports: [
      // Log lỗi vào file riêng
      new winston.transports.File({
         filename: path.join(__dirname, '../../logs/error.log'),
         level: 'error',
         maxsize: 5242880, // 5MB
         maxFiles: 5,
      }),

      // Log tất cả vào file combined
      new winston.transports.File({
         filename: path.join(__dirname, '../../logs/combined.log'),
         maxsize: 5242880, // 5MB
         maxFiles: 5,
      }),
   ],
});

// Nếu không phải production, log ra console
if (process.env.NODE_ENV !== 'production') {
   logger.add(
      new winston.transports.Console({
         format: winston.format.combine(winston.format.colorize(), customFormat),
      })
   );
}

// Tạo stream để sử dụng với Morgan
logger.stream = {
   write: (message) => {
      logger.info(message.trim());
   },
};

module.exports = logger;
