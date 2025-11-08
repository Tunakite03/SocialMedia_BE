const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
   definition: {
      openapi: '3.0.0',
      info: {
         title: 'OnWay Social Media API',
         version: '1.0.0',
         description: 'Backend API for OnWay social media platform with real-time features',
         contact: {
            name: 'OnWay Team',
            email: 'support@onway.com',
         },
      },
      servers: [
         {
            url: 'http://localhost:8080/api/v1',
            description: 'Development server',
         },
         {
            url: 'https://onway-backend.onrender.com/api/v1',
            description: 'Production server',
         },
      ],
      components: {
         securitySchemes: {
            bearerAuth: {
               type: 'http',
               scheme: 'bearer',
               bearerFormat: 'JWT',
            },
         },
         schemas: {
            User: {
               type: 'object',
               properties: {
                  id: {
                     type: 'string',
                     format: 'uuid',
                     description: 'Unique user identifier',
                  },
                  email: {
                     type: 'string',
                     format: 'email',
                     description: 'User email address',
                  },
                  username: {
                     type: 'string',
                     description: 'Unique username',
                  },
                  displayName: {
                     type: 'string',
                     description: 'Display name',
                  },
                  avatar: {
                     type: 'string',
                     description: 'Avatar URL',
                  },
                  bio: {
                     type: 'string',
                     description: 'User biography',
                  },
                  dateOfBirth: {
                     type: 'string',
                     format: 'date',
                     description: 'Date of birth',
                  },
                  role: {
                     type: 'string',
                     enum: ['USER', 'ADMIN', 'MODERATOR'],
                     default: 'USER',
                  },
                  isOnline: {
                     type: 'boolean',
                     description: 'Online status',
                  },
                  lastSeen: {
                     type: 'string',
                     format: 'date-time',
                     description: 'Last seen timestamp',
                  },
                  createdAt: {
                     type: 'string',
                     format: 'date-time',
                     description: 'Account creation timestamp',
                  },
               },
            },
            Post: {
               type: 'object',
               properties: {
                  id: {
                     type: 'string',
                     format: 'uuid',
                  },
                  content: {
                     type: 'string',
                     description: 'Post content',
                  },
                  type: {
                     type: 'string',
                     enum: ['TEXT', 'IMAGE', 'VIDEO'],
                     default: 'TEXT',
                  },
                  mediaUrl: {
                     type: 'string',
                     description: 'Media URL for image/video posts',
                  },
                  isPublic: {
                     type: 'boolean',
                     default: true,
                  },
                  authorId: {
                     type: 'string',
                     format: 'uuid',
                  },
                  createdAt: {
                     type: 'string',
                     format: 'date-time',
                  },
                  updatedAt: {
                     type: 'string',
                     format: 'date-time',
                  },
               },
            },
            Comment: {
               type: 'object',
               properties: {
                  id: {
                     type: 'string',
                     format: 'uuid',
                  },
                  content: {
                     type: 'string',
                  },
                  postId: {
                     type: 'string',
                     format: 'uuid',
                  },
                  authorId: {
                     type: 'string',
                     format: 'uuid',
                  },
                  parentId: {
                     type: 'string',
                     format: 'uuid',
                     nullable: true,
                  },
                  createdAt: {
                     type: 'string',
                     format: 'date-time',
                  },
                  updatedAt: {
                     type: 'string',
                     format: 'date-time',
                  },
               },
            },
            Notification: {
               type: 'object',
               properties: {
                  id: {
                     type: 'string',
                     format: 'uuid',
                  },
                  type: {
                     type: 'string',
                     enum: ['LIKE', 'COMMENT', 'FOLLOW', 'MESSAGE', 'CALL', 'MENTION'],
                  },
                  title: {
                     type: 'string',
                  },
                  message: {
                     type: 'string',
                  },
                  isRead: {
                     type: 'boolean',
                     default: false,
                  },
                  receiverId: {
                     type: 'string',
                     format: 'uuid',
                  },
                  senderId: {
                     type: 'string',
                     format: 'uuid',
                     nullable: true,
                  },
                  entityId: {
                     type: 'string',
                     format: 'uuid',
                     nullable: true,
                  },
                  entityType: {
                     type: 'string',
                     nullable: true,
                  },
                  createdAt: {
                     type: 'string',
                     format: 'date-time',
                  },
               },
            },
            Error: {
               type: 'object',
               properties: {
                  success: {
                     type: 'boolean',
                     example: false,
                  },
                  error: {
                     type: 'object',
                     properties: {
                        message: {
                           type: 'string',
                        },
                        statusCode: {
                           type: 'integer',
                        },
                     },
                  },
               },
            },
            Success: {
               type: 'object',
               properties: {
                  success: {
                     type: 'boolean',
                     example: true,
                  },
                  message: {
                     type: 'string',
                  },
                  data: {
                     type: 'object',
                  },
               },
            },
            PaginatedResponse: {
               type: 'object',
               properties: {
                  success: {
                     type: 'boolean',
                     example: true,
                  },
                  data: {
                     type: 'object',
                  },
                  pagination: {
                     type: 'object',
                     properties: {
                        limit: {
                           type: 'integer',
                        },
                        offset: {
                           type: 'integer',
                        },
                        hasMore: {
                           type: 'boolean',
                        },
                        nextCursor: {
                           type: 'string',
                           nullable: true,
                        },
                     },
                  },
               },
            },
         },
      },
      security: [
         {
            bearerAuth: [],
         },
      ],
   },
   apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const specs = swaggerJSDoc(options);

module.exports = {
   swaggerUi,
   specs,
};
