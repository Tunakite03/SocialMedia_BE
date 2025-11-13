# Otakomi Backend

A comprehensive social media platform backend built with Node.js, Express, PostgreSQL, Socket.IO, and FastAPI for sentiment analysis.

## 🚀 Features

-  **User Authentication & Management**: JWT-based authentication, user profiles, follow system
-  **Real-time Communication**: Socket.IO for real-time messaging, notifications, and status updates
-  **Social Features**: Posts, comments, reactions, and social interactions
-  **WebRTC Integration**: Voice and video calling capabilities
-  **AI-Powered Sentiment Analysis**: Python FastAPI service for analyzing text sentiment
-  **Database**: PostgreSQL with Prisma ORM for robust data management
-  **Real-time Features**: Live notifications, typing indicators, online status

## 🏗️ Architecture

The backend follows a microservices-inspired architecture:

-  **Node.js (Express)**: Main API server handling business logic, authentication, and data management
-  **PostgreSQL**: Primary database for storing all application data
-  **Socket.IO**: Real-time communication layer for instant messaging and notifications
-  **FastAPI (Python)**: Dedicated sentiment analysis service
-  **WebRTC**: Peer-to-peer communication for voice/video calls

## 📋 Prerequisites

-  Node.js 18+
-  PostgreSQL 14+
-  Python 3.8+ (for sentiment service)
-  npm or yarn

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd OnWay_BE
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/onway_db"

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# FastAPI Sentiment Service
SENTIMENT_SERVICE_URL=http://localhost:8000

# Other configurations...
```

### 4. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 5. Set up the Sentiment Analysis Service

```bash
cd sentiment-service
chmod +x start.sh
./start.sh
```

The sentiment service will be available at `http://localhost:8000`

### 6. Start the main server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The main API will be available at `http://localhost:3000`

## 📚 API Documentation

### Swagger/OpenAPI Documentation

The API is fully documented using Swagger/OpenAPI 3.0 specification.

**Access the interactive API documentation:**

-  **Development**: http://localhost:8080/api-docs
-  **Production**: https://your-domain.com/api-docs

The Swagger UI provides:

-  Interactive API testing
-  Complete endpoint documentation
-  Request/response examples
-  Authentication integration
-  Schema definitions

```bash
# View documentation URL
npm run docs
```

### Chat API Integration Guide

For detailed frontend integration examples and best practices for the chat/messaging system, see:

-  **[Chat API Specifications](chat-api-specifications.md)** - Complete guide for integrating chat functionality

### Authentication

All protected endpoints require JWT authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### API Endpoints Overview

#### Authentication Endpoints

-  `POST /api/v1/auth/register` - Register new user
-  `POST /api/v1/auth/login` - Login user
-  `POST /api/v1/auth/logout` - Logout user
-  `GET /api/v1/auth/profile` - Get current user profile
-  `PUT /api/v1/auth/profile` - Update user profile
-  `PUT /api/v1/auth/password` - Change password
-  `POST /api/v1/auth/forgot-password` - Request password reset
-  `POST /api/v1/auth/reset-password` - Reset password
-  `GET /api/v1/auth/verify` - Verify token

#### User Management

-  `GET /api/v1/users/search` - Search users
-  `GET /api/v1/users/{id}` - Get user by ID
-  `POST /api/v1/users/{id}/follow` - Follow user
-  `DELETE /api/v1/users/{id}/follow` - Unfollow user
-  `GET /api/v1/users/{id}/followers` - Get user followers
-  `GET /api/v1/users/{id}/following` - Get user following

#### Posts & Social Features

-  `GET /api/v1/posts/feed` - Get posts feed
-  `POST /api/v1/posts` - Create new post
-  `GET /api/v1/posts/{id}` - Get post by ID
-  `PUT /api/v1/posts/{id}` - Update post
-  `DELETE /api/v1/posts/{id}` - Delete post
-  `GET /api/v1/posts/user/{userId}` - Get user posts
-  `POST /api/v1/posts/{postId}/reactions` - Add reaction to post
-  `GET /api/v1/posts/{postId}/reactions` - Get post reactions

#### Comments

-  `GET /api/v1/comments/post/{postId}` - Get post comments
-  `POST /api/v1/comments/post/{postId}` - Create comment
-  `GET /api/v1/comments/{commentId}/replies` - Get comment replies
-  `PUT /api/v1/comments/{id}` - Update comment
-  `DELETE /api/v1/comments/{id}` - Delete comment
-  `POST /api/v1/comments/{commentId}/reactions` - Add reaction to comment

#### Notifications

-  `GET /api/v1/notifications` - Get user notifications
-  `PUT /api/v1/notifications/{id}/read` - Mark notification as read
-  `PUT /api/v1/notifications/read-all` - Mark all notifications as read

#### Messages & Communication

-  `GET /api/v1/messages/conversations` - Get user conversations
-  `POST /api/v1/messages/conversations` - Create conversation
-  `GET /api/v1/messages/conversations/{id}` - Get conversation messages
-  `POST /api/v1/messages/conversations/{id}` - Send message
-  `PUT /api/v1/messages/{id}/read` - Mark message as read

#### Calls

-  `POST /api/v1/calls/initiate` - Initiate call
-  `PUT /api/v1/calls/{id}/response` - Respond to call
-  `PUT /api/v1/calls/{id}/end` - End call
-  `GET /api/v1/calls/history` - Get call history

#### File Upload

-  `POST /api/v1/upload` - Upload file
-  `DELETE /api/v1/upload/{filename}` - Delete uploaded file

## 🔌 Socket.IO Events

### Client Events

-  `connection` - User connects
-  `disconnect` - User disconnects
-  `typing:start` - User starts typing
-  `typing:stop` - User stops typing
-  `message:send` - Send message
-  `message:read` - Mark message as read
-  `call:initiate` - Initiate call
-  `call:response` - Respond to call
-  `webrtc:offer` - WebRTC offer
-  `webrtc:answer` - WebRTC answer
-  `webrtc:ice-candidate` - ICE candidate

### Server Events

-  `user:online` - User comes online
-  `user:offline` - User goes offline
-  `message:new` - New message received
-  `message:read` - Message read receipt
-  `notification:new` - New notification
-  `post:new` - New post created
-  `comment:new` - New comment added
-  `call:incoming` - Incoming call
-  `typing:start` - User typing
-  `typing:stop` - User stopped typing

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Setup

```bash
# Build main application
docker build -t otakomi-backend .

# Build sentiment service
docker build -t otakomi-sentiment ./sentiment-service

# Run with docker
docker run -p 3000:3000 otakomi-backend
docker run -p 8000:8000 otakomi-sentiment
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

-  **Users**: User accounts and profiles
-  **Posts**: User posts with content and media
-  **Comments**: Post comments and replies
-  **Reactions**: Likes and other reactions
-  **Messages**: Private messages between users
-  **Conversations**: Chat conversations
-  **Notifications**: System notifications
-  **Calls**: Voice/video call records
-  **SentimentAnalysis**: AI sentiment analysis results

## 🔧 Configuration

### Environment Variables

| Variable                | Description                          | Default               |
| ----------------------- | ------------------------------------ | --------------------- |
| `NODE_ENV`              | Environment (development/production) | development           |
| `PORT`                  | Server port                          | 3000                  |
| `DATABASE_URL`          | PostgreSQL connection string         | -                     |
| `JWT_SECRET`            | JWT signing secret                   | -                     |
| `SENTIMENT_SERVICE_URL` | FastAPI service URL                  | http://localhost:8000 |
| `ALLOWED_ORIGINS`       | CORS allowed origins                 | http://localhost:3001 |

## 🚀 Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure production database
4. Set up SSL/TLS certificates
5. Configure reverse proxy (nginx)
6. Set up monitoring and logging
7. Configure backup strategy

### Performance Optimization

-  Database indexing for frequently queried fields
-  Redis caching for session management (optional)
-  CDN for static file delivery
-  Connection pooling for database
-  Rate limiting for API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

-  Create an issue on GitHub
-  Contact the development team

## 🔄 Version History

-  **v1.0.0** - Initial release with core features
   -  User authentication and management
   -  Real-time messaging with Socket.IO
   -  Posts and comments system
   -  AI-powered sentiment analysis
   -  WebRTC integration for calls
