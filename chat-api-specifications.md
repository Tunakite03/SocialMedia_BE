# Chat API Integration Guide

**Version:** 1.4.0  
**Last Updated:** November 13, 2025  
**Base URL:** `http://localhost:8080/api/v1` (Development) | `https://otakomi-backend.onrender.com/api/v1` (Production)  
**Socket.IO:** `ws://localhost:8080` (Development) | `wss://otakomi-backend.onrender.com` (Production)

This guide provides a comprehensive guide for frontend developers to integrate chat functionality with the OnWay backend API.

## Table of Contents

1. [Authentication Setup](#1-authentication-setup)
2. [Core Chat Endpoints](#2-core-chat-endpoints)
3. [Socket.IO Integration](#3-socketio-integration)
4. [React Hook Example](#4-react-hook-example)
5. [Error Handling](#5-error-handling)
6. [File Upload Example](#6-file-upload-example)
7. [Pagination Implementation](#7-pagination-implementation)
8. [Best Practices](#8-best-practices)
9. [API Reference](#9-api-reference)

---

## 1. Authentication Setup

All chat endpoints require Bearer token authentication:

```javascript
const token = localStorage.getItem('accessToken');
const headers = {
   Authorization: `Bearer ${token}`,
   'Content-Type': 'application/json',
};
```

---

## 2. Core Chat Endpoints

### Get User Conversations

```javascript
// GET /api/conversations
async function getConversations(page = 1, limit = 10) {
   const response = await fetch(`/api/conversations?limit=${limit}&offset=${(page - 1) * limit}`, {
      headers,
   });
   return response.json();
}
```

### Get or Create Direct Conversation

```javascript
// GET /api/conversations/direct/{userId}
async function getOrCreateDirectConversation(userId) {
   const response = await fetch(`/api/conversations/direct/${userId}`, {
      headers,
   });
   return response.json();
}
```

### Create Group Conversation

```javascript
// POST /api/conversations/group
async function createGroupConversation(title, participantIds) {
   const response = await fetch('/api/conversations/group', {
      method: 'POST',
      headers,
      body: JSON.stringify({
         title,
         participantIds,
      }),
   });
   return response.json();
}
```

### Get Conversation Messages

```javascript
// GET /api/conversations/{conversationId}/messages
async function getMessages(conversationId, page = 1, limit = 20) {
   const response = await fetch(
      `/api/conversations/${conversationId}/messages?limit=${limit}&offset=${(page - 1) * limit}`,
      {
         headers,
      }
   );
   return response.json();
}
```

### Send Message

```javascript
// POST /api/conversations/{conversationId}/messages
async function sendMessage(conversationId, content, replyToId = null) {
   const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
         content,
         replyToId,
      }),
   });
   return response.json();
}
```

### React to Message

```javascript
// POST /api/messages/{messageId}/react
async function reactToMessage(messageId, emoji) {
   const response = await fetch(`/api/messages/${messageId}/react`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ emoji }),
   });
   return response.json();
}
```

### Upload Message Attachment

```javascript
// POST /api/messages/{messageId}/attachments
async function uploadAttachment(messageId, file) {
   const formData = new FormData();
   formData.append('file', file);

   const response = await fetch(`/api/messages/${messageId}/attachments`, {
      method: 'POST',
      headers: {
         Authorization: `Bearer ${token}`,
         // Don't set Content-Type for FormData
      },
      body: formData,
   });
   return response.json();
}
```

---

## 3. Socket.IO Integration

### Connection Setup

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:8080', {
   auth: {
      token: localStorage.getItem('accessToken'),
   },
});

// Connection events
socket.on('connect', () => {
   console.log('Connected to chat server');
});

socket.on('disconnect', () => {
   console.log('Disconnected from chat server');
});
```

### Join Conversation Room

```javascript
function joinConversation(conversationId) {
   socket.emit('conversation:join', { conversationId });
}

function leaveConversation(conversationId) {
   socket.emit('conversation:leave', { conversationId });
}
```

### Real-time Message Handling

```javascript
// Listen for new messages
socket.on('message:new', (message) => {
   // Add message to UI
   addMessageToUI(message);
});

// Listen for message reactions
socket.on('message:reaction', (data) => {
   // Update message reactions in UI
   updateMessageReactions(data.messageId, data.reaction, data.action);
});

// Listen for typing indicators
socket.on('typing:start', (data) => {
   showTypingIndicator(data.userId, data.conversationId);
});

socket.on('typing:stop', (data) => {
   hideTypingIndicator(data.userId, data.conversationId);
});
```

### Send Messages via Socket.IO

```javascript
function sendMessageViaSocket(conversationId, content, replyToId = null) {
   socket.emit('message:send', {
      conversationId,
      content,
      type: 'TEXT',
      replyToId,
   });
}

// Typing indicators
function startTyping(conversationId) {
   socket.emit('typing:start', { conversationId });
}

function stopTyping(conversationId) {
   socket.emit('typing:stop', { conversationId });
}
```

---

## 4. React Hook Example

```javascript
import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

function useChat(conversationId) {
   const [messages, setMessages] = useState([]);
   const [socket, setSocket] = useState(null);
   const [isTyping, setIsTyping] = useState(false);

   useEffect(() => {
      // Initialize socket connection
      const newSocket = io('ws://localhost:8080', {
         auth: { token: localStorage.getItem('accessToken') },
      });

      // Join conversation
      newSocket.emit('conversation:join', { conversationId });

      // Listen for messages
      newSocket.on('message:new', (message) => {
         setMessages((prev) => [...prev, message]);
      });

      // Listen for reactions
      newSocket.on('message:reaction', (data) => {
         setMessages((prev) =>
            prev.map((msg) =>
               msg.id === data.messageId ? { ...msg, reactions: updateReactions(msg.reactions, data) } : msg
            )
         );
      });

      // Listen for typing
      newSocket.on('typing:start', () => setIsTyping(true));
      newSocket.on('typing:stop', () => setIsTyping(false));

      setSocket(newSocket);

      return () => {
         newSocket.emit('conversation:leave', { conversationId });
         newSocket.close();
      };
   }, [conversationId]);

   const sendMessage = useCallback(
      async (content, replyToId = null) => {
         if (socket) {
            socket.emit('message:send', {
               conversationId,
               content,
               type: 'TEXT',
               replyToId,
            });
         }
      },
      [socket, conversationId]
   );

   const reactToMessage = useCallback(
      async (messageId, emoji) => {
         if (socket) {
            socket.emit('message:react', { messageId, emoji });
         }
      },
      [socket]
   );

   const startTyping = useCallback(() => {
      if (socket) {
         socket.emit('typing:start', { conversationId });
      }
   }, [socket, conversationId]);

   const stopTyping = useCallback(() => {
      if (socket) {
         socket.emit('typing:stop', { conversationId });
      }
   }, [socket, conversationId]);

   return {
      messages,
      sendMessage,
      reactToMessage,
      startTyping,
      stopTyping,
      isTyping,
   };
}

function updateReactions(existingReactions, reactionData) {
   // Helper function to update reactions array
   const { reaction, action } = reactionData;
   if (action === 'removed') {
      return existingReactions.filter((r) => r.id !== reaction.id);
   } else {
      const existing = existingReactions.find((r) => r.id === reaction.id);
      if (existing) {
         return existingReactions.map((r) => (r.id === reaction.id ? reaction : r));
      } else {
         return [...existingReactions, reaction];
      }
   }
}

export default useChat;
```

---

## 5. Error Handling

```javascript
// Handle API errors
function handleApiError(error) {
   if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
   } else if (error.response?.status === 403) {
      // Access denied
      alert('You do not have permission to perform this action');
   } else if (error.response?.status === 404) {
      // Not found
      alert('Conversation or message not found');
   } else {
      // Generic error
      alert('An error occurred. Please try again.');
   }
}

// Handle Socket.IO errors
socket.on('connect_error', (error) => {
   console.error('Socket connection error:', error);
   // Attempt to reconnect or show offline status
});

socket.on('message:error', (error) => {
   console.error('Message send error:', error);
   alert('Failed to send message. Please try again.');
});
```

---

## 6. File Upload Example

```javascript
function ChatInput({ conversationId, onSend }) {
   const [message, setMessage] = useState('');
   const [file, setFile] = useState(null);
   const [uploading, setUploading] = useState(false);

   const handleSend = async () => {
      if (!message.trim() && !file) return;

      setUploading(true);
      try {
         if (file) {
            // Upload file first
            const attachmentResponse = await uploadAttachmentToMessage(message, file);
            if (attachmentResponse.success) {
               onSend(attachmentResponse.data.message);
            }
         } else {
            // Send text message
            const response = await sendMessage(conversationId, message);
            if (response.success) {
               onSend(response.data.message);
            }
         }
         setMessage('');
         setFile(null);
      } catch (error) {
         handleApiError(error);
      } finally {
         setUploading(false);
      }
   };

   const handleFileSelect = (event) => {
      const selectedFile = event.target.files[0];
      if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
         // 5MB limit
         alert('File size must be less than 5MB');
         return;
      }
      setFile(selectedFile);
   };

   return (
      <div className='chat-input'>
         <input
            type='text'
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Type a message...'
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
         />
         <input
            type='file'
            onChange={handleFileSelect}
            accept='image/*,.pdf,.doc,.docx,.txt'
         />
         <button
            onClick={handleSend}
            disabled={uploading}
         >
            {uploading ? 'Sending...' : 'Send'}
         </button>
      </div>
   );
}
```

---

## 7. Pagination Implementation

```javascript
function MessagesList({ conversationId }) {
   const [messages, setMessages] = useState([]);
   const [pagination, setPagination] = useState(null);
   const [loading, setLoading] = useState(false);

   const loadMessages = async (page = 1) => {
      setLoading(true);
      try {
         const response = await getMessages(conversationId, page);
         if (response.success) {
            setMessages(response.data.messages);
            setPagination(response.pagination);
         }
      } catch (error) {
         handleApiError(error);
      } finally {
         setLoading(false);
      }
   };

   const loadMore = () => {
      if (pagination?.hasMore) {
         loadMessages(pagination.page + 1);
      }
   };

   useEffect(() => {
      loadMessages();
   }, [conversationId]);

   return (
      <div className='messages-list'>
         {messages.map((message) => (
            <MessageItem
               key={message.id}
               message={message}
            />
         ))}
         {pagination?.hasMore && (
            <button
               onClick={loadMore}
               disabled={loading}
            >
               {loading ? 'Loading...' : 'Load More'}
            </button>
         )}
      </div>
   );
}
```

---

## 8. Best Practices

1. **Connection Management:**

   -  Initialize Socket.IO connection once and reuse
   -  Join/leave conversation rooms as needed
   -  Handle reconnection automatically

2. **Message State:**

   -  Use optimistic updates for better UX
   -  Sync with server state via Socket.IO events
   -  Handle message delivery failures gracefully

3. **File Uploads:**

   -  Validate file types and sizes on frontend
   -  Show upload progress indicators
   -  Handle upload failures with retry options

4. **Real-time Updates:**

   -  Listen for all relevant Socket.IO events
   -  Update UI immediately for better responsiveness
   -  Handle offline/online status changes

5. **Error Handling:**

   -  Implement comprehensive error handling
   -  Provide user-friendly error messages
   -  Handle authentication errors by redirecting to login

6. **Performance:**
   -  Implement message pagination for large conversations
   -  Use virtual scrolling for message lists
   -  Debounce typing indicators

---

## 9. API Reference

### REST Endpoints

| Method | Endpoint                                   | Description                       |
| ------ | ------------------------------------------ | --------------------------------- |
| GET    | `/conversations`                           | Get user's conversations          |
| GET    | `/conversations/direct/{userId}`           | Get or create direct conversation |
| POST   | `/conversations/group`                     | Create group conversation         |
| GET    | `/conversations/{conversationId}/messages` | Get conversation messages         |
| POST   | `/conversations/{conversationId}/messages` | Send message                      |
| POST   | `/messages/{messageId}/react`              | React to message                  |
| POST   | `/messages/{messageId}/attachments`        | Upload attachment                 |

### Socket.IO Events

#### Client → Server

-  `conversation:join` - Join conversation room
-  `conversation:leave` - Leave conversation room
-  `message:send` - Send message
-  `message:react` - React to message
-  `typing:start` - Start typing
-  `typing:stop` - Stop typing

#### Server → Client

-  `message:new` - New message received
-  `message:reaction` - Message reaction updated
-  `message:attachment` - Attachment added
-  `typing:start` - User started typing
-  `typing:stop` - User stopped typing
-  `message:error` - Message send error

### Data Models

#### Conversation

```typescript
interface Conversation {
   id: string;
   title: string | null;
   type: 'DIRECT' | 'GROUP';
   participants: ConversationParticipant[];
   _count: {
      messages: number;
   };
   lastMessage?: Message;
   createdAt: string;
}
```

#### Message

```typescript
interface Message {
   id: string;
   content: string;
   type: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
   conversationId: string;
   senderId: string;
   sender: User;
   replyToId: string | null;
   replyTo?: Message;
   reactions: MessageReaction[];
   attachments: MessageAttachment[];
   createdAt: string;
}
```

#### MessageReaction

```typescript
interface MessageReaction {
   id: string;
   messageId: string;
   userId: string;
   emoji: string;
   user: User;
   createdAt: string;
}
```

This guide provides everything needed to integrate chat functionality into your frontend application. The API is designed to be simple and intuitive while providing powerful real-time messaging capabilities.
