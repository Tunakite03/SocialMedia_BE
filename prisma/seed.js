const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
   console.log('🌱 Starting database seeding...');

   // Create admin user
   const hashedPassword = await bcrypt.hash('admin123', 12);

   const adminUser = await prisma.user.upsert({
      where: { email: 'admin@otakomi.com' },
      update: {},
      create: {
         email: 'admin@otakomi.com',
         username: 'admin',
         password: hashedPassword,
         displayName: 'Admin User',
         role: 'ADMIN',
         emailVerified: true,
         bio: 'Platform administrator',
      },
   });

   console.log('✅ Admin user created:', adminUser.email);

   // Create test users
   const testUsers = [
      {
         email: 'john@example.com',
         username: 'johndoe',
         displayName: 'John Doe',
         bio: 'Software developer passionate about technology',
      },
      {
         email: 'jane@example.com',
         username: 'janesmith',
         displayName: 'Jane Smith',
         bio: 'Designer and creative thinker',
      },
      {
         email: 'mike@example.com',
         username: 'mikejohnson',
         displayName: 'Mike Johnson',
         bio: 'Entrepreneur and business enthusiast',
      },
   ];

   const createdUsers = [];
   for (const userData of testUsers) {
      const hashedPass = await bcrypt.hash('password123', 12);
      const user = await prisma.user.upsert({
         where: { email: userData.email },
         update: {},
         create: {
            ...userData,
            password: hashedPass,
            emailVerified: true,
         },
      });
      createdUsers.push(user);
      console.log('✅ Test user created:', user.email);
   }

   // Create some follow relationships
   await prisma.follow.createMany({
      data: [
         { followerId: createdUsers[0].id, followingId: createdUsers[1].id },
         { followerId: createdUsers[1].id, followingId: createdUsers[0].id },
         { followerId: createdUsers[0].id, followingId: createdUsers[2].id },
         { followerId: createdUsers[2].id, followingId: createdUsers[0].id },
      ],
      skipDuplicates: true,
   });

   console.log('✅ Follow relationships created');

   // Create sample posts
   const posts = await prisma.post.createMany({
      data: [
         {
            content: 'Welcome to Otakomi! This is my first post on this amazing platform.',
            authorId: createdUsers[0].id,
            type: 'TEXT',
         },
         {
            content: 'Just finished an amazing project! Feeling excited about the future. 🚀',
            authorId: createdUsers[1].id,
            type: 'TEXT',
         },
         {
            content: 'Beautiful sunset today! Life is good. 🌅',
            authorId: createdUsers[2].id,
            type: 'TEXT',
         },
      ],
   });

   console.log('✅ Sample posts created');

   // Create a test conversation
   const conversation = await prisma.conversation.create({
      data: {
         type: 'DIRECT',
         participants: {
            createMany: {
               data: [{ userId: createdUsers[0].id }, { userId: createdUsers[1].id }],
            },
         },
      },
   });

   // Create some messages
   await prisma.message.createMany({
      data: [
         {
            content: 'Hey there! How are you doing?',
            conversationId: conversation.id,
            senderId: createdUsers[0].id,
            receiverId: createdUsers[1].id,
         },
         {
            content: "Hi! I'm doing great, thanks for asking! How about you?",
            conversationId: conversation.id,
            senderId: createdUsers[1].id,
            receiverId: createdUsers[0].id,
         },
      ],
   });

   console.log('✅ Sample conversation and messages created');

   console.log('🎉 Database seeding completed successfully!');
}

main()
   .then(async () => {
      await prisma.$disconnect();
   })
   .catch(async (e) => {
      console.error('❌ Error during seeding:', e);
      await prisma.$disconnect();
      process.exit(1);
   });
