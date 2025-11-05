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

### Authentication Endpoints

-  `POST /api/auth/register` - Register new user
-  `POST /api/auth/login` - Login user
-  `POST /api/auth/logout` - Logout user
-  `GET /api/auth/profile` - Get current user profile
-  `PUT /api/auth/profile` - Update user profile
-  `PUT /api/auth/password` - Change password

### User Endpoints

-  `GET /api/users/search` - Search users
-  `GET /api/users/:id` - Get user by ID
-  `POST /api/users/:id/follow` - Follow user
-  `DELETE /api/users/:id/follow` - Unfollow user
-  `GET /api/users/:id/followers` - Get user followers
-  `GET /api/users/:id/following` - Get user following

### Post Endpoints

-  `GET /api/posts/feed` - Get posts feed
-  `POST /api/posts` - Create new post
-  `GET /api/posts/:id` - Get post by ID
-  `PUT /api/posts/:id` - Update post
-  `DELETE /api/posts/:id` - Delete post
-  `GET /api/posts/user/:userId` - Get user posts
-  `POST /api/posts/:postId/reactions` - Add reaction to post
-  `GET /api/posts/:postId/reactions` - Get post reactions

### Comment Endpoints

-  `GET /api/comments/post/:postId` - Get post comments
-  `POST /api/comments/post/:postId` - Create comment
-  `GET /api/comments/:commentId/replies` - Get comment replies
-  `PUT /api/comments/:id` - Update comment
-  `DELETE /api/comments/:id` - Delete comment
-  `POST /api/comments/:commentId/reactions` - Add reaction to comment

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
