import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export interface ResidentTokenPayload {
  callId: string;
  unitId: string;
  role: 'resident';
}

/**
 * Generates a signed ephemeral token for the resident call URL
 */
export function generateResidentToken(callId: string, unitId: string): string {
  return jwt.sign(
    {
      callId,
      unitId,
      role: 'resident',
    } satisfies ResidentTokenPayload,
    ENV.JWT_SECRET,
    {
      expiresIn: ENV.TOKEN_EXPIRES_IN_SECONDS,
      issuer: 'urgrowup-doorbell-backend',
    }
  );
}

/**
 * Validates a resident token and returns payload if valid
 */
export function verifyResidentToken(token: string): ResidentTokenPayload | null {
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET, {
      issuer: 'urgrowup-doorbell-backend',
    }) as jwt.JwtPayload & ResidentTokenPayload;

    if (decoded && decoded.callId && decoded.role === 'resident') {
      return {
        callId: decoded.callId,
        unitId: decoded.unitId,
        role: decoded.role,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}
