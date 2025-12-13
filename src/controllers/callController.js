const prisma = require('../config/database');
const { successResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');
const webrtcService = require('../services/webrtcService');
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
            })
         )
      );

      // Initialize WebRTC session
      await webrtcService.initializeCall(call.id, initiatorId, callParticipants);

      console.log(`[DEBUG] Created call with ID: ${call.id}`);

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         const basePayload = {
            callId: call.id,
            caller: call.initiator,
            type: call.type.toLowerCase() === 'video' ? 'video' : 'audio',
            call: {
               ...call,
               iceServers: webrtcService.getIceServers(),
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
         HTTP_STATUS.CREATED
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
/**
 * Get ICE servers configuration for WebRTC
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

      console.log(`[DEBUG] Join call room request - Custom: ${callId}, Real: ${realCallId}, UserID: ${userId}`);

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

      console.log(`[DEBUG] Found call: ${call ? 'YES' : 'NO'}`);
      if (!call) {
         // Let's also check if the call exists at all (regardless of status/participants)
         const anyCall = await prisma.call.findUnique({
            where: { id: realCallId },
         });
         console.log(`[DEBUG] Call exists in DB: ${anyCall ? 'YES' : 'NO'}`);
         if (anyCall) {
            console.log(
               `[DEBUG] Call status: ${anyCall.status}, Call participants count: ${
                  anyCall.participants?.length || 'N/A'
               }`
            );
         }
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
         'Call room joined successfully'
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
            `[WARNING] Quality metrics received for non-existent or inaccessible call: ${callId} (resolved: ${realCallId}), user: ${userId}`
         );
         console.log(`[DEBUG] Metrics data:`, metrics);
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
         'Call statistics retrieved successfully'
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

            console.log(`[DISCONNECT] Call ${call.id} ended due to all participants leaving`);
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
      console.log(`[FAILURE] Call ${realCallId} marked as failed by user ${userId}`); // Emit failure event
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

module.exports = {
   initiateCall,
   answerCall,
   endCall,
   rejectCall,
   getCallHistory,
   saveTranscript,
   getIceServers,
   joinCallRoom,
   updateQualityMetrics,
   updateMediaState,
   getCallStats,
   markCallAsFailed,
   handleUserDisconnectFromCall,
};
