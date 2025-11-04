const { HTTP_STATUS } = require('../constants/errors');

/**
 * Standard success response formatter
 */
const successResponse = (res, data = null, message = null, statusCode = HTTP_STATUS.OK) => {
   const response = {
      success: true,
   };

   if (message) {
      response.message = message;
   }

   if (data !== null) {
      response.data = data;
   }

   return res.status(statusCode).json(response);
};

/**
 * Standard error response formatter
 */
const errorResponse = (res, error, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) => {
   const response = {
      success: false,
      error: error,
   };

   return res.status(statusCode).json(response);
};

/**
 * Paginated response formatter
 */
const paginatedResponse = (res, data, pagination, message = null) => {
   const response = {
      success: true,
      data,
      pagination,
   };

   if (message) {
      response.message = message;
   }

   return res.status(HTTP_STATUS.OK).json(response);
};

module.exports = {
   successResponse,
   errorResponse,
   paginatedResponse,
};
