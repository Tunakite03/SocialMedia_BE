const { PrismaClient } = require('@prisma/client');

// Test database setup
const prisma = new PrismaClient({
   datasources: {
      db: {
         url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/onway_test',
      },
   },
});

// Clean up database before each test
beforeEach(async () => {
   await prisma.$transaction([
      prisma.sentimentAnalysis.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.call.deleteMany(),
      prisma.reaction.deleteMany(),
      prisma.message.deleteMany(),
      prisma.conversationParticipant.deleteMany(),
      prisma.conversation.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.post.deleteMany(),
      prisma.follow.deleteMany(),
      prisma.user.deleteMany(),
   ]);
});

// Close database connection after all tests
afterAll(async () => {
   await prisma.$disconnect();
});

module.exports = { prisma };
