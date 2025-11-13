const prisma = require('../config/database');
const { successResponse } = require('../utils/responseFormatter');
const { NotFoundError, ValidationError, HTTP_STATUS } = require('../constants/errors');

/**
 * Initiate call in conversation
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

      if (activeCall) {
         throw new ValidationError('There is already an active call in this conversation');
      }

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

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         // Notify all participants except initiator
         conversation.participants.forEach((participant) => {
            if (participant.userId !== initiatorId) {
               io.to(`user_${participant.userId}`).emit('call:incoming', {
                  call,
                  participants: callParticipants,
               });
            }
         });

         // Update conversation room
         io.to(`conversation_${conversationId}`).emit('call:initiated', {
            call,
            participants: callParticipants,
         });
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
         io.to(`conversation_${call.conversation.id}`).emit('call:answered', {
            callId,
            userId,
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
            participants: true,
         },
      });

      if (!call) {
         throw new NotFoundError('Call not found or already ended');
      }

      // Update call status to ended
      const updatedCall = await prisma.call.update({
         where: { id: callId },
         data: {
            status: 'ENDED',
            endedAt: new Date(),
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

      // Emit to socket for real-time updates
      const io = req.app.get('socketio');
      if (io) {
         io.to(`conversation_${call.conversation.id}`).emit('call:ended', {
            callId,
            endedBy: userId,
            call: updatedCall,
         });
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
      if (remainingParticipants <= 1) {
         // End call if no one else is available
         updatedCall = await prisma.call.update({
            where: { id: callId },
            data: {
               status: 'ENDED',
               endedAt: new Date(),
            },
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

module.exports = {
   initiateCall,
   answerCall,
   endCall,
   rejectCall,
   getCallHistory,
   saveTranscript,
};
