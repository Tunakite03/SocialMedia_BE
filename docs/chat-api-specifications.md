# Chat API Specifications

## Overview

This document outlines the Chat/Messaging API endpoints for the SocialMedia application, including the enhanced read tracking system with optimized batch operations.

## Base URL

All endpoints are prefixed with: `/api/v1`

---

## Conversations

### 1. Get User's Conversations

**GET** `/conversations`

Returns a list of conversations for the authenticated user with unread counts and read status.

**Query Parameters:**

-  `limit` (optional): Number of conversations to return (default: 20)
-  `offset` (optional): Number of conversations to skip (default: 0)
-  `cursor` (optional): Cursor for pagination

**Response:**

```json
{
   "success": true,
   "data": {
      "conversations": [
         {
            "id": "conv-id",
            "title": "Group Chat Name",
            "type": "GROUP", // or "DIRECT"
            "participants": [
               {
                  "id": "participant-id",
                  "userId": "user-id",
                  "role": "ADMIN", // or "MEMBER"
                  "joinedAt": "2024-01-01T10:00:00Z",
                  "user": {
                     "id": "user-id",
                     "username": "johndoe",
                     "displayName": "John Doe",
                     "avatar": "avatar-url",
                     "isOnline": true
                  }
               }
            ],
            "lastMessage": {
               "id": "msg-id",
               "content": "Hello world",
               "sender": {
                  "id": "user-id",
                  "username": "johndoe",
                  "displayName": "John Doe"
               },
               "createdAt": "2024-01-01T10:00:00Z",
               "isReadByCurrentUser": true,
               "readCount": 2
            },
            "unreadCount": 5,
            "lastReadMessageId": "msg-123",
            "lastReadAt": "2024-01-01T09:00:00Z",
            "otherParticipant": {
               // For DIRECT conversations only
               "id": "user-id",
               "username": "janedoe",
               "displayName": "Jane Doe",
               "avatar": "avatar-url",
               "isOnline": false
            },
            "_count": {
               "messages": 150
            },
            "createdAt": "2024-01-01T08:00:00Z",
            "updatedAt": "2024-01-01T10:00:00Z"
         }
      ]
   },
   "pagination": {
      "hasMore": true,
      "nextCursor": "next-cursor"
   }
}
```

### 2. Get or Create Direct Conversation

**GET** `/conversations/direct/:userId`

Creates a new direct conversation or returns existing one between the authenticated user and specified user.

**Path Parameters:**

-  `userId`: ID of the user to create conversation with

**Response:**

```json
{
   "success": true,
   "data": {
      "conversation": {
         "id": "conv-id",
         "type": "DIRECT",
         "participants": [
            {
               "id": "participant-id",
               "userId": "user-id",
               "role": "MEMBER",
               "user": {
                  "id": "user-id",
                  "username": "johndoe",
                  "displayName": "John Doe",
                  "avatar": "avatar-url",
                  "isOnline": true
               }
            }
         ],
         "lastMessage": null,
         "_count": {
            "messages": 0
         }
      }
   },
   "message": "Conversation retrieved successfully"
}
```

### 3. Create Group Conversation

**POST** `/conversations/group`

Creates a new group conversation.

**Request Body:**

```json
{
   "title": "My Group Chat",
   "participantIds": ["user-id-1", "user-id-2"]
}
```

**Response:**

```json
{
   "success": true,
   "data": {
      "conversation": {
         "id": "conv-id",
         "title": "My Group Chat",
         "type": "GROUP",
         "participants": [
            {
               "id": "participant-id",
               "userId": "creator-id",
               "role": "ADMIN",
               "user": {
                  "id": "creator-id",
                  "username": "creator",
                  "displayName": "Creator Name",
                  "avatar": "avatar-url",
                  "isOnline": true
               }
            }
         ]
      }
   },
   "message": "Group conversation created successfully"
}
```

### 4. Get Conversation Details

**GET** `/conversations/:conversationId`

Returns detailed information about a specific conversation.

**Path Parameters:**

-  `conversationId`: ID of the conversation

**Response:** Same structure as conversation object in Get User's Conversations

---

## Messages

### 5. Get Messages in Conversation

**GET** `/conversations/:conversationId/messages`

Returns messages in a conversation with enhanced read tracking information.

**Query Parameters:**

-  `limit` (optional): Number of messages to return (default: 50)
-  `offset` (optional): Number of messages to skip (default: 0)
-  `cursor` (optional): Cursor for pagination

**Response:**

```json
{
   "success": true,
   "data": {
      "messages": [
         {
            "id": "msg-id",
            "content": "Hello world",
            "type": "TEXT", // TEXT, IMAGE, FILE, VOICE
            "mediaUrl": "media-url",
            "sender": {
               "id": "user-id",
               "username": "johndoe",
               "displayName": "John Doe",
               "avatar": "avatar-url"
            },
            "parent": {
               // For replies
               "id": "parent-msg-id",
               "content": "Original message",
               "sender": {
                  "id": "user-id",
                  "username": "originalsender",
                  "displayName": "Original Sender"
               }
            },
            "attachments": [
               {
                  "id": "attachment-id",
                  "url": "file-url",
                  "type": "IMAGE",
                  "size": 1024000
               }
            ],
            "reactions": [
               {
                  "id": "reaction-id",
                  "type": "LIKE",
                  "user": {
                     "id": "user-id",
                     "username": "reactor",
                     "displayName": "Reactor Name"
                  },
                  "createdAt": "2024-01-01T10:00:00Z"
               }
            ],
            "readBy": [
               {
                  "user": {
                     "id": "user-id",
                     "username": "reader",
                     "displayName": "Reader Name"
                  },
                  "readAt": "2024-01-01T10:01:00Z"
               }
            ],
            "isReadByCurrentUser": true,
            "readCount": 3,
            "createdAt": "2024-01-01T10:00:00Z",
            "updatedAt": "2024-01-01T10:00:00Z"
         }
      ],
      "unreadCount": 5,
      "lastReadMessageId": "msg-123",
      "lastReadAt": "2024-01-01T09:00:00Z",
      "participants": [
         {
            "userId": "user-id",
            "lastReadMessageId": "msg-120",
            "lastReadAt": "2024-01-01T08:30:00Z",
            "user": {
               "id": "user-id",
               "username": "participant",
               "displayName": "Participant Name"
            }
         }
      ]
   },
   "pagination": {
      "hasMore": true,
      "nextCursor": "next-cursor"
   }
}
```

### 6. Send Message

**POST** `/conversations/:conversationId/messages`

Sends a new message to a conversation.

**Path Parameters:**

-  `conversationId`: ID of the conversation

**Request Body:**

```json
{
   "content": "Hello world",
   "replyToId": "parent-message-id" // optional
}
```

**Response:**

```json
{
   "success": true,
   "data": {
      "message": {
         "id": "msg-id",
         "content": "Hello world",
         "type": "TEXT",
         "sender": {
            "id": "sender-id",
            "username": "sender",
            "displayName": "Sender Name",
            "avatar": "avatar-url"
         },
         "parent": null, // or parent message object if replying
         "attachments": [],
         "reactions": [],
         "createdAt": "2024-01-01T10:00:00Z"
      }
   },
   "message": "Message sent successfully"
}
```

---

## Read Status Management (New)

### 7. Mark Conversation as Read (Batch)

**POST** `/conversations/:conversationId/read`

Marks all messages in a conversation as read up to a specified message. This is the optimized batch operation that replaces individual message read tracking.

**Path Parameters:**

-  `conversationId`: ID of the conversation

**Request Body:**

```json
{
   "lastMessageId": "msg-id" // optional - if not provided, marks all messages as read
}
```

**Response:**

```json
{
   "success": true,
   "data": {
      "unreadCount": 0,
      "lastReadMessageId": "msg-id"
   },
   "message": "Messages marked as read"
}
```

**Benefits:**

-  ✅ **90%+ reduction** in API calls (1 call per conversation vs 1 call per message)
-  ✅ **Batch operation** for better performance
-  ✅ **Automatic read receipt creation** for all messages up to specified point

### 8. Get Unread Count for Conversation

**GET** `/conversations/:conversationId/unread-count`

Returns the number of unread messages for a specific conversation.

**Path Parameters:**

-  `conversationId`: ID of the conversation

**Response:**

```json
{
   "success": true,
   "data": {
      "unreadCount": 5,
      "lastReadMessageId": "msg-123",
      "lastReadAt": "2024-01-01T09:00:00Z"
   },
   "message": "Unread count retrieved successfully"
}
```

### 9. Get All Unread Counts

**GET** `/conversations/unread-counts`

Returns unread message counts for all conversations of the authenticated user.

**Response:**

```json
{
   "success": true,
   "data": {
      "totalUnreadCount": 15,
      "conversations": [
         {
            "conversationId": "conv-1",
            "conversation": {
               "id": "conv-1",
               "title": "Group Chat",
               "type": "GROUP"
            },
            "unreadCount": 5,
            "lastReadMessageId": "msg-123",
            "lastReadAt": "2024-01-01T09:00:00Z"
         },
         {
            "conversationId": "conv-2",
            "conversation": {
               "id": "conv-2",
               "title": null,
               "type": "DIRECT"
            },
            "unreadCount": 10,
            "lastReadMessageId": "msg-456",
            "lastReadAt": "2024-01-01T08:00:00Z"
         }
      ]
   },
   "message": "All unread counts retrieved successfully"
}
```

**Use Case:**

-  Perfect for displaying unread badges in conversation lists
-  Dashboard notifications
-  Mobile app badge counts

---

## Message Interactions

### 10. React to Message

**POST** `/messages/:messageId/react`

Adds or removes a reaction to/from a message.

**Path Parameters:**

-  `messageId`: ID of the message

**Request Body:**

```json
{
   "type": "LIKE" // LIKE, LOVE, LAUGH, ANGRY, SAD, WOW
}
```

**Response:**

```json
{
   "success": true,
   "data": {
      "reaction": {
         "id": "reaction-id",
         "type": "LIKE",
         "user": {
            "id": "user-id",
            "username": "reactor",
            "displayName": "Reactor Name"
         },
         "createdAt": "2024-01-01T10:00:00Z"
      } // null if reaction was removed
   },
   "message": "Reaction added successfully" // or "Reaction removed successfully"
}
```

### 11. Upload Message Attachment

**POST** `/messages/:messageId/attachments`

Uploads an attachment to a message.

**Path Parameters:**

-  `messageId`: ID of the message

**Request Body:** `multipart/form-data`

-  `file`: The file to upload

**Response:**

```json
{
   "success": true,
   "data": {
      "attachment": {
         "id": "attachment-id",
         "url": "cloudinary-url",
         "type": "IMAGE", // IMAGE, VIDEO, VOICE, FILE
         "size": 1024000
      }
   },
   "message": "Attachment uploaded successfully"
}
```

---

## WebSocket Events

### Real-time Communication

The chat system uses WebSocket for real-time updates. All events are emitted to relevant conversation rooms.

### Client → Server Events

#### 1. Mark Conversation as Read (Batch)

```javascript
socket.emit('conversation:markAsRead', {
   conversationId: 'conv-id',
   lastMessageId: 'msg-id', // optional
});
```

#### 2. Mark Single Message as Read (Legacy)

```javascript
socket.emit('message:read', {
   messageId: 'msg-id',
});
```

#### 3. Typing Indicators

```javascript
// Start typing
socket.emit('typing:start', {
   conversationId: 'conv-id',
});

// Stop typing
socket.emit('typing:stop', {
   conversationId: 'conv-id',
});
```

#### 4. Send Message

```javascript
socket.emit('message:send', {
   conversationId: 'conv-id',
   content: 'Hello world',
   replyToId: 'parent-msg-id', // optional
});
```

#### 5. React to Message

```javascript
socket.emit('message:react', {
   messageId: 'msg-id',
   type: 'LIKE',
});
```

### Server → Client Events

#### 1. New Message

```javascript
socket.on('message:new', (message) => {
   // message object with full details
});
```

#### 2. Messages Read Status Update (New)

```javascript
socket.on('messages:read', (data) => {
   // {
   //   userId: 'user-id',
   //   lastReadMessageId: 'msg-id',
   //   readAt: '2024-01-01T10:00:00Z'
   // }
});
```

#### 3. Single Message Read (Legacy)

```javascript
socket.on('message:read', (data) => {
   // {
   //   messageId: 'msg-id',
   //   readBy: 'user-id',
   //   readAt: '2024-01-01T10:00:00Z'
   // }
});
```

#### 4. Message Reaction

```javascript
socket.on('message:reaction', (data) => {
   // {
   //   messageId: 'msg-id',
   //   reaction: {...}, // or null if removed
   //   action: 'added' // or 'removed'
   // }
});
```

#### 5. Typing Indicators

```javascript
socket.on('typing:start', (data) => {
   // {
   //   userId: 'user-id',
   //   user: {...},
   //   conversationId: 'conv-id'
   // }
});

socket.on('typing:stop', (data) => {
   // {
   //   userId: 'user-id',
   //   conversationId: 'conv-id'
   // }
});
```

#### 6. User Status Updates

```javascript
socket.on('user:online', (data) => {
   // { userId: 'user-id', user: {...} }
});

socket.on('user:offline', (data) => {
   // { userId: 'user-id', lastSeen: '2024-01-01T10:00:00Z' }
});
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
   "success": false,
   "error": {
      "message": "Error description",
      "code": "ERROR_CODE",
      "details": {} // additional error details
   }
}
```

### Common Error Codes

-  `VALIDATION_ERROR` (400): Invalid request data
-  `UNAUTHORIZED` (401): Authentication required
-  `FORBIDDEN` (403): Access denied
-  `NOT_FOUND` (404): Resource not found
-  `CONVERSATION_NOT_FOUND` (404): Conversation doesn't exist or access denied
-  `MESSAGE_NOT_FOUND` (404): Message doesn't exist or access denied
-  `INVALID_REACTION_TYPE` (400): Invalid reaction type provided
-  `INVALID_MESSAGE_TYPE` (400): Invalid message type
-  `FILE_TOO_LARGE` (400): Uploaded file exceeds size limit
-  `INTERNAL_SERVER_ERROR` (500): Server error

---

## Performance Optimizations

### 1. Read Status Optimization

-  **Batch Operations**: Single API call marks entire conversation as read
-  **Smart Indexing**: Database indexes on `lastReadMessageId` and `conversationId`
-  **Real-time Updates**: WebSocket events reduce polling needs
-  **Efficient Queries**: Optimized database queries for unread counts

### 2. Message Loading

-  **Cursor-based Pagination**: Efficient pagination for large message histories
-  **Selective Loading**: Only load necessary message details
-  **Caching**: Strategic caching of conversation metadata

### 3. WebSocket Optimization

-  **Room-based Broadcasting**: Messages only sent to relevant conversation participants
-  **Event Batching**: Batch similar events to reduce network overhead
-  **Connection Management**: Efficient connection pooling and cleanup

---

## Rate Limiting

-  **Message Sending**: 60 messages per minute per user
-  **Reaction Updates**: 120 reactions per minute per user
-  **Read Status Updates**: 30 batch operations per minute per user
-  **Conversation Creation**: 10 conversations per hour per user

---

## Security Considerations

### Authentication

-  All endpoints require valid JWT token
-  WebSocket connections require authentication

### Authorization

-  Users can only access conversations they're participants in
-  Group admins have additional permissions
-  File uploads are validated and scanned

### Data Validation

-  All input data is validated and sanitized
-  File uploads have size and type restrictions
-  Rate limiting prevents abuse

---

## Migration Guide

### Upgrading from Old Read System

#### Old Way (Inefficient):

```javascript
// Mark each message as read individually
for (const message of unreadMessages) {
   await markMessageAsRead(message.id);
}
```

#### New Way (Optimized):

```javascript
// Mark entire conversation as read with one call
await markConversationAsRead(conversationId, lastMessageId);
```

### Benefits of Migration:

-  **90%+ reduction** in API calls
-  **Faster read status updates**
-  **Detailed read receipts** (know who read what)
-  **Better real-time experience**
-  **Reduced server load**
