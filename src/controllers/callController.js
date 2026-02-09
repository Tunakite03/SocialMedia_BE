const prisma = require('../config/database');
const { successResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');
const livekitService = require('../services/livekitService');
const transcriptionService = require('../services/transcriptionService');
const livekitWebhookHandler = require('../services/livekitWebhookHandler');
const webrtcService = require('../services/webrtcService'); // Keep for backward compatibility during migration
const { createCallHistoryMessage } = require('./messageController');

// Global call ID mapping (same as in socketUtils)
const callIdMapping = global.callIdMapping || (global.callIdMapping = new Map());

// Helper function to resolve call ID (handle custom call IDs)
const resolveCallId = (callId) => {
   // If it's a UUID (36 chars with dashes), use it directly
   if (callId && callId.length === 36 && callId.includes('-')) {
      return callId;
   }
   // Otherwise, check if it's a mapped custom call ID
   return callIdMapping.get(callId) || callId;
};

/**
 * Initiate call in conversation (REST)
 */
const initiateCall = async (req, res, next) => {
   try {
      const { conversationId } = req.body;
      const { type = 'AUDIO' } = req.body;
      const initiatorId = req.user.id;

      // Verify conversation exists and user is participant
      const conversation = await prisma.conversation.findFirst({
         where: {
            id: conversationId,
            participants: {
               some: { userId: initiatorId },
            },
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isOnline: true,
                     },
                  },
               },
            },
         },
      });

      if (!conversation) {
         throw new NotFoundError('Conversation not found or access denied');
      }

      // Check if there's already an active call in this conversation
      const activeCall = await prisma.call.findFirst({
         where: {
            conversationId,
            status: {
               in: ['RINGING', 'ONGOING'],
            },
         },
      });

      // if (activeCall) {
      //    throw new ValidationError('There is already an active call in this conversation');
      // }

      // Create call
      const call = await prisma.call.create({
         data: {
            conversationId,
            initiatorId,
            type: type.toUpperCase(),
            status: 'RINGING',
         },
         include: {
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            conversation: {
               include: {
                  participants: {
                     include: {
                        user: {
                           select: {
                              id: true,
                              username: true,
                              displayName: true,
                              avatar: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      // Create call participants for all conversation participants
      const callParticipants = await Promise.all(
         conversation.participants.map((participant) =>
            prisma.callParticipant.create({
               data: {
                  callId: call.id,
                  userId: participant.userId,
                  status: participant.userId === initiatorId ? 'JOINED' : 'INVITED',
               },
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            }),
         ),
      );

      // Initialize LiveKit call (replaces WebRTC signaling)
      const livekitData = await livekitService.initializeCall(call.id, initiatorId, callParticipants, call.type);

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         const basePayload = {
            callId: call.id,
            caller: call.initiator,
            type: call.type.toLowerCase() === 'video' ? 'video' : 'audio',
            call: {
               ...call,
               // LiveKit connection data
               livekit: {
                  wsUrl: livekitData.wsUrl,
                  roomName: livekitData.room.roomName,
                  // Tokens will be requested via /token endpoint for security
               },
            },
            participants: callParticipants,
         };

         // Notify all participants except initiator
         conversation.participants.forEach((participant) => {
            if (participant.userId !== initiatorId) {
               io.to(`user_${participant.userId}`).emit('call:incoming', basePayload);
            }
         });

         // Update conversation room
         io.to(`conversation_${conversationId}`).emit('call:initiated', basePayload);
      }

      return successResponse(
         res,
         {
            call: { ...call, participants: callParticipants },
         },
         'Call initiated successfully',
         HTTP_STATUS.CREATED,
      );
   } catch (error) {
      console.error('Initiate call error:', error);
      next(error);
   }
};

/**
 * Answer call
 */
const answerCall = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find call and verify user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: callId,
            status: 'RINGING',
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or cannot be answered');
      }

      // Update call status to ongoing if first person to answer
      const updatedCall = await prisma.call.update({
         where: { id: callId },
         data: {
            status: 'ONGOING',
            startedAt: new Date(),
         },
      });

      // Update participant status to joined
      await prisma.callParticipant.update({
         where: {
            callId_userId: {
               callId,
               userId,
            },
         },
         data: {
            status: 'JOINED',
            joinedAt: new Date(),
         },
      });

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         // Legacy event (nếu code cũ có dùng)
         io.to(`conversation_${call.conversation.id}`).emit('call:answered', {
            callId,
            userId,
            call: updatedCall,
         });

         // Event mới FE WebRTC đang dùng
         io.to(`conversation_${call.conversation.id}`).emit('call:accepted', {
            callId,
            acceptedBy: userId,
            call: updatedCall,
         });
      }

      return successResponse(res, { call: updatedCall }, 'Call answered successfully');
   } catch (error) {
      console.error('Answer call error:', error);
      next(error);
   }
};

/**
 * End call
 */
const endCall = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find call and verify user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: callId,
            status: {
               in: ['RINGING', 'ONGOING'],
            },
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or already ended');
      }

      // Calculate duration if call was ongoing
      let duration = null;
      if (call.status === 'ONGOING' && call.startedAt) {
         duration = Math.floor((new Date() - new Date(call.startedAt)) / 1000);
      }

      // Update call status to ended
      const updatedCall = await prisma.call.update({
         where: { id: callId },
         data: {
            status: 'ENDED',
            endedAt: new Date(),
            duration: duration,
         },
      });

      // Update all participants status to left
      await prisma.callParticipant.updateMany({
         where: {
            callId,
            status: {
               in: ['INVITED', 'JOINED'],
            },
         },
         data: {
            status: 'LEFT',
            leftAt: new Date(),
         },
      });

      // Clear all LiveKit resources
      await livekitService.handleCallEnd(callId);

      // Create call history message in conversation
      await createCallHistoryMessage({
         id: call.id,
         conversationId: call.conversation.id,
         type: call.type,
         status: 'ENDED',
         duration: duration,
         startedAt: call.startedAt,
         endedAt: new Date(),
         initiator: call.initiator,
         participants: call.participants,
      });

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         const payload = {
            callId,
            endedBy: userId,
            call: updatedCall,
         };

         io.to(`conversation_${call.conversation.id}`).emit('call:ended', payload);

         // Optional alias nếu FE có nghe 'call:end'
         io.to(`conversation_${call.conversation.id}`).emit('call:end', payload);
      }

      return successResponse(res, { call: updatedCall }, 'Call ended successfully');
   } catch (error) {
      console.error('End call error:', error);
      next(error);
   }
};

/**
 * Reject call
 */
const rejectCall = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      // Find call and verify user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: callId,
            status: 'RINGING',
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or cannot be rejected');
      }

      // Update participant status to rejected
      await prisma.callParticipant.update({
         where: {
            callId_userId: {
               callId,
               userId,
            },
         },
         data: {
            status: 'REJECTED',
            leftAt: new Date(),
         },
      });

      // Check if all participants rejected (except initiator)
      const remainingParticipants = await prisma.callParticipant.count({
         where: {
            callId,
            status: {
               in: ['INVITED', 'JOINED'],
            },
         },
      });

      let updatedCall = call;
      let shouldCreateHistory = false;

      if (remainingParticipants <= 1) {
         // End call if no one else is available
         updatedCall = await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'ENDED',
               endedAt: new Date(),
            },
         });
         shouldCreateHistory = true;

         // Clear all timeouts when call is rejected by all
         webrtcService.clearCallTimeouts(callId);
      }

      // Create call history message when call is rejected by all
      if (shouldCreateHistory) {
         await createCallHistoryMessage({
            id: call.id,
            conversationId: call.conversation.id,
            type: call.type,
            status: 'REJECTED',
            duration: 0,
            startedAt: null,
            endedAt: new Date(),
            initiator: call.initiator,
            participants: call.participants,
         });
      }

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${call.conversation.id}`).emit('call:rejected', {
            callId,
            userId,
            call: updatedCall,
         });
      }

      return successResponse(res, { call: updatedCall }, 'Call rejected successfully');
   } catch (error) {
      console.error('Reject call error:', error);
      next(error);
   }
};

/**
 * Get call history
 */
const getCallHistory = async (req, res, next) => {
   try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const calls = await prisma.call.findMany({
         where: {
            participants: {
               some: { userId },
            },
         },
         include: {
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
            conversation: {
               include: {
                  participants: {
                     include: {
                        user: {
                           select: {
                              id: true,
                              username: true,
                              displayName: true,
                              avatar: true,
                           },
                        },
                     },
                  },
               },
            },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
         },
         orderBy: { createdAt: 'desc' },
         take: parseInt(limit),
         skip: parseInt(offset),
      });

      return successResponse(res, { calls });
   } catch (error) {
      console.error('Get call history error:', error);
      next(error);
   }
};

/**
 * Save call transcript
 */
const saveTranscript = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { transcript, speakerId, timestamp } = req.body;
      const userId = req.user.id;

      if (!transcript?.trim()) {
         throw new ValidationError('Transcript content is required');
      }

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: callId,
            participants: {
               some: { userId },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      // Create transcript entry
      const callTranscript = await prisma.callTranscript.create({
         data: {
            callId,
            speakerId: speakerId || userId,
            transcript: transcript.trim(),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
         },
         include: {
            speaker: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
               },
            },
         },
      });

      return successResponse(res, { transcript: callTranscript }, 'Transcript saved successfully', HTTP_STATUS.CREATED);
   } catch (error) {
      console.error('Save transcript error:', error);
      next(error);
   }
};

//////////////////////////////////////////////////////////////////////////////////
// LiveKit-specific endpoints

/**
 * Get LiveKit access token for a participant
 */
const getLivekitToken = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            status: { in: ['RINGING', 'ONGOING'] },
            participants: {
               some: { userId },
            },
         },
         include: {
            participants: {
               where: { userId },
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      const roomName = call.roomName || `call_${realCallId}`;
      const participant = call.participants[0];

      // Generate LiveKit token
      const token = await livekitService.generateToken(
         roomName,
         userId,
         {
            username: participant.user.username,
            displayName: participant.user.displayName,
            avatar: participant.user.avatar,
         },
         {
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
         },
      );

      return successResponse(
         res,
         {
            token,
            wsUrl: livekitService.wsUrl,
            roomName,
            callId: realCallId,
         },
         'LiveKit token generated successfully',
      );
   } catch (error) {
      console.error('Get LiveKit token error:', error);
      next(error);
   }
};

/**
 * Get LiveKit room info and participants
 */
const getLivekitRoomInfo = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            participants: {
               some: { userId },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      // Get room stats from LiveKit
      const roomStats = await livekitService.getRoomStats(realCallId);

      return successResponse(res, roomStats, 'Room info retrieved successfully');
   } catch (error) {
      console.error('Get LiveKit room info error:', error);
      next(error);
   }
};

/**
 * LiveKit health check
 */
const livekitHealthCheck = async (req, res, next) => {
   try {
      const health = await livekitService.healthCheck();
      return successResponse(res, health, 'LiveKit health check completed');
   } catch (error) {
      console.error('LiveKit health check error:', error);
      next(error);
   }
};

//////////////////////////////////////////////////////////////////////////////////
/**
 * Get ICE servers configuration for WebRTC (deprecated - keeping for backward compatibility)
 */
const getIceServers = async (req, res, next) => {
   try {
      const iceServers = webrtcService.getIceServers();

      return successResponse(res, { iceServers }, 'ICE servers retrieved successfully');
   } catch (error) {
      console.error('Get ICE servers error:', error);
      next(error);
   }
};

/**
 * Join call room for WebRTC signaling
 */
const joinCallRoom = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            status: { in: ['RINGING', 'ONGOING'] },
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
         },
      });

      if (!call) {
         // Let's also check if the call exists at all (regardless of status/participants)
         const anyCall = await prisma.call.findUnique({
            where: { id: realCallId },
         });

         throw new NotFoundError('Call not found or cannot be joined');
      }

      // Get ICE servers and call info
      const iceServers = webrtcService.getIceServers();
      const callSession = webrtcService.getCallSession(realCallId);

      return successResponse(
         res,
         {
            call: { ...call, id: callId }, // Return the original call ID to frontend
            iceServers,
            session: callSession
               ? {
                    id: callSession.id,
                    participants: Array.from(callSession.participants.values()),
                    status: callSession.status,
                 }
               : null,
         },
         'Call room joined successfully',
      );
   } catch (error) {
      console.error('Join call room error:', error);
      next(error);
   }
};

/**
 * Update call quality metrics
 */
const updateQualityMetrics = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;
      const metrics = req.body;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            participants: {
               some: { userId },
            },
         },
      });

      if (!call) {
         // Log warning but don't fail - this allows frontend to send metrics before call is fully created
         console.warn(
            `[WARNING] Quality metrics received for non-existent or inaccessible call: ${callId} (resolved: ${realCallId}), user: ${userId}`,
         );
         // Return success to prevent frontend from retrying with errors
         return successResponse(res, {}, 'Quality metrics logged (call not found)');
      }

      // Update metrics
      await webrtcService.updateQualityMetrics(realCallId, userId, metrics);

      return successResponse(res, {}, 'Quality metrics updated successfully');
   } catch (error) {
      console.error('Update quality metrics error:', error);
      next(error);
   }
};

/**
 * Update media state (mute/unmute, video on/off)
 */
const updateMediaState = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;
      const { audio, video } = req.body;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            status: 'ONGOING',
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      // Update media state
      const mediaState = await webrtcService.updateMediaState(realCallId, userId, { audio, video });

      // Emit to call room
      const io = req.app.get('socketio');
      if (io) {
         io.to(`call_${realCallId}`).emit('call:media_state_changed', {
            callId,
            userId,
            mediaState,
         });
      }

      return successResponse(res, { mediaState }, 'Media state updated successfully');
   } catch (error) {
      console.error('Update media state error:', error);
      next(error);
   }
};

/**
 * Get call statistics
 */
const getCallStats = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const userId = req.user.id;

      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            participants: {
               some: { userId },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      // Get call statistics
      const stats = webrtcService.getCallStats(realCallId);

      // Get quality metrics from database
      const qualityMetrics = await prisma.callQualityMetric.findMany({
         where: { callId: realCallId },
         orderBy: { timestamp: 'desc' },
         take: 10,
      });

      return successResponse(
         res,
         {
            stats,
            qualityMetrics,
         },
         'Call statistics retrieved successfully',
      );
   } catch (error) {
      console.error('Get call stats error:', error);
      next(error);
   }
};

/**
 * Handle user disconnect during call - end call gracefully
 */
const handleUserDisconnectFromCall = async (userId) => {
   try {
      // Find any active calls this user is participating in
      const activeCalls = await prisma.call.findMany({
         where: {
            status: {
               in: ['RINGING', 'ONGOING'],
            },
            participants: {
               some: {
                  userId,
                  status: {
                     in: ['INVITED', 'JOINED'],
                  },
               },
            },
         },
         include: {
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
            conversation: { select: { id: true } },
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
      });

      for (const call of activeCalls) {
         // Update user's participant status
         await prisma.callParticipant.updateMany({
            where: {
               callId: call.id,
               userId,
            },
            data: {
               status: 'LEFT',
               leftAt: new Date(),
            },
         });

         // Check if this was the last active participant
         const remainingActiveParticipants = await prisma.callParticipant.count({
            where: {
               callId: call.id,
               status: {
                  in: ['INVITED', 'JOINED'],
               },
            },
         });

         // If no one left, end the call and create history message
         if (remainingActiveParticipants === 0) {
            const finalStatus = call.status === 'RINGING' ? 'MISSED' : 'ENDED';
            let duration = null;

            if (call.status === 'ONGOING' && call.startedAt) {
               duration = Math.floor((new Date() - new Date(call.startedAt)) / 1000);
            }

            await prisma.call.update({
               where: { id: call.id },
               data: {
                  status: finalStatus,
                  endedAt: new Date(),
                  duration: duration,
               },
            });

            // Clear all timeouts when call ends
            webrtcService.clearCallTimeouts(call.id);

            // Create call history message
            await createCallHistoryMessage({
               id: call.id,
               conversationId: call.conversation.id,
               type: call.type,
               status: finalStatus,
               duration: duration || 0,
               startedAt: call.startedAt,
               endedAt: new Date(),
               initiator: call.initiator,
               participants: call.participants,
            });

         }

         // Emit disconnect event
         const io = global.io;
         if (io) {
            io.to(`conversation_${call.conversation.id}`).emit('call:participant_disconnected', {
               callId: call.id,
               userId,
               remainingParticipants: remainingActiveParticipants,
               timestamp: new Date(),
            });
         }
      }
   } catch (error) {
      console.error('Handle user disconnect from call error:', error);
   }
};

/**
 * Mark call as failed
 */
const markCallAsFailed = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const realCallId = resolveCallId(callId);

      // Find call and verify user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            status: {
               in: ['RINGING', 'ONGOING'],
            },
            participants: {
               some: { userId },
            },
         },
         include: {
            conversation: { select: { id: true } },
            participants: {
               include: {
                  user: {
                     select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                     },
                  },
               },
            },
            initiator: {
               select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatar: true,
               },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or cannot be marked as failed');
      }

      // Update call status to failed
      const updatedCall = await prisma.call.update({
         where: { id: realCallId },
         data: {
            status: 'FAILED',
            endedAt: new Date(),
            metadata: {
               failureReason: reason || 'Connection failed',
               failedBy: userId,
            },
         },
      });

      // Update all participants status
      await prisma.callParticipant.updateMany({
         where: {
            callId: realCallId,
            status: {
               in: ['INVITED', 'JOINED'],
            },
         },
         data: {
            status: 'FAILED',
            leftAt: new Date(),
         },
      });

      // Create call history message for failed call
      await createCallHistoryMessage({
         id: call.id,
         conversationId: call.conversation.id,
         type: call.type,
         status: 'FAILED',
         duration: 0,
         startedAt: call.startedAt,
         endedAt: new Date(),
         initiator: call.initiator,
         participants: call.participants,
      });

      // Log call failure
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${call.conversation.id}`).emit('call:failed', {
            callId,
            reason: reason || 'Connection failed',
            call: updatedCall,
         });
      }

      return successResponse(res, { call: updatedCall }, 'Call marked as failed');
   } catch (error) {
      console.error('Mark call as failed error:', error);
      next(error);
   }
};

/**
 * Debug: Get active call timeouts
 */
const getActiveTimeouts = async (req, res, next) => {
   try {
      const timeoutInfo = webrtcService.getActiveTimeoutsInfo();
      return successResponse(res, timeoutInfo, 'Active timeouts retrieved');
   } catch (error) {
      console.error('Get active timeouts error:', error);
      next(error);
   }
};

/**
 * Debug: Get call session info
 */
const getCallSession = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const realCallId = resolveCallId(callId);
      const session = webrtcService.getCallSession(realCallId);

      if (!session) {
         throw new NotFoundError('Call session not found');
      }

      return successResponse(res, { session }, 'Call session retrieved');
   } catch (error) {
      console.error('Get call session error:', error);
      next(error);
   }
};

/**
 * Enable transcription for a call
 */
const enableTranscription = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const { language = 'en-US', model = 'default' } = req.body;
      const realCallId = resolveCallId(callId);

      // Verify call exists and user is participant
      const call = await prisma.call.findFirst({
         where: {
            id: realCallId,
            participants: {
               some: { userId: req.user.id },
            },
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or access denied');
      }

      if (call.status !== 'ONGOING') {
         throw new ValidationError('Can only enable transcription for ongoing calls');
      }

      await transcriptionService.enableCallTranscription(realCallId, {
         language,
         model,
      });

      return successResponse(
         res,
         { callId: realCallId, transcriptionEnabled: true },
         'Transcription enabled successfully',
      );
   } catch (error) {
      console.error('Enable transcription error:', error);
      next(error);
   }
};

/**
 * Process audio chunk for transcription
 * Accepts audio data from client and processes it for transcription
 */
const processAudioTranscription = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const realCallId = resolveCallId(callId);
      const userId = req.user.id;

      // Verify call and participant
      const participant = await prisma.callParticipant.findFirst({
         where: {
            callId: realCallId,
            userId,
            status: 'JOINED',
         },
         include: {
            call: true,
         },
      });

      if (!participant || participant.call.status !== 'ONGOING') {
         throw new NotFoundError('Active call not found or access denied');
      }

      // Get audio buffer from request (multipart/form-data)
      if (!req.file || !req.file.buffer) {
         throw new ValidationError('Audio file is required');
      }

      const audioBuffer = req.file.buffer;
      const { language, isFinal, segmentId, startTime, endTime } = req.body;

      // Process audio and send transcription
      const transcript = await transcriptionService.processAudioChunk(realCallId, userId, audioBuffer, {
         language,
         isFinal: isFinal === 'true' || isFinal === true,
         segmentId,
         startTime: startTime ? parseFloat(startTime) : undefined,
         endTime: endTime ? parseFloat(endTime) : undefined,
      });

      return successResponse(res, { transcript }, 'Audio transcription processed');
   } catch (error) {
      console.error('Process audio transcription error:', error);
      next(error);
   }
};

/**
 * Get transcriptions for a call
 */
const getCallTranscriptions = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const realCallId = resolveCallId(callId);
      const { isFinal, speakerId, skip, take } = req.query;

      // Verify user is participant
      const participant = await prisma.callParticipant.findFirst({
         where: {
            callId: realCallId,
            userId: req.user.id,
         },
      });

      if (!participant) {
         throw new NotFoundError('Call not found or access denied');
      }

      const transcripts = await transcriptionService.getCallTranscriptions(realCallId, {
         isFinal: isFinal === 'true' ? true : isFinal === 'false' ? false : undefined,
         speakerId,
         skip: skip ? parseInt(skip) : 0,
         take: take ? parseInt(take) : 100,
      });

      return successResponse(res, { transcripts, count: transcripts.length }, 'Transcriptions retrieved');
   } catch (error) {
      console.error('Get call transcriptions error:', error);
      next(error);
   }
};

/**
 * Get call summary with transcriptions
 */
const getCallSummary = async (req, res, next) => {
   try {
      const { callId } = req.params;
      const realCallId = resolveCallId(callId);

      // Verify user is participant
      const participant = await prisma.callParticipant.findFirst({
         where: {
            callId: realCallId,
            userId: req.user.id,
         },
      });

      if (!participant) {
         throw new NotFoundError('Call not found or access denied');
      }

      const summary = await transcriptionService.generateCallSummary(realCallId);

      return successResponse(res, { summary }, 'Call summary generated');
   } catch (error) {
      console.error('Get call summary error:', error);
      next(error);
   }
};

/**
 * LiveKit webhook handler
 * Receives events from LiveKit server
 */
const handleLivekitWebhook = async (req, res, next) => {
   try {
      const authHeader = req.headers.authorization;
      const body = req.rawBody || JSON.stringify(req.body);

      // Verify and parse webhook
      const event = await livekitWebhookHandler.verifyAndParseWebhook(body, authHeader);

      // Handle event
      await livekitWebhookHandler.handleWebhookEvent(event);

      res.status(200).json({ success: true });
   } catch (error) {
      console.error('LiveKit webhook error:', error);
      res.status(400).json({ error: error.message });
   }
};

module.exports = {
   initiateCall,
   answerCall,
   endCall,
   rejectCall,
   getCallHistory,
   saveTranscript,
   // LiveKit endpoints
   getLivekitToken,
   getLivekitRoomInfo,
   livekitHealthCheck,
   // Transcription endpoints
   enableTranscription,
   processAudioTranscription,
   getCallTranscriptions,
   getCallSummary,
   handleLivekitWebhook,
   // Deprecated WebRTC endpoints (keeping for backward compatibility)
   getIceServers,
   joinCallRoom,
   updateQualityMetrics,
   updateMediaState,
   getCallStats,
   markCallAsFailed,
   handleUserDisconnectFromCall,
   getActiveTimeouts,
   getCallSession,
};
