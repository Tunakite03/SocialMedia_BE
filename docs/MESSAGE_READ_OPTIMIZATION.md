# Message Read Status Optimization

## Tổng quan

Thay thế cách tracking read status từ field `isRead` đơn giản thành hệ thống tối ưu hơn với:

-  **MessageReadReceipt** table để track chi tiết read status
-  **lastReadMessageId** trên ConversationParticipant để track batch read
-  **API batch update** thay vì update từng message

## Schema Changes

### 1. MessageReadReceipt Model

```prisma
model MessageReadReceipt {
  id        String   @id @default(uuid())
  messageId String
  userId    String
  readAt    DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
}
```

### 2. ConversationParticipant Updates

```prisma
model ConversationParticipant {
  // ... existing fields
  lastReadMessageId String?
  lastReadAt        DateTime?

  lastReadMessage Message? @relation("UserLastReadMessage", fields: [lastReadMessageId], references: [id])
}
```

## New APIs

### 1. Mark Conversation as Read (Batch)

**POST** `/api/conversations/:conversationId/read`

**Body:**

```json
{
   "lastMessageId": "optional-message-id" // If not provided, marks all messages as read
}
```

**Response:**

```json
{
   "success": true,
   "data": {
      "unreadCount": 0,
      "lastReadMessageId": "message-id"
   },
   "message": "Messages marked as read"
}
```

### 2. Get Unread Count for Conversation

**GET** `/api/conversations/:conversationId/unread-count`

**Response:**

```json
{
   "success": true,
   "data": {
      "unreadCount": 5,
      "lastReadMessageId": "message-id",
      "lastReadAt": "2024-01-01T10:00:00Z"
   }
}
```

### 3. Get All Unread Counts

**GET** `/api/conversations/unread-counts`

**Response:**

```json
{
   "success": true,
   "data": {
      "totalUnreadCount": 15,
      "conversations": [
         {
            "conversationId": "conv-1",
            "conversation": { "id": "conv-1", "title": "Group Chat" },
            "unreadCount": 5,
            "lastReadMessageId": "msg-123",
            "lastReadAt": "2024-01-01T10:00:00Z"
         }
      ]
   }
}
```

## Updated APIs

### 1. Get Messages (Enhanced)

**GET** `/api/conversations/:conversationId/messages`

**Response now includes:**

```json
{
  "data": {
    "messages": [
      {
        "id": "msg-id",
        "content": "Hello",
        "sender": { ... },
        "isReadByCurrentUser": true,
        "readBy": [
          {
            "user": { "id": "user-id", "username": "john" },
            "readAt": "2024-01-01T10:00:00Z"
          }
        ],
        "readCount": 2
      }
    ],
    "unreadCount": 3,
    "lastReadMessageId": "msg-123",
    "lastReadAt": "2024-01-01T09:00:00Z",
    "participants": [...]
  }
}
```

### 2. Get Conversations (Enhanced)

**GET** `/api/conversations`

**Response now includes:**

```json
{
  "data": {
    "conversations": [
      {
        "id": "conv-id",
        "title": "Group Chat",
        "type": "GROUP",
        "participants": [...],
        "lastMessage": {
          "content": "Hello",
          "isReadByCurrentUser": true,
          "readCount": 2
        },
        "unreadCount": 5,
        "lastReadMessageId": "msg-123",
        "lastReadAt": "2024-01-01T09:00:00Z",
        "otherParticipant": { ... } // For DIRECT conversations
      }
    ]
  }
}
```

## WebSocket Events

### 1. Mark Conversation as Read (Client → Server)

```javascript
socket.emit('conversation:markAsRead', {
   conversationId: 'conv-id',
   lastMessageId: 'msg-id', // optional
});
```

### 2. Messages Read Status Update (Server → Clients)

```javascript
socket.on('messages:read', (data) => {
   // data: { userId, lastReadMessageId, readAt }
});
```

### 3. Single Message Read (Legacy)

```javascript
socket.emit('message:read', { messageId: 'msg-id' });
socket.on('message:read', (data) => {
   // data: { messageId, readBy, readAt }
});
```

## Performance Benefits

### Before (Problems)

-  ❌ Mỗi message cần 1 API call để mark read
-  ❌ Không biết ai đã đọc trong group chat
-  ❌ Database queries không tối ưu
-  ❌ Nhiều API calls không cần thiết

### After (Solutions)

-  ✅ **Batch update**: 1 API call cho toàn bộ conversation
-  ✅ **Detailed tracking**: Biết chính xác ai đã đọc tin nhắn nào
-  ✅ **Optimized queries**: Index trên các fields quan trọng
-  ✅ **Real-time updates**: WebSocket events cho instant feedback
-  ✅ **Smart unread count**: Calculate based on lastReadMessage

## Migration Strategy

1. ✅ **Schema Update**: Đã thêm MessageReadReceipt và update ConversationParticipant
2. ✅ **API Implementation**: Đã implement các API mới
3. 🔄 **Client Migration**: Update frontend để sử dụng batch API
4. 🔄 **Legacy Support**: Giữ lại old APIs trong thời gian transition

## Usage Examples

### Frontend Integration

```javascript
// Mark conversation as read when user views messages
async function markConversationAsRead(conversationId, lastMessageId) {
   const response = await fetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastMessageId }),
   });
   return response.json();
}

// Get unread count for badge display
async function getUnreadCounts() {
   const response = await fetch('/api/conversations/unread-counts');
   return response.json();
}

// WebSocket integration
socket.on('messages:read', (data) => {
   updateConversationReadStatus(data);
});
```

### Mobile App Optimization

```javascript
// Batch mark as read when app comes to foreground
document.addEventListener('visibilitychange', () => {
   if (document.visibilityState === 'visible' && currentConversationId) {
      markConversationAsRead(currentConversationId);
   }
});
```

## Performance Monitoring

### Metrics to Track

-  API call reduction (before vs after)
-  Database query performance
-  Real-time update latency
-  User engagement with read receipts

### Expected Improvements

-  🎯 **90%+ reduction** in read status API calls
-  🎯 **Faster message loading** với optimized queries
-  🎯 **Better UX** với detailed read receipts
-  🎯 **Reduced server load** với batch operations
