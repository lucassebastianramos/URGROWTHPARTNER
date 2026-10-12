import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './signaling.types.js';
import { callManager } from '../services/callManager.service.js';
import { verifyResidentToken } from '../services/token.service.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupSignalingHandlers(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  callManager.setSocketServer(io);

  io.on('connection', (socket: TypedSocket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    // Join room event
    socket.on('join_room', async ({ callId, role, token }) => {
      console.log(`📡 [Socket.io] join_room request: callId=${callId}, role=${role}`);

      // Resident token validation
      if (role === 'resident') {
        if (!token) {
          socket.emit('error_message', {
            code: 'AUTH_REQUIRED',
            message: 'Se requiere un token de acceso para atender la llamada.',
          });
          return;
        }

        const verified = verifyResidentToken(token);
        if (!verified || verified.callId !== callId) {
          socket.emit('error_message', {
            code: 'INVALID_TOKEN',
            message: 'El token de autorización es inválido o ha expirado.',
          });
          return;
        }
      }

      const activeCall = callManager.getCall(callId);
      if (!activeCall) {
        socket.emit('error_message', {
          code: 'CALL_NOT_FOUND',
          message: 'La sesión de llamada ya no se encuentra activa.',
        });
        return;
      }

      // Associate socket data
      socket.data.callId = callId;
      socket.data.role = role;

      const roomName = `call:${callId}`;
      await socket.join(roomName);
      callManager.registerSocket(callId, role, socket.id);

      // Check if peer is already in room
      const room = io.sockets.adapter.rooms.get(roomName);
      const peerPresent = room ? room.size > 1 : false;

      socket.emit('joined_room', {
        role,
        callId,
        peerPresent,
        status: activeCall.status,
      });

      // Notify other peer in the room
      socket.to(roomName).emit('peer_joined', { role });
      console.log(`✅ [Socket.io] ${role} joined ${roomName} (peers in room: ${room?.size || 1})`);
    });

    // Resident clicks "Answer"
    socket.on('call_accept', async ({ callId }) => {
      console.log(`📞 [Socket.io] call_accept received for call ${callId}`);
      const activeCall = callManager.getCall(callId);
      if (!activeCall) return;

      const accepted = await callManager.acceptCall(callId);
      if (accepted) {
        const roomName = `call:${callId}`;
        io.to(roomName).emit('call_accepted', { callId });
        console.log(`🎉 [Socket.io] Call ${callId} accepted. Broadcasted to room.`);
      }
    });

    // WebRTC Offer
    socket.on('webrtc_offer', ({ callId, sdp }) => {
      const roomName = `call:${callId}`;
      socket.to(roomName).emit('webrtc_offer', { sdp });
    });

    // WebRTC Answer
    socket.on('webrtc_answer', ({ callId, sdp }) => {
      const roomName = `call:${callId}`;
      socket.to(roomName).emit('webrtc_answer', { sdp });
    });

    // ICE Candidate exchange
    socket.on('ice_candidate', ({ callId, candidate }) => {
      const roomName = `call:${callId}`;
      socket.to(roomName).emit('ice_candidate', { candidate });
    });

    // Microphone Mute toggle indication
    socket.on('mute_toggle', ({ callId, isMuted }) => {
      const roomName = `call:${callId}`;
      socket.to(roomName).emit('peer_mute_toggle', { isMuted });
    });

    // Explicit end call
    socket.on('end_call', async ({ callId, reason }) => {
      console.log(`🛑 [Socket.io] end_call received for ${callId}: reason=${reason || 'hangup'}`);
      await callManager.endCall(callId, reason || 'hangup');
    });

    // Sudden disconnection (close tab, network drop)
    socket.on('disconnect', async () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
      const info = callManager.findCallBySocketId(socket.id);
      if (info) {
        console.log(`⚠️ [Socket.io] Active call party ${info.role} disconnected for call ${info.call.callId}`);
        await callManager.endCall(info.call.callId, `${info.role}_disconnected`);
      }
    });
  });
}
