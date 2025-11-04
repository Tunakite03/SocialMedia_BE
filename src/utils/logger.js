const logger = require('../config/logger');

/**
 * Wrapper cho các hàm log thường dùng
 */
class Logger {
   /**
    * Log thông tin
    * @param {string} message - Thông điệp log
    * @param {object} meta - Metadata bổ sung
    */
   static info(message, meta = {}) {
      logger.info(message, meta);
   }

   /**
    * Log lỗi
    * @param {string} message - Thông điệp lỗi
    * @param {Error|object} error - Error object hoặc metadata
    */
   static error(message, error = {}) {
      if (error instanceof Error) {
         logger.error(message, { error: error.stack });
      } else {
         logger.error(message, error);
      }
   }

   /**
    * Log cảnh báo
    * @param {string} message - Thông điệp cảnh báo
    * @param {object} meta - Metadata bổ sung
    */
   static warn(message, meta = {}) {
      logger.warn(message, meta);
   }

   /**
    * Log debug (chỉ hiển thị trong development)
    * @param {string} message - Thông điệp debug
    * @param {object} meta - Metadata bổ sung
    */
   static debug(message, meta = {}) {
      logger.debug(message, meta);
   }

   /**
    * Log HTTP request
    * @param {object} req - Express request object
    * @param {object} res - Express response object
    * @param {string} action - Hành động thực hiện
    */
   static logRequest(req, res, action = 'Request') {
      logger.info(`${action} - ${req.method} ${req.originalUrl}`, {
         method: req.method,
         url: req.originalUrl,
         ip: req.ip,
         userAgent: req.get('User-Agent'),
         userId: req.user?.id,
         statusCode: res.statusCode,
         responseTime: res.get('X-Response-Time'),
      });
   }

   /**
    * Log database operation
    * @param {string} operation - Loại operation (CREATE, UPDATE, DELETE, etc.)
    * @param {string} table - Tên bảng
    * @param {object} data - Dữ liệu liên quan
    */
   static logDatabase(operation, table, data = {}) {
      logger.info(`Database ${operation}`, {
         operation,
         table,
         data,
         timestamp: new Date().toISOString(),
      });
   }

   /**
    * Log authentication event
    * @param {string} event - Loại event (login, logout, register, etc.)
    * @param {object} user - User info
    * @param {string} ip - IP address
    */
   static logAuth(event, user = {}, ip = '') {
      logger.info(`Auth ${event}`, {
         event,
         userId: user.id,
         email: user.email,
         ip,
         timestamp: new Date().toISOString(),
      });
   }

   /**
    * Log socket event
    * @param {string} event - Socket event name
    * @param {string} socketId - Socket ID
    * @param {object} data - Event data
    */
   static logSocket(event, socketId, data = {}) {
      logger.info(`Socket ${event}`, {
         event,
         socketId,
         data,
         timestamp: new Date().toISOString(),
      });
   }
}

module.exports = Logger;
