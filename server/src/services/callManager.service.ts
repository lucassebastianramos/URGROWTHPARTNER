import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../db/prisma.js';
import { ENV } from '../config/env.js';

export interface ActiveCallState {
  callId: string;
  unitId: string;
  unitLabel: string;
  doorbellSlug: string;
  doorbellName: string;
  visitorSocketId?: string;
  residentSocketId?: string;
  status: 'RINGING' | 'CONNECTED' | 'COMPLETED' | 'MISSED' | 'BUSY' | 'REJECTED';
  startedAt: Date;
  connectedAt?: Date;
  timeoutTimer?: NodeJS.Timeout;
}

class CallManager {
  private activeCalls: Map<string, ActiveCallState> = new Map();
  private io?: SocketIOServer;

  public setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Check if a unit currently has an ongoing or ringing call
   */
  public hasActiveCallForUnit(unitId: string): boolean {
    for (const call of this.activeCalls.values()) {
      if (call.unitId === unitId && (call.status === 'RINGING' || call.status === 'CONNECTED')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Register a new ringing call session
   */
  public registerCall(call: {
    callId: string;
    unitId: string;
    unitLabel: string;
    doorbellSlug: string;
    doorbellName: string;
  }): ActiveCallState {
    const state: ActiveCallState = {
      callId: call.callId,
      unitId: call.unitId,
      unitLabel: call.unitLabel,
      doorbellSlug: call.doorbellSlug,
      doorbellName: call.doorbellName,
      status: 'RINGING',
      startedAt: new Date(),
    };

    // Set 45-second timeout for unattended call
    state.timeoutTimer = setTimeout(() => {
      this.handleCallTimeout(call.callId);
    }, ENV.CALL_TIMEOUT_SECONDS * 1000);

    this.activeCalls.set(call.callId, state);
    return state;
  }

  /**
   * Get an active call state
   */
  public getCall(callId: string): ActiveCallState | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Associate socket ID with a role in the call
   */
  public registerSocket(callId: string, role: 'visitor' | 'resident', socketId: string) {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (role === 'visitor') {
      call.visitorSocketId = socketId;
    } else {
      call.residentSocketId = socketId;
    }
  }

  /**
   * Resident accepted the call
   */
  public async acceptCall(callId: string): Promise<boolean> {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'RINGING') {
      return false;
    }

    // Cancel 45-second timeout
    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = undefined;
    }

    call.status = 'CONNECTED';
    call.connectedAt = new Date();

    try {
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: 'CONNECTED',
          connectedAt: call.connectedAt,
        },
      });
      return true;
    } catch (error) {
      console.error(`❌ [CallManager] Error updating call session ${callId} to CONNECTED:`, error);
      return false;
    }
  }

  /**
   * Handle 45-second timeout when resident does not answer
   */
  public async handleCallTimeout(callId: string) {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'RINGING') {
      return;
    }

    console.log(`⏱️ [CallManager] Call ${callId} timed out after ${ENV.CALL_TIMEOUT_SECONDS}s. Emitting call_missed.`);

    call.status = 'MISSED';
    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = undefined;
    }

    // Notify room in Socket.io
    if (this.io) {
      this.io.to(`call:${callId}`).emit('call_missed', {
        callId,
        reason: 'timeout_no_answer',
        message: 'El residente no se encuentra disponible en este momento.',
      });
    }

    try {
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: 'MISSED',
          endedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`❌ [CallManager] Error updating call session ${callId} to MISSED:`, error);
    } finally {
      // Clean up after 15 seconds to allow clients to receive final event
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 15000);
    }
  }

  /**
   * End or hang up a call
   */
  public async endCall(callId: string, reason: string = 'hangup'): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.timeoutTimer) {
      clearTimeout(call.timeoutTimer);
      call.timeoutTimer = undefined;
    }

    const endedAt = new Date();
    let durationSeconds = 0;
    if (call.connectedAt) {
      durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - call.connectedAt.getTime()) / 1000));
    }

    const finalStatus = call.status === 'RINGING' ? 'REJECTED' : 'COMPLETED';
    call.status = finalStatus;

    if (this.io) {
      this.io.to(`call:${callId}`).emit('call_ended', {
        callId,
        reason,
        durationSeconds,
      });
    }

    try {
      await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: finalStatus,
          endedAt,
        },
      });
    } catch (error) {
      console.error(`❌ [CallManager] Error updating call session ${callId} to ${finalStatus}:`, error);
    } finally {
      this.activeCalls.delete(callId);
    }
  }

  /**
   * Find call associated with a socket ID (for disconnection handling)
   */
  public findCallBySocketId(socketId: string): { call: ActiveCallState; role: 'visitor' | 'resident' } | null {
    for (const call of this.activeCalls.values()) {
      if (call.visitorSocketId === socketId) {
        return { call, role: 'visitor' };
      }
      if (call.residentSocketId === socketId) {
        return { call, role: 'resident' };
      }
    }
    return null;
  }
}

export const callManager = new CallManager();
