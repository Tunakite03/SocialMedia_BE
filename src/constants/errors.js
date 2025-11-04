/**
 * Error constants for the application
 */

// HTTP Status Codes
const HTTP_STATUS = {
   OK: 200,
   CREATED: 201,
   BAD_REQUEST: 400,
   UNAUTHORIZED: 401,
   FORBIDDEN: 403,
   NOT_FOUND: 404,
   CONFLICT: 409,
   INTERNAL_SERVER_ERROR: 500,
};

// Error Messages
const ERROR_MESSAGES = {
   // Authentication Errors
   EMAIL_ALREADY_REGISTERED: 'Email already registered',
   USERNAME_ALREADY_TAKEN: 'Username already taken',
   INVALID_CREDENTIALS: 'Invalid email or password',
   ACCOUNT_DEACTIVATED: 'Account has been deactivated',
   USER_NOT_FOUND: 'User not found',
   CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
   TOKEN_INVALID: 'Invalid or expired token',
   TOKEN_MISSING: 'Access token is required',

   // Generic Errors
   INTERNAL_SERVER_ERROR: 'Internal server error',
   VALIDATION_ERROR: 'Validation error',
   UNAUTHORIZED_ACCESS: 'Unauthorized access',
   RESOURCE_NOT_FOUND: 'Resource not found',
};

// Success Messages
const SUCCESS_MESSAGES = {
   // Authentication
   USER_REGISTERED: 'User registered successfully',
   LOGIN_SUCCESSFUL: 'Login successful',
   LOGOUT_SUCCESSFUL: 'Logout successful',
   PROFILE_UPDATED: 'Profile updated successfully',
   PASSWORD_CHANGED: 'Password changed successfully',
   TOKEN_VERIFIED: 'Token verified successfully',

   // Generic
   OPERATION_SUCCESSFUL: 'Operation completed successfully',
   DATA_RETRIEVED: 'Data retrieved successfully',
};

// Custom Error Classes
class AppError extends Error {
   constructor(message, statusCode, code = null) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.isOperational = true;

      Error.captureStackTrace(this, this.constructor);
   }
}

class ValidationError extends AppError {
   constructor(message, details = null) {
      super(message, HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR');
      this.details = details;
   }
}

class AuthenticationError extends AppError {
   constructor(message = ERROR_MESSAGES.INVALID_CREDENTIALS) {
      super(message, HTTP_STATUS.UNAUTHORIZED, 'AUTHENTICATION_ERROR');
   }
}

class NotFoundError extends AppError {
   constructor(message = ERROR_MESSAGES.RESOURCE_NOT_FOUND) {
      super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND_ERROR');
   }
}

class ConflictError extends AppError {
   constructor(message) {
      super(message, HTTP_STATUS.CONFLICT, 'CONFLICT_ERROR');
   }
}

module.exports = {
   HTTP_STATUS,
   ERROR_MESSAGES,
   SUCCESS_MESSAGES,
   AppError,
   ValidationError,
   AuthenticationError,
   NotFoundError,
   ConflictError,
};
