const { AppError, HTTP_STATUS } = require('../constants/errors');
const logger = require('../config/logger');

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
   logger.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      code: err.code,
      statusCode: err.statusCode,
   });

   let error = {
      message: err.message || 'Internal Server Error',
      status: err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
   };

   // Handle custom AppError instances
   if (err.isOperational) {
      error.message = err.message;
      error.status = err.statusCode;

      // Include validation details if available
      if (err.details) {
         error.details = err.details;
      }
   }
   // Prisma validation errors
   else if (err.code === 'P2002') {
      error.message = 'Duplicate field value entered';
      error.status = HTTP_STATUS.BAD_REQUEST;
   } else if (err.code === 'P2014') {
      error.message = 'Invalid ID provided';
      error.status = HTTP_STATUS.BAD_REQUEST;
   } else if (err.code === 'P2003') {
      error.message = 'Invalid input data';
      error.status = HTTP_STATUS.BAD_REQUEST;
   } else if (err.code === 'P2025') {
      error.message = 'Record not found';
      error.status = HTTP_STATUS.NOT_FOUND;
   }
   // JWT errors
   else if (err.name === 'JsonWebTokenError') {
      error.message = 'Invalid token';
      error.status = HTTP_STATUS.UNAUTHORIZED;
   } else if (err.name === 'TokenExpiredError') {
      error.message = 'Token expired';
      error.status = HTTP_STATUS.UNAUTHORIZED;
   }
   // Validation errors
   else if (err.name === 'ValidationError') {
      error.message = Object.values(err.errors).map((val) => val.message);
      error.status = HTTP_STATUS.BAD_REQUEST;
   }
   // Multer errors (file upload)
   else if (err.code === 'LIMIT_FILE_SIZE') {
      error.message = 'File too large';
      error.status = HTTP_STATUS.BAD_REQUEST;
   } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error.message = 'Invalid file field';
      error.status = HTTP_STATUS.BAD_REQUEST;
   }

   const response = {
      success: false,
      error: error.message,
   };

   // Include additional details in development
   if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
      response.code = err.code;
   }

   // Include validation details if available
   if (error.details) {
      response.details = error.details;
   }

   res.status(error.status).json(response);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
   const error = new AppError(`Not Found - ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND);
   next(error);
};

module.exports = {
   errorHandler,
   notFound,
};
