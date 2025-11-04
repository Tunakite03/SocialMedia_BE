const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../setup');

describe('Auth Endpoints', () => {
   let server;

   beforeAll(() => {
      server = app.listen();
   });

   afterAll(() => {
      server.close();
   });

   describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
         const userData = {
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
         };

         const response = await request(app).post('/api/auth/register').send(userData).expect(201);

         expect(response.body.success).toBe(true);
         expect(response.body.data.user.email).toBe(userData.email);
         expect(response.body.data.token).toBeDefined();
      });

      it('should reject registration with invalid email', async () => {
         const userData = {
            email: 'invalid-email',
            username: 'testuser',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
         };

         const response = await request(app).post('/api/auth/register').send(userData).expect(400);

         expect(response.body.success).toBe(false);
      });
   });

   describe('POST /api/auth/login', () => {
      beforeEach(async () => {
         // Create a test user
         await request(app).post('/api/auth/register').send({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
         });
      });

      it('should login successfully with valid credentials', async () => {
         const response = await request(app)
            .post('/api/auth/login')
            .send({
               email: 'test@example.com',
               password: 'password123',
            })
            .expect(200);

         expect(response.body.success).toBe(true);
         expect(response.body.data.token).toBeDefined();
      });

      it('should reject login with invalid credentials', async () => {
         const response = await request(app)
            .post('/api/auth/login')
            .send({
               email: 'test@example.com',
               password: 'wrongpassword',
            })
            .expect(401);

         expect(response.body.success).toBe(false);
      });
   });
});
