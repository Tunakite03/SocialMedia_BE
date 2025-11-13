const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SAMPLE_TOPICS = [
   'Exploring cutting-edge AI tools',
   'Daily life of a remote developer',
   'Design inspirations for mobile apps',
   'Productivity hacks that actually work',
   'Weekend adventures and cityscapes',
   'Healthy recipes for busy people',
   'Thoughts on startup culture',
   'Recommended anime this season',
   'Mindfulness and mental health check-ins',
   'Favorite gadgets of the month',
   'Photography tips for golden hour',
   'Behind the scenes of a creative project',
];

const SAMPLE_VIDEO_URLS = [
   'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
   'https://samplelib.com/lib/preview/mp4/sample-10s.mp4',
   'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
];

const POSTS_PER_USER = 15;
const SAMPLE_COMMENT_LINES = [
   'Really enjoying this update!',
   'Totally agree with your thoughts.',
   'Thanks for sharing—super helpful.',
   'This looks amazing, keep it up!',
   'Love the vibe here.',
   'Adding this to my inspiration board.',
];

const REACTION_TYPES = ['LIKE', 'LOVE', 'LAUGH', 'WOW'];

async function main() {
   console.log('🌱 Starting database seeding...');

   // Create admin user
   const hashedPassword = await bcrypt.hash('admin123', 12);

   const adminUser = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {
         email: 'admin@otakomi.com',
         password: hashedPassword,
         displayName: 'Admin User',
         role: 'ADMIN',
         emailVerified: true,
         bio: 'Platform administrator',
      },
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
         where: { username: userData.username },
         update: {
            email: userData.email,
            displayName: userData.displayName,
            bio: userData.bio,
            password: hashedPass,
            emailVerified: true,
         },
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

   // Rebuild sample posts for a richer feed experience
   await prisma.reaction.deleteMany();
   await prisma.comment.deleteMany();
   await prisma.post.deleteMany();

   const now = Date.now();
   const generatedPosts = createdUsers.flatMap((user, userIndex) =>
      Array.from({ length: POSTS_PER_USER }, (_, postIndex) => {
         const globalIndex = userIndex * POSTS_PER_USER + postIndex;
         const topic = SAMPLE_TOPICS[globalIndex % SAMPLE_TOPICS.length];
         const typeRoll = globalIndex % 6;

         let type = 'TEXT';
         if (typeRoll === 0 || typeRoll === 3) {
            type = 'IMAGE';
         } else if (typeRoll === 5) {
            type = 'VIDEO';
         }

         const postData = {
            content: `${topic} — ${user.displayName} update #${postIndex + 1}`,
            authorId: user.id,
            type,
            isPublic: true,
            createdAt: new Date(now - globalIndex * 60 * 60 * 1000),
         };

         if (type === 'IMAGE') {
            postData.mediaUrl = `https://picsum.photos/seed/${user.username}-${postIndex}/800/600`;
         } else if (type === 'VIDEO') {
            postData.mediaUrl = SAMPLE_VIDEO_URLS[globalIndex % SAMPLE_VIDEO_URLS.length];
         }

         return postData;
      })
   );

   await prisma.post.createMany({
      data: generatedPosts,
   });

   console.log(`✅ Generated ${generatedPosts.length} sample posts`);

   // Add sample comments and reactions to top feed posts
   const postsForInteractions = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
   });

   const primaryComments = [];

   for (let i = 0; i < postsForInteractions.length; i += 1) {
      const post = postsForInteractions[i];
      const authorA = createdUsers[(i + 1) % createdUsers.length];
      const authorB = createdUsers[(i + 2) % createdUsers.length];

      const parentComment = await prisma.comment.create({
         data: {
            content: `${SAMPLE_COMMENT_LINES[i % SAMPLE_COMMENT_LINES.length]} (${authorA.displayName})`,
            postId: post.id,
            authorId: authorA.id,
            createdAt: new Date(now - (generatedPosts.length + i + 1) * 30 * 60 * 1000),
         },
      });

      primaryComments.push(parentComment);

      await prisma.comment.create({
         data: {
            content: `Reply from ${authorB.displayName}: ${
               SAMPLE_COMMENT_LINES[(i + 2) % SAMPLE_COMMENT_LINES.length]
            }`,
            postId: post.id,
            authorId: authorB.id,
            parentId: parentComment.id,
            createdAt: new Date(now - (generatedPosts.length + i + 1.5) * 30 * 60 * 1000),
         },
      });
   }

   const postReactionsData = postsForInteractions.slice(0, 3).flatMap((post, postIdx) =>
      createdUsers.map((user, userIdx) => ({
         type: REACTION_TYPES[(postIdx + userIdx) % REACTION_TYPES.length],
         userId: user.id,
         postId: post.id,
         createdAt: new Date(now - (generatedPosts.length + postIdx + userIdx + 1) * 15 * 60 * 1000),
      }))
   );

   if (postReactionsData.length) {
      await prisma.reaction.createMany({ data: postReactionsData, skipDuplicates: true });
   }

   const commentReactionsData = primaryComments.map((comment, idx) => {
      const reactingUser = createdUsers[idx % createdUsers.length];
      return {
         type: REACTION_TYPES[(idx + 1) % REACTION_TYPES.length],
         userId: reactingUser.id,
         commentId: comment.id,
         createdAt: new Date(now - (generatedPosts.length + idx + 5) * 10 * 60 * 1000),
      };
   });

   if (commentReactionsData.length) {
      await prisma.reaction.createMany({ data: commentReactionsData, skipDuplicates: true });
   }

   console.log('✅ Sample comments and reactions created');

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
         },
         {
            content: "Hi! I'm doing great, thanks for asking! How about you?",
            conversationId: conversation.id,
            senderId: createdUsers[1].id,
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
