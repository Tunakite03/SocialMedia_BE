const Joi = require('joi');

/**
 * Validation middleware factory
 */
const validate = (schema) => {
   return (req, res, next) => {
      const { error } = schema.validate(req.body);

      if (error) {
         const details = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
         }));

         return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details,
         });
      }

      next();
   };
};

/**
 * Validation schemas
 */
const schemas = {
   // User registration
   register: Joi.object({
      email: Joi.string().email().required(),
      username: Joi.string().alphanum().min(3).max(30).required(),
      password: Joi.string().min(6).required(),
      displayName: Joi.string().min(1).max(100).required(),
      dateOfBirth: Joi.date().iso().optional(),
      bio: Joi.string().max(500).optional(),
   }),

   // User login
   login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
   }),

   // Password reset request
   forgotPassword: Joi.object({
      email: Joi.string().email().required(),
   }),

   // Reset password
   resetPassword: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
   }),

   // Update profile
   updateProfile: Joi.object({
      displayName: Joi.string().min(1).max(100).optional(),
      bio: Joi.string().max(500).allow('').optional(),
      dateOfBirth: Joi.date().iso().optional(),
   }),

   // Change password
   changePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
   }),

   // Refresh token
   refreshToken: Joi.object({
      refreshToken: Joi.string().required(),
   }),

   // Create post
   createPost: Joi.object({
      content: Joi.string().max(2000).allow('').optional(),
      type: Joi.string().valid('TEXT', 'IMAGE', 'VIDEO').default('TEXT'),
      isPublic: Joi.boolean().default(true),
   }),

   // Update post
   updatePost: Joi.object({
      content: Joi.string().max(2000).optional(),
      isPublic: Joi.boolean().optional(),
   }),

   // Create comment
   createComment: Joi.object({
      content: Joi.string().max(1000).required(),
      parentId: Joi.string().uuid().optional(),
   }),

   // Update comment
   updateComment: Joi.object({
      content: Joi.string().max(1000).required(),
   }),

   // Send message
   sendMessage: Joi.object({
      content: Joi.string().max(1000).required(),
      type: Joi.string().valid('TEXT', 'IMAGE', 'FILE', 'VOICE').default('TEXT'),
      receiverId: Joi.string().uuid().required(),
   }),

   // Create conversation
   createConversation: Joi.object({
      participantIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
      name: Joi.string().max(100).optional(),
      type: Joi.string().valid('DIRECT', 'GROUP').default('DIRECT'),
   }),

   // Add reaction
   addReaction: Joi.object({
      type: Joi.string().valid('LIKE', 'LOVE', 'LAUGH', 'ANGRY', 'SAD', 'WOW').required(),
   }),
};

module.exports = {
   validate,
   schemas,
};
