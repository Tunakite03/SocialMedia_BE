const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, teardownTestDB, createTestUser } = require('./setup');

describe('Message and Conversation API', () => {
   let server;
   let user1, user2;
   let token1, token2;

   beforeAll(async () => {
      await setupTestDB();
      // Create server without starting it on a port
      const { createServer } = require('http');
      server = createServer(app);
   });

   beforeEach(async () => {
      // Create test users
      const userData1 = {
         email: 'user1@example.com',
         username: 'user1',
         password: 'password123',
         displayName: 'User 1',
      };

      const userData2 = {
         email: 'user2@example.com',
         username: 'user2',
         password: 'password123',
         displayName: 'User 2',
      };

      // Register users
      const registerRes1 = await request(app).post('/api/v1/auth/register').send(userData1);

      const registerRes2 = await request(app).post('/api/v1/auth/register').send(userData2);

      expect(registerRes1.status).toBe(201);
      expect(registerRes2.status).toBe(201);

      // Login users
      const loginRes1 = await request(app)
         .post('/api/v1/auth/login')
         .send({ email: userData1.email, password: userData1.password });

      const loginRes2 = await request(app)
         .post('/api/v1/auth/login')
         .send({ email: userData2.email, password: userData2.password });

      expect(loginRes1.status).toBe(200);
      expect(loginRes2.status).toBe(200);

      user1 = registerRes1.body.data.user;
      user2 = registerRes2.body.data.user;
      token1 = loginRes1.body.data.accessToken;
      token2 = loginRes2.body.data.accessToken;
   });

   afterAll(async () => {
      await teardownTestDB();
      if (server) {
         server.close();
      }
   });

   describe('GET /api/v1/messages/conversations', () => {
      it('should get empty conversations list for new user', async () => {
         const response = await request(app)
            .get('/api/v1/messages/conversations')
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         expect(response.body.success).toBe(true);
         expect(response.body.data.conversations).toBeInstanceOf(Array);
         expect(response.body.data.conversations.length).toBe(0);
      });
   });

   describe('GET /api/v1/messages/conversations/direct/:userId', () => {
      it('should create direct conversation between users', async () => {
         const response = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user2.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         expect(response.body.success).toBe(true);
         expect(response.body.data.conversation).toBeDefined();
         expect(response.body.data.conversation.type).toBe('DIRECT');
         expect(response.body.data.conversation.participants).toHaveLength(2);
      });

      it('should return existing direct conversation if already exists', async () => {
         // Create conversation first time
         const response1 = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user2.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         const conversationId = response1.body.data.conversation.id;

         // Get same conversation second time
         const response2 = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user2.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         expect(response2.body.data.conversation.id).toBe(conversationId);
      });

      it('should not allow conversation with self', async () => {
         const response = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user1.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(400);

         expect(response.body.success).toBe(false);
      });
   });

   describe('POST /api/v1/messages/conversations/group', () => {
      it('should create group conversation', async () => {
         const groupData = {
            title: 'Test Group',
            participantIds: [user2.id],
         };

         const response = await request(app)
            .post('/api/v1/messages/conversations/group')
            .set('Authorization', `Bearer ${token1}`)
            .send(groupData)
            .expect(201);

         expect(response.body.success).toBe(true);
         expect(response.body.data.conversation.type).toBe('GROUP');
         expect(response.body.data.conversation.title).toBe('Test Group');
         expect(response.body.data.conversation.participants).toHaveLength(2);
      });

      it('should require title for group conversation', async () => {
         const groupData = {
            participantIds: [user2.id],
         };

         const response = await request(app)
            .post('/api/v1/messages/conversations/group')
            .set('Authorization', `Bearer ${token1}`)
            .send(groupData)
            .expect(400);

         expect(response.body.success).toBe(false);
      });
   });

   describe('POST /api/v1/messages/conversations/:conversationId/messages', () => {
      let conversationId;

      beforeEach(async () => {
         // Create conversation first
         const convResponse = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user2.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         conversationId = convResponse.body.data.conversation.id;
      });

      it('should send message to conversation', async () => {
         const messageData = {
            content: 'Hello, this is a test message!',
         };

         const response = await request(app)
            .post(`/api/v1/messages/conversations/${conversationId}/messages`)
            .set('Authorization', `Bearer ${token1}`)
            .send(messageData)
            .expect(201);

         expect(response.body.success).toBe(true);
         expect(response.body.data.message.content).toBe(messageData.content);
         expect(response.body.data.message.senderId).toBe(user1.id);
         expect(response.body.data.message.conversationId).toBe(conversationId);
      });

      it('should require message content', async () => {
         const messageData = {
            content: '',
         };

         const response = await request(app)
            .post(`/api/v1/messages/conversations/${conversationId}/messages`)
            .set('Authorization', `Bearer ${token1}`)
            .send(messageData)
            .expect(400);

         expect(response.body.success).toBe(false);
      });
   });

   describe('POST /api/v1/messages/messages/:messageId/react', () => {
      let conversationId, messageId;

      beforeEach(async () => {
         // Create conversation and message first
         const convResponse = await request(app)
            .get(`/api/v1/messages/conversations/direct/${user2.id}`)
            .set('Authorization', `Bearer ${token1}`)
            .expect(200);

         conversationId = convResponse.body.data.conversation.id;

         const msgResponse = await request(app)
            .post(`/api/v1/messages/conversations/${conversationId}/messages`)
            .set('Authorization', `Bearer ${token1}`)
            .send({ content: 'Test message' })
            .expect(201);

         messageId = msgResponse.body.data.message.id;
      });

      it('should add reaction to message', async () => {
         const reactionData = { emoji: '👍' };

         const response = await request(app)
            .post(`/api/v1/messages/messages/${messageId}/react`)
            .set('Authorization', `Bearer ${token2}`)
            .send(reactionData)
            .expect(200);

         expect(response.body.success).toBe(true);
         expect(response.body.data.reaction.emoji).toBe('👍');
         expect(response.body.data.reaction.userId).toBe(user2.id);
      });

      it('should remove reaction if same emoji sent again', async () => {
         const reactionData = { emoji: '👍' };

         // Add reaction first
         await request(app)
            .post(`/api/v1/messages/messages/${messageId}/react`)
            .set('Authorization', `Bearer ${token2}`)
            .send(reactionData)
            .expect(200);

         // Remove reaction by sending same emoji
         const response = await request(app)
            .post(`/api/v1/messages/messages/${messageId}/react`)
            .set('Authorization', `Bearer ${token2}`)
            .send(reactionData)
            .expect(200);

         expect(response.body.data.reaction).toBeNull();
      });
   });
});
