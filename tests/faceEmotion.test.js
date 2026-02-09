const io = require('socket.io-client');
const axios = require('axios');

/**
 * Test Face Emotion Features
 * Run after starting the server
 */

const SERVER_URL = 'http://localhost:3000';
let socket;
let accessToken;

// Test data
const testUser = {
   email: 'test@example.com',
   password: 'Test123456',
};

const testCallId = 'test-call-id'; // Replace with actual call ID

async function login() {
   console.log(' Logging in...');
   try {
      const response = await axios.post(`${SERVER_URL}/api/auth/login`, testUser);
      accessToken = response.data.data.accessToken;
      console.log('✅ Login successful');
      return true;
   } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
   }
}

function connectSocket() {
   console.log('\n📡 Connecting to Socket.IO...');
   return new Promise((resolve, reject) => {
      socket = io(SERVER_URL, {
         auth: {
            token: accessToken,
         },
      });

      socket.on('connect', () => {
         console.log('✅ Socket connected:', socket.id);
         resolve();
      });

      socket.on('connect_error', (error) => {
         console.error('❌ Socket connection error:', error.message);
         reject(error);
      });
   });
}

function testEmotionBroadcast() {
   console.log('\n🎭 Testing emotion broadcast...');

   // Listen for emotions from others
   socket.on('call:emotion', (data) => {
      console.log('📨 Received emotion:', data);
   });

   socket.on('call:emotion:error', (error) => {
      console.error('❌ Emotion error:', error);
   });

   // Send test emotions
   const emotions = ['ENJOYMENT', 'SADNESS', 'ANGER', 'SURPRISE'];
   let index = 0;

   const interval = setInterval(() => {
      const emotion = emotions[index % emotions.length];
      const confidence = Math.random() * 0.3 + 0.7; // 0.7 - 1.0

      console.log(`📤 Sending emotion: ${emotion} (${(confidence * 100).toFixed(1)}%)`);

      socket.emit('call:emotion', {
         callId: testCallId,
         emotion: emotion,
         confidence: confidence,
         metadata: {
            test: true,
            timestamp: Date.now(),
         },
      });

      index++;

      if (index >= 8) {
         clearInterval(interval);
         console.log('✅ Emotion broadcast test completed');
         setTimeout(() => testEmotionStats(), 1000);
      }
   }, 1500);
}

function testEmotionStats() {
   console.log('\n📊 Testing emotion statistics...');

   socket.emit('call:emotion:stats', {
      callId: testCallId,
   });

   socket.on('call:emotion:stats', (data) => {
      console.log('✅ Received emotion stats:');
      console.log(JSON.stringify(data, null, 2));
      setTimeout(() => testRestAPI(), 1000);
   });

   socket.on('call:emotion:stats:error', (error) => {
      console.error('❌ Stats error:', error);
      setTimeout(() => testRestAPI(), 1000);
   });
}

async function testRestAPI() {
   console.log('\n🌐 Testing REST API endpoints...');

   const headers = {
      Authorization: `Bearer ${accessToken}`,
   };

   // 1. Test POST /api/face-emotions
   console.log('\n1️⃣ Testing POST /api/face-emotions');
   try {
      const response = await axios.post(
         `${SERVER_URL}/api/face-emotions`,
         {
            callId: testCallId,
            emotion: 'FEAR',
            confidence: 0.75,
            metadata: { test: true },
         },
         { headers },
      );
      console.log('✅ POST success:', response.data.message);
   } catch (error) {
      console.error('❌ POST failed:', error.response?.data || error.message);
   }

   // 2. Test GET /api/face-emotions/recent
   console.log('\n2️⃣ Testing GET /api/face-emotions/recent');
   try {
      const response = await axios.get(`${SERVER_URL}/api/face-emotions/recent?limit=5`, {
         headers,
      });
      console.log(`✅ GET recent success: Found ${response.data.data.length} emotions`);
   } catch (error) {
      console.error('❌ GET recent failed:', error.response?.data || error.message);
   }

   // 3. Test GET /api/face-emotions/call/:callId
   console.log('\n3️⃣ Testing GET /api/face-emotions/call/:callId');
   try {
      const response = await axios.get(`${SERVER_URL}/api/face-emotions/call/${testCallId}`, { headers });
      console.log(`✅ GET call emotions success: Found ${response.data.data.length} emotions`);
   } catch (error) {
      console.error('❌ GET call emotions failed:', error.response?.data || error.message);
   }

   // 4. Test GET /api/face-emotions/call/:callId/stats
   console.log('\n4️⃣ Testing GET /api/face-emotions/call/:callId/stats');
   try {
      const response = await axios.get(`${SERVER_URL}/api/face-emotions/call/${testCallId}/stats`, { headers });
      console.log('✅ GET stats success:');
      console.log(JSON.stringify(response.data.data, null, 2));
   } catch (error) {
      console.error('❌ GET stats failed:', error.response?.data || error.message);
   }

   // 5. Test GET /api/face-emotions/call/:callId/timeline
   console.log('\n5️⃣ Testing GET /api/face-emotions/call/:callId/timeline');
   try {
      const response = await axios.get(`${SERVER_URL}/api/face-emotions/call/${testCallId}/timeline?interval=1`, {
         headers,
      });
      console.log(`✅ GET timeline success: ${response.data.data.length} intervals`);
   } catch (error) {
      console.error('❌ GET timeline failed:', error.response?.data || error.message);
   }

   console.log('\n🎉 All tests completed!');
   cleanup();
}

function cleanup() {
   console.log('\n🧹 Cleaning up...');
   if (socket) {
      socket.disconnect();
      console.log('✅ Socket disconnected');
   }
   console.log('👋 Test completed');
   process.exit(0);
}

// Run tests
async function runTests() {
   console.log('🚀 Starting Face Emotion Tests...\n');

   try {
      const loggedIn = await login();
      if (!loggedIn) {
         console.error('❌ Cannot proceed without login');
         process.exit(1);
      }

      await connectSocket();
      testEmotionBroadcast();
   } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
   }
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Run if executed directly
if (require.main === module) {
   runTests();
}

module.exports = { runTests };
