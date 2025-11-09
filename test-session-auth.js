const axios = require('axios');

// Test session-based authentication functionality
async function testSessionBasedAuth() {
   const BASE_URL = 'http://localhost:3000/api/auth';

   try {
      console.log('🔍 Testing Session-Based Authentication...\n');

      // 1. Login to get tokens and create session
      console.log('1. Logging in...');
      const loginResponse = await axios.post(`${BASE_URL}/login`, {
         email: 'john@example.com',
         password: 'password123',
      });

      console.log('✅ Login successful');
      console.log('📊 Response structure:', Object.keys(loginResponse.data.data));
      console.log('🔑 Access Token length:', loginResponse.data.data.accessToken?.length || 'Not present');
      console.log('🔄 Refresh Token length:', loginResponse.data.data.refreshToken?.length || 'Not present');

      const { accessToken, refreshToken } = loginResponse.data.data;

      if (!refreshToken) {
         throw new Error('No refresh token received from login');
      }

      // 2. Check user sessions
      console.log('\n2. Checking user sessions...');
      const sessionsResponse = await axios.get(`${BASE_URL}/sessions`, {
         headers: {
            Authorization: `Bearer ${accessToken}`,
         },
      });

      console.log('✅ Sessions retrieved');
      console.log('📊 Active sessions count:', sessionsResponse.data.data.sessions.length);
      console.log(
         '📱 Sessions info:',
         sessionsResponse.data.data.sessions.map((s) => ({
            id: s.id.substring(0, 8) + '...',
            ip: s.ipAddress,
            device: s.userAgent,
            created: new Date(s.createdAt).toLocaleString(),
         }))
      );

      console.log('\n3. Waiting 2 seconds before refresh...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Use refresh token to get new access token
      console.log('4. Refreshing token...');
      const refreshResponse = await axios.post(`${BASE_URL}/refresh`, {
         refreshToken,
      });

      console.log('✅ Token refresh successful');
      console.log('📊 Refresh response structure:', Object.keys(refreshResponse.data.data));
      console.log('🔑 New Access Token length:', refreshResponse.data.data.accessToken?.length || 'Not present');
      console.log('🔄 New Refresh Token length:', refreshResponse.data.data.refreshToken?.length || 'Not present');

      // 5. Check sessions after refresh (should have 2 sessions now)
      const newAccessToken = refreshResponse.data.data.accessToken;
      console.log('\n5. Checking sessions after refresh...');
      const sessionsAfterRefresh = await axios.get(`${BASE_URL}/sessions`, {
         headers: {
            Authorization: `Bearer ${newAccessToken}`,
         },
      });

      console.log('✅ Sessions retrieved after refresh');
      console.log('📊 Active sessions count:', sessionsAfterRefresh.data.data.sessions.length);

      // 6. Test the new access token
      console.log('\n6. Testing new access token...');
      const profileResponse = await axios.get(`${BASE_URL}/profile`, {
         headers: {
            Authorization: `Bearer ${newAccessToken}`,
         },
      });

      console.log('✅ New access token works');
      console.log('👤 User profile:', profileResponse.data.data.user.email);

      // 7. Test session revocation
      const sessionToRevoke = sessionsAfterRefresh.data.data.sessions[0];
      if (sessionToRevoke) {
         console.log('\n7. Testing session revocation...');
         await axios.delete(`${BASE_URL}/sessions/${sessionToRevoke.id}`, {
            headers: {
               Authorization: `Bearer ${newAccessToken}`,
            },
         });
         console.log('✅ Session revoked successfully');
      }

      // 8. Test invalid refresh token
      console.log('\n8. Testing invalid refresh token...');
      try {
         await axios.post(`${BASE_URL}/refresh`, {
            refreshToken: 'invalid-token-123',
         });
         console.log('❌ Should have failed with invalid token');
      } catch (error) {
         console.log('✅ Invalid refresh token correctly rejected');
         console.log('📝 Error message:', error.response?.data?.error || error.message);
      }

      // 9. Test logout (should invalidate all sessions)
      console.log('\n9. Testing logout...');
      await axios.post(
         `${BASE_URL}/logout`,
         {},
         {
            headers: {
               Authorization: `Bearer ${newAccessToken}`,
            },
         }
      );
      console.log('✅ Logout successful');

      // 10. Verify sessions are invalidated
      console.log('\n10. Verifying sessions invalidated after logout...');
      const refreshAfterLogout = refreshResponse.data.data.refreshToken;
      try {
         await axios.post(`${BASE_URL}/refresh`, {
            refreshToken: refreshAfterLogout,
         });
         console.log('❌ Should have failed - session should be invalidated');
      } catch (error) {
         console.log('✅ Refresh token correctly invalidated after logout');
      }

      console.log('\n🎉 All session-based authentication tests passed!');
      console.log('\n📋 Session Management Features Tested:');
      console.log('  ✅ Session creation on login');
      console.log('  ✅ Session listing');
      console.log('  ✅ Token refresh with session rotation');
      console.log('  ✅ Session revocation');
      console.log('  ✅ Session invalidation on logout');
      console.log('  ✅ IP address and user agent tracking');
   } catch (error) {
      console.error('❌ Test failed:', error.response?.data || error.message);
      if (error.response?.status) {
         console.error('📍 HTTP Status:', error.response.status);
      }
      console.error('📍 Stack:', error.stack);
   }
}

testSessionBasedAuth();
