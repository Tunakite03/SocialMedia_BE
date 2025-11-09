# OnWay Backend API Specifications

**Version:** 1.3.0  
**Last Updated:** November 10, 2025  
**Base URL:** `http://localhost:8080/api/v1` (Development) | `https://otakomi-backend.onrender.com/api/v1` (Production)  
**Socket.IO:** `ws://localhost:8080` (Development) | `wss://otakomi-backend.onrender.com` (Production)

## Changelog

### Version 1.3.0 (November 10, 2025)

-  ✅ **Enhanced Authentication with Refresh Tokens**
   -  POST `/auth/refresh`: Exchange refresh token for new access and refresh tokens
   -  Updated login and register endpoints to return both access and refresh tokens
   -  Enhanced logout to invalidate refresh tokens for security
   -  Token rotation: Each refresh generates new access AND refresh tokens
   -  Improved security with short-lived access tokens (15 minutes) and long-lived refresh tokens (7 days)
   -  Backward compatible with existing JWT token authentication

### Version 1.2.0 (November 8, 2025)

-  ✅ **Complete Notification API Implementation**
   -  GET `/notifications`: Retrieve paginated user notifications with cursor-based pagination
   -  PUT `/notifications/{id}/read`: Mark specific notification as read
   -  PUT `/notifications/read-all`: Mark all user notifications as read
   -  Real-time notification delivery via Socket.IO events
   -  Automatic notification creation for likes, comments, follows, and mentions
   -  Comprehensive notification types: LIKE, COMMENT, FOLLOW, MESSAGE, CALL, MENTION
   -  Notification metadata including sender info, entity references, and timestamps

### Version 1.1.0 (November 8, 2025)

-  ✅ **Enhanced Post Creation & Updates with Image Upload**
   -  Support for multipart/form-data uploads in POST `/posts` and PUT `/posts/{id}`
   -  Auto-detection of post type based on uploaded media
   -  Flexible validation: content or media required (not both)
   -  Automatic Cloudinary integration with image optimization
   -  Media cleanup on post updates and deletions
-  ✅ **Updated API Documentation**
   -  Comprehensive examples for image upload scenarios
   -  Frontend integration guidelines and code samples
   -  Media management best practices
   -  Error handling for file uploads

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Management](#2-user-management)
3. [Posts](#3-posts)
4. [Comments](#4-comments)
5. [Reactions](#5-reactions)
6. [Notifications](#6-notifications)
7. [Upload](#7-upload)
8. [Real-time Features (Socket.IO)](#8-real-time-features-socketio)
9. [Sentiment Analysis Service](#9-sentiment-analysis-service)
10.   [Error Responses](#10-error-responses)
11.   [Data Models](#11-data-models)

---

## 1. Authentication

### 1.1 Register User

-  **Endpoint:** `POST /auth/register`
-  **Description:** Create a new user account
-  **Authentication:** None required

**Request Body:**

```json
{
   "email": "john.doe@example.com",
   "username": "johndoe",
   "password": "password123",
   "displayName": "John Doe",
   "dateOfBirth": "1990-01-01", // Optional
   "bio": "Software Developer" // Optional
}
```

**Response (201):**

```json
{
   "success": true,
   "message": "User registered successfully",
   "data": {
      "user": {
         "id": "uuid",
         "email": "john.doe@example.com",
         "username": "johndoe",
         "displayName": "John Doe",
         "avatar": null,
         "bio": "Software Developer",
         "role": "USER",
         "isOnline": false,
         "emailVerified": false,
         "createdAt": "2023-11-05T10:30:00Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
   }
}
```

### 1.2 Login User

-  **Endpoint:** `POST /auth/login`
-  **Description:** Authenticate user and receive JWT token
-  **Authentication:** None required

**Request Body:**

```json
{
   "email": "john.doe@example.com",
   "password": "password123"
}
```

**Response (200):**

```json
{
   "success": true,
   "message": "Login successful",
   "data": {
      "user": {
         "id": "uuid",
         "email": "john.doe@example.com",
         "username": "johndoe",
         "displayName": "John Doe",
         "avatar": "https://cloudinary.com/avatar.jpg",
         "role": "USER",
         "isOnline": true,
         "lastSeen": "2023-11-05T10:30:00Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
   }
}
```

### 1.3 Refresh Token

-  **Endpoint:** `POST /auth/refresh`
-  **Description:** Refresh access token using a valid refresh token
-  **Authentication:** None required (uses refresh token for authentication)

**Request Body:**

```json
{
   "refreshToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
}
```

**Response (200):**

```json
{
   "success": true,
   "message": "Token refreshed successfully",
   "data": {
      "user": {
         "id": "uuid",
         "email": "john.doe@example.com",
         "username": "johndoe",
         "displayName": "John Doe",
         "avatar": "https://cloudinary.com/avatar.jpg",
         "role": "USER",
         "isOnline": true,
         "lastSeen": "2023-11-05T10:30:00Z",
         "createdAt": "2023-01-01T00:00:00Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1"
   }
}
```

**Error Response (401):**

```json
{
   "success": false,
   "error": "Invalid or expired refresh token"
}
```

### 1.4 Logout User

-  **Endpoint:** `POST /auth/logout`
-  **Description:** Logout user and invalidate session (clears refresh token)
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "Logout successful"
}
```

### 1.5 Get User Profile

-  **Endpoint:** `GET /auth/profile`
-  **Description:** Get current user's profile information
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "data": {
      "user": {
         "id": "uuid",
         "email": "john.doe@example.com",
         "username": "johndoe",
         "displayName": "John Doe",
         "avatar": "https://cloudinary.com/avatar.jpg",
         "bio": "Software Developer",
         "dateOfBirth": "1990-01-01",
         "role": "USER",
         "isOnline": true,
         "lastSeen": "2023-11-05T10:30:00Z",
         "emailVerified": true,
         "createdAt": "2023-01-01T00:00:00Z"
      }
   }
}
```

### 1.6 Update User Profile

-  **Endpoint:** `PUT /auth/profile`
-  **Description:** Update current user's profile
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "displayName": "John Doe Updated", // Optional
   "bio": "Updated bio", // Optional
   "dateOfBirth": "1990-01-01" // Optional
}
```

### 1.7 Change Password

-  **Endpoint:** `PUT /auth/password`
-  **Description:** Change user's password
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "currentPassword": "oldpassword123",
   "newPassword": "newpassword123"
}
```

### 1.8 Verify Token

-  **Endpoint:** `GET /auth/verify`
-  **Description:** Verify if current token is valid
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "Token verified successfully",
   "data": {
      "user": {
         "id": "uuid",
         "username": "johndoe",
         "displayName": "John Doe",
         "role": "USER"
      }
   }
}
```

---

## 2. User Management

### 2.1 Search Users

-  **Endpoint:** `GET /users/search`
-  **Description:** Search for users by username or display name
-  **Authentication:** Optional (additional data if authenticated)

**Query Parameters:**

-  `q` (required): Search query string
-  `limit` (optional): Number of results (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "users": [
         {
            "id": "uuid",
            "username": "johndoe",
            "displayName": "John Doe",
            "avatar": "https://cloudinary.com/avatar.jpg",
            "bio": "Software Developer",
            "isOnline": true,
            "_count": {
               "followers": 150,
               "following": 89
            }
         }
      ]
   },
   "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1
   }
}
```

### 2.2 Get User by ID

-  **Endpoint:** `GET /users/{id}`
-  **Description:** Get user information by user ID
-  **Authentication:** Optional (shows if current user follows this user)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "user": {
         "id": "uuid",
         "username": "johndoe",
         "displayName": "John Doe",
         "avatar": "https://cloudinary.com/avatar.jpg",
         "bio": "Software Developer",
         "isOnline": true,
         "lastSeen": "2023-11-05T10:30:00Z",
         "createdAt": "2023-01-01T00:00:00Z",
         "_count": {
            "posts": 42,
            "followers": 150,
            "following": 89
         },
         "isFollowing": true // Only if authenticated
      }
   }
}
```

### 2.3 Follow User

-  **Endpoint:** `POST /users/{id}/follow`
-  **Description:** Follow another user
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "User followed successfully"
}
```

### 2.4 Unfollow User

-  **Endpoint:** `DELETE /users/{id}/follow`
-  **Description:** Unfollow a user
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "User unfollowed successfully"
}
```

### 2.5 Get User Followers

-  **Endpoint:** `GET /users/{id}/followers`
-  **Description:** Get list of users following this user
-  **Authentication:** None required

**Query Parameters:**

-  `limit` (optional): Number of results (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "followers": [
         {
            "id": "uuid",
            "username": "follower1",
            "displayName": "Follower One",
            "avatar": "https://cloudinary.com/avatar.jpg",
            "bio": "User bio",
            "isOnline": false
         }
      ]
   },
   "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 150
   }
}
```

### 2.6 Get User Following

-  **Endpoint:** `GET /users/{id}/following`
-  **Description:** Get list of users this user is following
-  **Authentication:** None required

**Query Parameters:**

-  `limit` (optional): Number of results (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "following": [
         {
            "id": "uuid",
            "username": "following1",
            "displayName": "Following One",
            "avatar": "https://cloudinary.com/avatar.jpg",
            "bio": "User bio",
            "isOnline": true
         }
      ]
   },
   "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 89
   }
}
```

---

## 3. Posts

### 3.1 Get Feed

-  **Endpoint:** `GET /posts/feed`
-  **Description:** Get posts feed with public posts
-  **Authentication:** Optional (shows user's reactions if authenticated)

**Query Parameters:**

-  `limit` (optional): Number of posts (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)
-  `type` (optional): Filter by post type (`TEXT`, `IMAGE`, `VIDEO`, `all`)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "posts": [
         {
            "id": "uuid",
            "content": "This is my first post!",
            "type": "TEXT",
            "mediaUrl": null,
            "isPublic": true,
            "author": {
               "id": "uuid",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "userReaction": "LIKE", // Current user's reaction (if authenticated)
            "_count": {
               "comments": 5,
               "reactions": 12
            },
            "createdAt": "2023-11-05T10:30:00Z",
            "updatedAt": "2023-11-05T10:30:00Z"
         }
      ],
      "pagination": {
         "limit": 10,
         "offset": 0,
         "hasMore": true
      }
   }
}
```

### 3.2 Create Post

-  **Endpoint:** `POST /posts`
-  **Description:** Create a new post (supports text and image uploads)
-  **Authentication:** Bearer token required
-  **Content-Type:** `multipart/form-data` (for image uploads) or `application/json` (for text-only posts)

#### Request (Text-only post):

```json
{
   "content": "This is my first post!",
   "type": "TEXT", // Optional: TEXT, IMAGE, VIDEO (default: TEXT)
   "isPublic": true // Optional: default true
}
```

#### Request (Post with image - multipart/form-data):

```
Content-Type: multipart/form-data

content: "Check out this amazing photo!" (optional)
type: TEXT (optional)
isPublic: true (optional)
media: [binary image file] (JPEG, PNG, GIF, WEBP - max 5MB)
```

#### Validation Rules:

-  At least one of `content` or `media` must be provided
-  `content` maximum 2000 characters (optional when media is provided)
-  Supported image types: JPEG, PNG, GIF, WEBP
-  Maximum file size: 5MB
-  Type auto-detection: automatically set to 'IMAGE' when uploading media

#### Response (201):

```json
{
   "success": true,
   "message": "Post created successfully",
   "data": {
      "post": {
         "id": "uuid",
         "content": "Check out this amazing photo!",
         "type": "IMAGE",
         "mediaUrl": "https://res.cloudinary.com/your-cloud/image.jpg",
         "isPublic": true,
         "author": {
            "id": "uuid",
            "username": "johndoe",
            "displayName": "John Doe",
            "avatar": "https://cloudinary.com/avatar.jpg"
         },
         "_count": {
            "comments": 0,
            "reactions": 0
         },
         "createdAt": "2023-11-05T10:30:00Z",
         "updatedAt": "2023-11-05T10:30:00Z"
      }
   }
}
```

#### Example Requests:

**Text-only post (JSON):**

```bash
curl -X POST http://localhost:8080/api/posts \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello world!", "isPublic": true}'
```

**Post with image (multipart):**

```bash
curl -X POST http://localhost:8080/api/posts \
  -H "Authorization: Bearer your_token" \
  -F "content=Check out this photo!" \
  -F "isPublic=true" \
  -F "media=@/path/to/image.jpg"
```

**Image-only post (multipart):**

```bash
curl -X POST http://localhost:8080/api/posts \
  -H "Authorization: Bearer your_token" \
  -F "media=@/path/to/image.jpg"
```

### 3.3 Get Post by ID

-  **Endpoint:** `GET /posts/{id}`
-  **Description:** Get a specific post by its ID
-  **Authentication:** Optional

**Response (200):**

```json
{
   "success": true,
   "data": {
      "post": {
         "id": "uuid",
         "content": "This is my first post!",
         "type": "TEXT",
         "mediaUrl": null,
         "isPublic": true,
         "author": {
            "id": "uuid",
            "username": "johndoe",
            "displayName": "John Doe",
            "avatar": "https://cloudinary.com/avatar.jpg"
         },
         "userReaction": null,
         "_count": {
            "comments": 5,
            "reactions": 12
         },
         "createdAt": "2023-11-05T10:30:00Z",
         "updatedAt": "2023-11-05T10:30:00Z"
      }
   }
}
```

### 3.4 Update Post

-  **Endpoint:** `PUT /posts/{id}`
-  **Description:** Update a post (only by post owner) - supports updating content and/or replacing media
-  **Authentication:** Bearer token required
-  **Content-Type:** `multipart/form-data` (when updating media) or `application/json` (for content-only updates)

#### Request (Update content only - JSON):

```json
{
   "content": "Updated post content", // Optional
   "isPublic": false // Optional
}
```

#### Request (Update with new media - multipart/form-data):

```
Content-Type: multipart/form-data

content: "Updated content with new image" (optional)
isPublic: true (optional)
media: [binary image file] (optional - replaces existing media)
```

#### Features:

-  Update text content without affecting media
-  Replace existing media with new image (old image is automatically deleted from Cloudinary)
-  Update visibility settings
-  All fields are optional - send only what you want to update

#### Response (200):

```json
{
   "success": true,
   "message": "Post updated successfully",
   "data": {
      "post": {
         "id": "uuid",
         "content": "Updated content with new image",
         "type": "IMAGE",
         "mediaUrl": "https://res.cloudinary.com/your-cloud/new-image.jpg",
         "isPublic": true,
         "author": {
            "id": "uuid",
            "username": "johndoe",
            "displayName": "John Doe",
            "avatar": "https://cloudinary.com/avatar.jpg"
         },
         "_count": {
            "comments": 5,
            "reactions": 12
         },
         "createdAt": "2023-11-05T10:30:00Z",
         "updatedAt": "2023-11-05T11:00:00Z"
      }
   }
}
```

#### Example Requests:

**Update content only (JSON):**

```bash
curl -X PUT http://localhost:8080/api/posts/uuid \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated content"}'
```

**Update with new image (multipart):**

```bash
curl -X PUT http://localhost:8080/api/posts/uuid \
  -H "Authorization: Bearer your_token" \
  -F "content=Updated content with new image" \
  -F "media=@/path/to/new-image.jpg"
```

**Replace image only (multipart):**

```bash
curl -X PUT http://localhost:8080/api/posts/uuid \
  -H "Authorization: Bearer your_token" \
  -F "media=@/path/to/new-image.jpg"
```

````

### 3.5 Delete Post

-  **Endpoint:** `DELETE /posts/{id}`
-  **Description:** Delete a post (only by post owner) - automatically cleans up associated media from Cloudinary
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "Post deleted successfully"
}
````

**Note:** When a post with media is deleted, the associated image is automatically removed from Cloudinary storage.

````

### 3.6 Get User Posts

-  **Endpoint:** `GET /posts/user/{userId}`
-  **Description:** Get all posts from a specific user
-  **Authentication:** Optional

**Query Parameters:**

-  `limit` (optional): Number of posts (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "posts": [
         {
            "id": "uuid",
            "content": "This is my post!",
            "type": "TEXT",
            "mediaUrl": null,
            "isPublic": true,
            "author": {
               "id": "uuid",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "userReaction": null,
            "_count": {
               "comments": 3,
               "reactions": 8
            },
            "createdAt": "2023-11-05T10:30:00Z",
            "updatedAt": "2023-11-05T10:30:00Z"
         }
      ],
      "pagination": {
         "limit": 10,
         "offset": 0,
         "hasMore": false
      }
   }
}
````

---

## 4. Comments

### 4.1 Get Post Comments

-  **Endpoint:** `GET /comments/post/{postId}`
-  **Description:** Get all comments for a specific post
-  **Authentication:** Optional

**Query Parameters:**

-  `limit` (optional): Number of comments (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "comments": [
         {
            "id": "uuid",
            "content": "This is a great post!",
            "author": {
               "id": "uuid",
               "username": "commenter",
               "displayName": "Commenter User",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "postId": "uuid",
            "parentId": null,
            "userReaction": null,
            "_count": {
               "replies": 2,
               "reactions": 3
            },
            "createdAt": "2023-11-05T10:35:00Z",
            "updatedAt": "2023-11-05T10:35:00Z"
         }
      ],
      "pagination": {
         "limit": 10,
         "offset": 0,
         "total": 5,
         "hasMore": false
      }
   }
}
```

### 4.2 Create Comment

-  **Endpoint:** `POST /comments/post/{postId}`
-  **Description:** Create a new comment on a post
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "content": "This is a great post!",
   "parentId": "uuid" // Optional: for reply to another comment
}
```

**Response (201):**

```json
{
   "success": true,
   "message": "Comment created successfully",
   "data": {
      "comment": {
         "id": "uuid",
         "content": "This is a great post!",
         "author": {
            "id": "uuid",
            "username": "johndoe",
            "displayName": "John Doe",
            "avatar": "https://cloudinary.com/avatar.jpg"
         },
         "postId": "uuid",
         "parentId": null,
         "_count": {
            "replies": 0,
            "reactions": 0
         },
         "createdAt": "2023-11-05T10:35:00Z",
         "updatedAt": "2023-11-05T10:35:00Z"
      }
   }
}
```

### 4.3 Get Comment Replies

-  **Endpoint:** `GET /comments/{commentId}/replies`
-  **Description:** Get all replies to a specific comment
-  **Authentication:** Optional

**Response (200):**

```json
{
   "success": true,
   "data": {
      "replies": [
         {
            "id": "uuid",
            "content": "I agree!",
            "author": {
               "id": "uuid",
               "username": "replier",
               "displayName": "Replier User",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "postId": "uuid",
            "parentId": "uuid",
            "userReaction": null,
            "_count": {
               "replies": 0,
               "reactions": 1
            },
            "createdAt": "2023-11-05T10:40:00Z",
            "updatedAt": "2023-11-05T10:40:00Z"
         }
      ]
   }
}
```

### 4.4 Update Comment

-  **Endpoint:** `PUT /comments/{id}`
-  **Description:** Update a comment (only by comment owner)
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "content": "Updated comment content"
}
```

**Response (200):**

```json
{
   "success": true,
   "message": "Comment updated successfully"
}
```

### 4.5 Delete Comment

-  **Endpoint:** `DELETE /comments/{id}`
-  **Description:** Delete a comment (only by comment owner)
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "Comment deleted successfully"
}
```

---

## 5. Reactions

### 5.1 Add Post Reaction

-  **Endpoint:** `POST /posts/{postId}/reactions`
-  **Description:** Add or update a reaction to a post
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "type": "LIKE" // LIKE, LOVE, LAUGH, ANGRY, SAD, WOW
}
```

**Response (200):**

```json
{
   "success": true,
   "message": "Reaction added successfully"
}
```

### 5.2 Get Post Reactions

-  **Endpoint:** `GET /posts/{postId}/reactions`
-  **Description:** Get all reactions for a specific post
-  **Authentication:** None required

**Response (200):**

```json
{
   "success": true,
   "data": {
      "reactions": [
         {
            "id": "uuid",
            "type": "LIKE",
            "user": {
               "id": "uuid",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "createdAt": "2023-11-05T10:40:00Z"
         }
      ],
      "summary": {
         "LIKE": 5,
         "LOVE": 2,
         "LAUGH": 1,
         "ANGRY": 0,
         "SAD": 0,
         "WOW": 1,
         "total": 9
      }
   }
}
```

### 5.3 Add Comment Reaction

-  **Endpoint:** `POST /comments/{commentId}/reactions`
-  **Description:** Add or update a reaction to a comment
-  **Authentication:** Bearer token required

**Request Body:**

```json
{
   "type": "LIKE" // LIKE, LOVE, LAUGH, ANGRY, SAD, WOW
}
```

### 5.4 Get Comment Reactions

-  **Endpoint:** `GET /comments/{commentId}/reactions`
-  **Description:** Get all reactions for a specific comment
-  **Authentication:** None required

**Response (200):**

```json
{
   "success": true,
   "data": {
      "reactions": [
         {
            "id": "uuid",
            "type": "LIKE",
            "user": {
               "id": "uuid",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "createdAt": "2023-11-05T10:40:00Z"
         }
      ],
      "summary": {
         "LIKE": 3,
         "LOVE": 1,
         "total": 4
      }
   }
}
```

---

## 6. Notifications

### 6.1 Get User Notifications

-  **Endpoint:** `GET /notifications`
-  **Description:** Get paginated list of notifications for the authenticated user
-  **Authentication:** Bearer token required

**Query Parameters:**

-  `limit` (optional): Number of notifications (default: 10)
-  `offset` (optional): Offset for pagination (default: 0)
-  `cursor` (optional): Cursor for pagination (ISO date string)

**Response (200):**

```json
{
   "success": true,
   "data": {
      "notifications": [
         {
            "id": "uuid",
            "type": "LIKE",
            "title": "New Reaction",
            "message": "John Doe reacted to your post",
            "isRead": false,
            "receiverId": "uuid",
            "sender": {
               "id": "uuid",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "https://cloudinary.com/avatar.jpg"
            },
            "entityId": "uuid",
            "entityType": "post",
            "createdAt": "2023-11-05T10:30:00Z"
         }
      ]
   },
   "pagination": {
      "limit": 10,
      "offset": 0,
      "hasMore": true,
      "nextCursor": "2023-11-05T10:25:00Z"
   }
}
```

### 6.2 Mark Notification as Read

-  **Endpoint:** `PUT /notifications/{id}/read`
-  **Description:** Mark a specific notification as read
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "Notification marked as read"
}
```

### 6.3 Mark All Notifications as Read

-  **Endpoint:** `PUT /notifications/read-all`
-  **Description:** Mark all unread notifications as read for the authenticated user
-  **Authentication:** Bearer token required

**Response (200):**

```json
{
   "success": true,
   "message": "All notifications marked as read",
   "data": {
      "updatedCount": 5
   }
}
```

---

## 7. Upload

### 7.1 Upload Single Image

-  **Endpoint:** `POST /upload/image`
-  **Description:** Upload a single image file
-  **Authentication:** Bearer token required
-  **Content-Type:** `multipart/form-data`

**Request:**

```
Content-Type: multipart/form-data

image: [binary file]
```

**Response (200):**

```json
{
   "success": true,
   "message": "Image uploaded successfully",
   "data": {
      "url": "https://cloudinary.com/image.jpg",
      "publicId": "posts/image123",
      "size": 1024000
   }
}
```

### 7.2 Upload Multiple Images

-  **Endpoint:** `POST /upload/images`
-  **Description:** Upload multiple image files (max 10)
-  **Authentication:** Bearer token required
-  **Content-Type:** `multipart/form-data`

**Request:**

```
Content-Type: multipart/form-data

images: [binary file 1]
images: [binary file 2]
...
```

**Response (200):**

```json
{
   "success": true,
   "message": "Images uploaded successfully",
   "data": {
      "images": [
         {
            "url": "https://cloudinary.com/image1.jpg",
            "publicId": "posts/image123",
            "size": 1024000
         },
         {
            "url": "https://cloudinary.com/image2.jpg",
            "publicId": "posts/image124",
            "size": 856000
         }
      ]
   }
}
```

---

## 8. Real-time Features (Socket.IO)

### 8.1 Connection Setup

**Connection URL:**

-  Development: `ws://localhost:8080`
-  Production: `wss://otakomi-backend.onrender.com`

**Authentication:**

```javascript
const socket = io('ws://localhost:8080', {
   auth: {
      token: 'your-jwt-token',
   },
});
```

### 8.2 Connection Events

#### 8.2.1 User Status Events

**Event: `user:online`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a user comes online

```javascript
socket.on('user:online', (data) => {
   console.log(data);
   /*
  {
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatar": "https://cloudinary.com/avatar.jpg"
    }
  }
  */
});
```

**Event: `user:offline`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a user goes offline

```javascript
socket.on('user:offline', (data) => {
   console.log(data);
   /*
  {
    "userId": "uuid",
    "lastSeen": "2023-11-05T10:30:00Z"
  }
  */
});
```

**Event: `users:online`**

-  **Direction:** Server → Client
-  **Description:** Sends list of currently online users (sent on connection)

```javascript
socket.on('users:online', (users) => {
   console.log(users);
   /*
  [
    {
      "userId": "uuid",
      "user": {
        "id": "uuid",
        "username": "johndoe",
        "displayName": "John Doe",
        "avatar": "https://cloudinary.com/avatar.jpg"
      }
    }
  ]
  */
});
```

#### 8.2.2 Post Events

**Event: `post:new`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a new public post is created

```javascript
socket.on('post:new', (post) => {
   console.log(post);
   /*
  {
    "id": "uuid",
    "content": "New post content",
    "type": "TEXT",
    "author": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe"
    },
    "createdAt": "2023-11-05T10:30:00Z"
  }
  */
});
```

**Event: `post:updated`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a post is updated

```javascript
socket.on('post:updated', (post) => {
   console.log(post);
});
```

**Event: `post:deleted`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a post is deleted

```javascript
socket.on('post:deleted', (data) => {
   console.log(data);
   /*
  {
    "id": "uuid"
  }
  */
});
```

#### 8.2.3 Comment Events

**Event: `comment:new`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a new comment is created

```javascript
socket.on('comment:new', (comment) => {
   console.log(comment);
   /*
  {
    "id": "uuid",
    "content": "New comment",
    "postId": "uuid",
    "author": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe"
    },
    "createdAt": "2023-11-05T10:35:00Z"
  }
  */
});
```

**Event: `comment:updated`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a comment is updated

```javascript
socket.on('comment:updated', (comment) => {
   console.log(comment);
});
```

**Event: `comment:deleted`**

-  **Direction:** Server → Client
-  **Description:** Notifies when a comment is deleted

```javascript
socket.on('comment:deleted', (data) => {
   console.log(data);
   /*
  {
    "id": "uuid",
    "postId": "uuid"
  }
  */
});
```

### 8.3 Messaging Events

#### 8.3.1 Conversation Management

**Event: `conversation:join`**

-  **Direction:** Client → Server
-  **Description:** Join a conversation room

```javascript
socket.emit('conversation:join', {
   conversationId: 'uuid',
});
```

**Event: `conversation:leave`**

-  **Direction:** Client → Server
-  **Description:** Leave a conversation room

```javascript
socket.emit('conversation:leave', {
   conversationId: 'uuid',
});
```

#### 8.3.2 Messaging

**Event: `message:send`**

-  **Direction:** Client → Server
-  **Description:** Send a message

```javascript
socket.emit('message:send', {
   conversationId: 'uuid',
   content: 'Hello!',
   type: 'TEXT', // TEXT, IMAGE, FILE, VOICE
   receiverId: 'uuid', // Optional for direct messages
});
```

**Event: `message:new`**

-  **Direction:** Server → Client
-  **Description:** Receive a new message

```javascript
socket.on('message:new', (message) => {
   console.log(message);
   /*
  {
    "id": "uuid",
    "content": "Hello!",
    "type": "TEXT",
    "conversationId": "uuid",
    "sender": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatar": "https://cloudinary.com/avatar.jpg"
    },
    "receiver": {
      "id": "uuid",
      "username": "janedoe",
      "displayName": "Jane Doe"
    },
    "createdAt": "2023-11-05T10:45:00Z"
  }
  */
});
```

**Event: `message:received`**

-  **Direction:** Server → Client
-  **Description:** Notification for direct message received

```javascript
socket.on('message:received', (message) => {
   console.log(message);
});
```

**Event: `message:read`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** Mark message as read / Notify sender about read receipt

```javascript
// Client to Server
socket.emit('message:read', {
   messageId: 'uuid',
});

// Server to Client (to sender)
socket.on('message:read', (data) => {
   console.log(data);
   /*
  {
    "messageId": "uuid",
    "readBy": "uuid",
    "readAt": "2023-11-05T10:46:00Z"
  }
  */
});
```

**Event: `message:error`**

-  **Direction:** Server → Client
-  **Description:** Error sending message

```javascript
socket.on('message:error', (error) => {
   console.log(error);
   /*
  {
    "error": "Failed to send message"
  }
  */
});
```

#### 8.3.3 Typing Indicators

**Event: `typing:start`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** Start typing indicator

```javascript
// Client to Server
socket.emit('typing:start', {
   conversationId: 'uuid',
});

// Server to other clients in conversation
socket.on('typing:start', (data) => {
   console.log(data);
   /*
  {
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe"
    },
    "conversationId": "uuid"
  }
  */
});
```

**Event: `typing:stop`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** Stop typing indicator

```javascript
// Client to Server
socket.emit('typing:stop', {
   conversationId: 'uuid',
});

// Server to other clients
socket.on('typing:stop', (data) => {
   console.log(data);
   /*
  {
    "userId": "uuid",
    "conversationId": "uuid"
  }
  */
});
```

### 8.4 Notification Events

**Event: `notification:send`**

-  **Direction:** Client → Server
-  **Description:** Send a notification to another user

```javascript
socket.emit('notification:send', {
   receiverId: 'uuid',
   type: 'LIKE', // LIKE, COMMENT, FOLLOW, MESSAGE, CALL, MENTION
   title: 'New Follower',
   message: 'John Doe started following you',
   entityId: 'uuid', // Optional: ID of related entity
   entityType: 'user', // Optional: Type of related entity
});
```

**Event: `notification:new`**

-  **Direction:** Server → Client
-  **Description:** Receive a new notification

```javascript
socket.on('notification:new', (notification) => {
   console.log(notification);
   /*
  {
    "id": "uuid",
    "type": "FOLLOW",
    "title": "New Follower",
    "message": "John Doe started following you",
    "sender": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatar": "https://cloudinary.com/avatar.jpg"
    },
    "entityId": "uuid",
    "entityType": "user",
    "createdAt": "2023-11-05T10:50:00Z"
  }
  */
});
```

### 8.5 Call Events (WebRTC)

#### 8.5.1 Call Management

**Event: `call:initiate`**

-  **Direction:** Client → Server
-  **Description:** Initiate a call

```javascript
socket.emit('call:initiate', {
   receiverId: 'uuid',
   type: 'VOICE', // VOICE or VIDEO
});
```

**Event: `call:incoming`**

-  **Direction:** Server → Client
-  **Description:** Receive incoming call notification

```javascript
socket.on('call:incoming', (data) => {
   console.log(data);
   /*
  {
    "call": {
      "id": "uuid",
      "type": "VOICE",
      "status": "PENDING",
      "callerId": "uuid",
      "receiverId": "uuid"
    },
    "caller": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatar": "https://cloudinary.com/avatar.jpg"
    }
  }
  */
});
```

**Event: `call:initiated`**

-  **Direction:** Server → Client
-  **Description:** Confirmation that call was initiated

```javascript
socket.on('call:initiated', (data) => {
   console.log(data);
   /*
  {
    "callId": "uuid"
  }
  */
});
```

**Event: `call:response`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** Accept or decline a call

```javascript
// Client to Server
socket.emit('call:response', {
   callId: 'uuid',
   accepted: true, // true or false
});

// Server to caller
socket.on('call:response', (data) => {
   console.log(data);
   /*
  {
    "callId": "uuid",
    "accepted": true,
    "status": "ONGOING"
  }
  */
});
```

**Event: `call:end`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** End a call

```javascript
// Client to Server
socket.emit('call:end', {
   callId: 'uuid',
});

// Server to other participant
socket.on('call:ended', (data) => {
   console.log(data);
   /*
  {
    "callId": "uuid"
  }
  */
});
```

**Event: `call:error`**

-  **Direction:** Server → Client
-  **Description:** Call error

```javascript
socket.on('call:error', (error) => {
   console.log(error);
   /*
  {
    "error": "Failed to initiate call"
  }
  */
});
```

#### 8.5.2 WebRTC Signaling

**Event: `webrtc:offer`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** WebRTC offer exchange

```javascript
// Client to Server
socket.emit('webrtc:offer', {
   receiverId: 'uuid',
   offer: rtcPeerConnection.localDescription,
   callId: 'uuid',
});

// Server to receiver
socket.on('webrtc:offer', (data) => {
   console.log(data);
   /*
  {
    "senderId": "uuid",
    "offer": RTCSessionDescription,
    "callId": "uuid"
  }
  */
});
```

**Event: `webrtc:answer`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** WebRTC answer exchange

```javascript
// Client to Server
socket.emit('webrtc:answer', {
   senderId: 'uuid',
   answer: rtcPeerConnection.localDescription,
   callId: 'uuid',
});

// Server to caller
socket.on('webrtc:answer', (data) => {
   console.log(data);
   /*
  {
    "receiverId": "uuid",
    "answer": RTCSessionDescription,
    "callId": "uuid"
  }
  */
});
```

**Event: `webrtc:ice-candidate`**

-  **Direction:** Client → Server & Server → Client
-  **Description:** ICE candidate exchange

```javascript
// Client to Server
socket.emit('webrtc:ice-candidate', {
   targetId: 'uuid',
   candidate: event.candidate,
   callId: 'uuid',
});

// Server to target
socket.on('webrtc:ice-candidate', (data) => {
   console.log(data);
   /*
  {
    "senderId": "uuid",
    "candidate": RTCIceCandidate,
    "callId": "uuid"
  }
  */
});
```

### 8.6 Connection Health

**Event: `ping`**

-  **Direction:** Client → Server
-  **Description:** Ping server for connection health

```javascript
socket.emit('ping');
```

**Event: `pong`**

-  **Direction:** Server → Client
-  **Description:** Pong response from server

```javascript
socket.on('pong', () => {
   console.log('Connection is healthy');
});
```

---

## 9. Sentiment Analysis Service

**Base URL:** `http://localhost:8000` (Development)

### 9.1 Health Check

-  **Endpoint:** `GET /health`
-  **Description:** Check if sentiment service is healthy and model is loaded

**Response (200):**

```json
{
   "status": "healthy",
   "model_loaded": true,
   "timestamp": "2023-11-05T10:30:00Z",
   "version": "1.0.0"
}
```

### 9.2 Analyze Single Text

-  **Endpoint:** `POST /analyze`
-  **Description:** Analyze sentiment of a single text

**Request Body:**

```json
{
   "text": "I love this new feature!",
   "user_id": "uuid", // Optional
   "entity_id": "uuid", // Optional
   "entity_type": "post" // Optional: post, comment, message
}
```

**Response (200):**

```json
{
   "sentiment": "POSITIVE",
   "confidence": 0.95,
   "scores": {
      "POSITIVE": 0.95,
      "NEUTRAL": 0.04,
      "NEGATIVE": 0.01
   },
   "processing_time": 0.15,
   "model_version": "1.0.0"
}
```

### 9.3 Analyze Batch Texts

-  **Endpoint:** `POST /analyze/batch`
-  **Description:** Analyze sentiment of multiple texts

**Request Body:**

```json
{
   "texts": ["I love this new feature!", "This is okay I guess.", "I hate this change."],
   "user_id": "uuid" // Optional
}
```

**Response (200):**

```json
{
   "results": [
      {
         "text": "I love this new feature!",
         "sentiment": "POSITIVE",
         "confidence": 0.95,
         "scores": {
            "POSITIVE": 0.95,
            "NEUTRAL": 0.04,
            "NEGATIVE": 0.01
         },
         "processing_time": 0.12
      },
      {
         "text": "This is okay I guess.",
         "sentiment": "NEUTRAL",
         "confidence": 0.78,
         "scores": {
            "POSITIVE": 0.15,
            "NEUTRAL": 0.78,
            "NEGATIVE": 0.07
         },
         "processing_time": 0.1
      },
      {
         "text": "I hate this change.",
         "sentiment": "NEGATIVE",
         "confidence": 0.92,
         "scores": {
            "POSITIVE": 0.02,
            "NEUTRAL": 0.06,
            "NEGATIVE": 0.92
         },
         "processing_time": 0.11
      }
   ],
   "total_processing_time": 0.33,
   "model_version": "1.0.0"
}
```

### 9.4 Get Model Information

-  **Endpoint:** `GET /models/info`
-  **Description:** Get information about the loaded model

**Response (200):**

```json
{
   "model_name": "cardiffnlp/twitter-roberta-base-sentiment-latest",
   "model_version": "1.0.0",
   "languages_supported": ["en"],
   "max_text_length": 512,
   "sentiment_labels": ["NEGATIVE", "NEUTRAL", "POSITIVE"],
   "loaded_at": "2023-11-05T09:00:00Z",
   "memory_usage_mb": 450.2
}
```

---

## 9.5 Media Upload Guidelines

### 9.5.1 Supported File Types

-  **Images:** JPEG, PNG, GIF, WEBP
-  **Maximum file size:** 5MB per file
-  **Automatic optimization:** Images are automatically optimized and resized by Cloudinary

### 9.5.2 Post Creation with Media

-  **Text + Media:** Both content and media can be provided
-  **Media-only posts:** Content can be empty when media is uploaded
-  **Auto-type detection:** Post type automatically set to 'IMAGE' when media is uploaded
-  **Validation:** At least one of content or media must be provided

### 9.5.3 Media Management

-  **Storage:** All media stored on Cloudinary with automatic optimization
-  **Cleanup:** Old media automatically deleted when posts are updated or deleted
-  **CDN:** Media served via Cloudinary CDN for optimal performance
-  **Security:** File type validation and size limits enforced

### 9.5.4 Frontend Integration Examples

#### JavaScript - Create Post with Image

```javascript
async function createPostWithImage(content, imageFile) {
   const formData = new FormData();

   if (content.trim()) {
      formData.append('content', content);
   }

   if (imageFile) {
      formData.append('media', imageFile);
   }

   const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
         Authorization: `Bearer ${token}`,
      },
      body: formData,
   });

   return response.json();
}
```

#### JavaScript - Update Post with New Image

```javascript
async function updatePostWithImage(postId, content, imageFile) {
   const formData = new FormData();

   if (content !== undefined) {
      formData.append('content', content);
   }

   if (imageFile) {
      formData.append('media', imageFile);
   }

   const response = await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: {
         Authorization: `Bearer ${token}`,
      },
      body: formData,
   });

   return response.json();
}
```

#### React Hook Example

```javascript
function usePostUpload() {
   const [uploading, setUploading] = useState(false);

   const uploadPost = async (content, file) => {
      setUploading(true);
      try {
         const formData = new FormData();
         if (content) formData.append('content', content);
         if (file) formData.append('media', file);

         const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
         });

         return await response.json();
      } finally {
         setUploading(false);
      }
   };

   return { uploadPost, uploading };
}
```

---

## 10. Error Responses

### 10.1 Validation Error (400)

```json
{
   "success": false,
   "error": "Validation failed",
   "details": [
      {
         "field": "email",
         "message": "Email is required"
      },
      {
         "field": "password",
         "message": "Password must be at least 6 characters"
      }
   ]
}
```

### 10.2 Authentication Error (401)

```json
{
   "success": false,
   "error": "Invalid email or password"
}
```

### 10.3 Authorization Error (403)

```json
{
   "success": false,
   "error": "Access denied: You can only delete your own posts"
}
```

### 10.4 Not Found Error (404)

```json
{
   "success": false,
   "error": "User not found"
}
```

### 10.5 Conflict Error (409)

```json
{
   "success": false,
   "error": "Email already registered"
}
```

### 10.6 Server Error (500)

```json
{
   "success": false,
   "error": "Internal server error"
}
```

### 10.8 Refresh Token Errors

**Invalid Refresh Token (401):**

```json
{
   "success": false,
   "error": "Invalid or expired refresh token"
}
```

**Missing Refresh Token (400):**

```json
{
   "success": false,
   "error": "Validation failed",
   "details": [
      {
         "field": "refreshToken",
         "message": "refreshToken is required"
      }
   ]
}
```

### 10.9 File Upload Error (400)

```json
{
   "success": false,
   "error": "File too large. Maximum size is 5MB"
}
```

---

## 11. Data Models

### 11.1 User Model

```typescript
interface User {
   id: string;
   email: string;
   username: string;
   displayName: string;
   avatar: string | null;
   bio: string | null;
   dateOfBirth: string | null; // ISO date
   role: 'USER' | 'ADMIN' | 'MODERATOR';
   isActive: boolean;
   isOnline: boolean;
   lastSeen: string | null; // ISO datetime
   emailVerified: boolean;
   createdAt: string; // ISO datetime
   updatedAt: string; // ISO datetime
}
```

### 11.2 Post Model

```typescript
interface Post {
   id: string;
   content: string; // Can be empty when mediaUrl is present
   type: 'TEXT' | 'IMAGE' | 'VIDEO'; // Auto-detected based on media upload
   mediaUrl: string | null; // Cloudinary URL for images/videos
   isPublic: boolean;
   authorId: string;
   author: User;
   userReaction: ReactionType | null; // Current user's reaction
   _count: {
      comments: number;
      reactions: number;
   };
   createdAt: string; // ISO datetime
   updatedAt: string; // ISO datetime
}
```

### 11.3 Comment Model

```typescript
interface Comment {
   id: string;
   content: string;
   postId: string;
   authorId: string;
   author: User;
   parentId: string | null; // For nested comments
   userReaction: ReactionType | null;
   _count: {
      replies: number;
      reactions: number;
   };
   createdAt: string; // ISO datetime
   updatedAt: string; // ISO datetime
}
```

### 11.4 Reaction Model

```typescript
type ReactionType = 'LIKE' | 'LOVE' | 'LAUGH' | 'ANGRY' | 'SAD' | 'WOW';

interface Reaction {
   id: string;
   type: ReactionType;
   userId: string;
   user: User;
   postId: string | null;
   commentId: string | null;
   createdAt: string; // ISO datetime
}
```

### 11.5 Message Model

```typescript
interface Message {
   id: string;
   content: string;
   type: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
   mediaUrl: string | null;
   conversationId: string;
   senderId: string;
   sender: User;
   receiverId: string | null;
   receiver: User | null;
   isRead: boolean;
   readAt: string | null; // ISO datetime
   createdAt: string; // ISO datetime
   updatedAt: string; // ISO datetime
}
```

### 11.6 Conversation Model

```typescript
interface Conversation {
   id: string;
   name: string | null;
   type: 'DIRECT' | 'GROUP';
   participants: ConversationParticipant[];
   messages: Message[];
   createdAt: string; // ISO datetime
   updatedAt: string; // ISO datetime
}

interface ConversationParticipant {
   id: string;
   conversationId: string;
   userId: string;
   user: User;
   joinedAt: string; // ISO datetime
   leftAt: string | null; // ISO datetime
}
```

### 11.7 Notification Model

```typescript
type NotificationType = 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MESSAGE' | 'CALL' | 'MENTION';

interface Notification {
   id: string;
   type: NotificationType;
   title: string;
   message: string;
   isRead: boolean;
   receiverId: string;
   receiver: User;
   senderId: string | null;
   sender: User | null;
   entityId: string | null;
   entityType: string | null;
   createdAt: string; // ISO datetime
}
```

### 11.8 Call Model

```typescript
interface Call {
   id: string;
   type: 'VOICE' | 'VIDEO';
   status: 'PENDING' | 'ONGOING' | 'ENDED' | 'MISSED';
   duration: number | null; // in seconds
   callerId: string;
   caller: User;
   receiverId: string;
   receiver: User;
   startedAt: string | null; // ISO datetime
   endedAt: string | null; // ISO datetime
   createdAt: string; // ISO datetime
}
```

### 11.9 Follow Model

```typescript
interface Follow {
   id: string;
   followerId: string;
   follower: User;
   followingId: string;
   following: User;
   createdAt: string; // ISO datetime
}
```

### 11.10 Sentiment Analysis Model

```typescript
type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

interface SentimentAnalysis {
   id: string;
   content: string;
   sentiment: SentimentType;
   confidence: number; // 0.0 to 1.0
   userId: string;
   user: User;
   entityId: string; // postId, commentId, messageId
   entityType: string; // 'post', 'comment', 'message'
   createdAt: string; // ISO datetime
}
```

### 11.11 Pagination Model

```typescript
interface Pagination {
   limit: number;
   offset: number;
   total?: number;
   hasMore?: boolean;
   page?: number;
   totalPages?: number;
   hasNext?: boolean;
   hasPrev?: boolean;
}
```

---

## Integration Notes

### Authentication

-  All protected endpoints require `Authorization: Bearer <access_token>` header
-  **Access tokens** expire in 15 minutes by default (short-lived for security)
-  **Refresh tokens** expire in 7 days and are used to obtain new access tokens
-  Use `/auth/refresh` to get new tokens when access token expires
-  Use `/auth/verify` to check access token validity
-  **Token Rotation Security:** Each refresh generates both new access and refresh tokens
-  **Logout Security:** Refresh tokens are invalidated on logout to prevent misuse

#### Token Management Flow:

1. **Login/Register:** Receive both `accessToken` and `refreshToken`
2. **API Calls:** Use `accessToken` in Authorization header
3. **Token Expiry:** When access token expires (15 min), use `refreshToken`
4. **Refresh:** Call `/auth/refresh` with `refreshToken` to get new tokens
5. **Logout:** Call `/auth/logout` to invalidate all tokens

#### Best Practices:

-  Store refresh tokens securely (httpOnly cookies recommended for web apps)
-  Implement automatic token refresh when API returns 401 errors
-  Always use the new refresh token returned from `/auth/refresh`
-  Handle refresh token expiry by redirecting to login
-  Never expose refresh tokens in client-side code or logs

#### Example: Automatic Token Refresh Implementation

```javascript
// Token refresh interceptor example
async function makeAuthenticatedRequest(url, options = {}) {
   let accessToken = localStorage.getItem('accessToken');

   try {
      const response = await fetch(url, {
         ...options,
         headers: {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
         },
      });

      if (response.status === 401) {
         // Token expired, try to refresh
         const newTokens = await refreshTokens();
         if (newTokens) {
            // Retry with new token
            return fetch(url, {
               ...options,
               headers: {
                  ...options.headers,
                  Authorization: `Bearer ${newTokens.accessToken}`,
               },
            });
         } else {
            // Refresh failed, redirect to login
            window.location.href = '/login';
            return;
         }
      }

      return response;
   } catch (error) {
      console.error('Request failed:', error);
      throw error;
   }
}

async function refreshTokens() {
   const refreshToken = localStorage.getItem('refreshToken');

   try {
      const response = await fetch('/api/auth/refresh', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
         const data = await response.json();
         localStorage.setItem('accessToken', data.data.accessToken);
         localStorage.setItem('refreshToken', data.data.refreshToken);
         return data.data;
      }
   } catch (error) {
      console.error('Token refresh failed:', error);
   }

   return null;
}
```

### Real-time Connection

-  Authenticate Socket.IO connection with JWT token in auth object
-  Socket.IO connection will automatically handle user online/offline status
-  Join conversation rooms before sending/receiving messages

### File Uploads

-  Images are uploaded to Cloudinary
-  Maximum file size: 5MB per image
-  Maximum 10 images per batch upload
-  Supported formats: JPEG, PNG, GIF, WebP

### Error Handling

-  All responses follow the same format with `success` boolean
-  Validation errors include detailed field-level error messages
-  Socket.IO errors are emitted as specific error events

### Rate Limiting

-  API requests are rate-limited to prevent abuse
-  Socket.IO connections have built-in flood protection

### Sentiment Analysis

-  Automatic sentiment analysis on posts and comments
-  Fallback to neutral sentiment if service is unavailable
-  Sentiment data stored for analytics and user insights

This specification provides complete documentation for integrating with the OnWay backend API, including REST endpoints, real-time Socket.IO events, and sentiment analysis capabilities.
