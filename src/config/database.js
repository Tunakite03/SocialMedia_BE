const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
   prisma = new PrismaClient();
} else {
   // Prevent multiple instances in development
   if (!global.__prisma) {
      global.__prisma = new PrismaClient({
         log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
   }
   prisma = global.__prisma;
}

module.exports = prisma;
