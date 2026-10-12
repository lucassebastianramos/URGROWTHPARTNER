import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { callRateLimiter } from '../services/rateLimiter.service.js';
import { callManager } from '../services/callManager.service.js';
import { generateResidentToken, verifyResidentToken } from '../services/token.service.js';
import { sendTelegramCallAlert } from '../services/telegram.service.js';
import { ENV } from '../config/env.js';

export const callRouter = Router();

function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers['cf-connecting-ip'] as string;
  if (cfConnectingIp) return cfConnectingIp;

  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * POST /api/calls/initiate
 * Initiates a call to a specific unit (DoorbellUnit) in a building or complex
 */
callRouter.post('/initiate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { unitId } = req.body;
    if (!unitId || typeof unitId !== 'string') {
      res.status(400).json({ error: 'Se requiere el identificador de la unidad (unitId).' });
      return;
    }

    const visitorIp = getClientIp(req);

    // 1. Anti-Spam Rate Limit check (max 2 attempts per minute per IP for same unit)
    const rateCheck = callRateLimiter.check(visitorIp, unitId);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Demasiados intentos de llamada. Por favor espera ${rateCheck.resetInSeconds} segundos antes de volver a llamar.`,
        retryAfter: rateCheck.resetInSeconds,
      });
      return;
    }

    // 2. Fetch unit, property, and residents
    const unit = await prisma.doorbellUnit.findUnique({
      where: { id: unitId },
      include: {
        doorbell: true,
        residents: {
          select: {
            id: true,
            name: true,
            telegramChatId: true,
          },
        },
      },
    });

    if (!unit || unit.doorbell.status !== 'ACTIVE') {
      res.status(404).json({
        error: 'Unidad o timbre no encontrado o inactivo.',
      });
      return;
    }

    // 3. Busy line check
    if (callManager.hasActiveCallForUnit(unit.id)) {
      res.status(409).json({
        error: `La unidad "${unit.label}" se encuentra actualmente sonando o en llamada activa. Por favor espera.`,
        isBusy: true,
      });
      return;
    }

    // 4. Create CallSession in PostgreSQL
    const startedAt = new Date();
    const callSession = await prisma.callSession.create({
      data: {
        unitId: unit.id,
        status: 'RINGING',
        visitorIp,
        startedAt,
      },
    });

    const doorbellName = unit.doorbell.name || 'Timbre UrGrowUp';
    const doorbellSlug = unit.doorbell.slug || unit.doorbell.serialNumber;

    // 5. Register in CallManager with 45s timeout
    callManager.registerCall({
      callId: callSession.id,
      unitId: unit.id,
      unitLabel: unit.label,
      doorbellSlug,
      doorbellName,
    });

    // 6. Generate signed ephemeral resident token
    const residentToken = generateResidentToken(callSession.id, unit.id);
    const residentCallUrl = `${ENV.APP_URL}/call/${callSession.id}?token=${residentToken}`;

    // 7. Dispatch instant Telegram notification with videovisor link to unit residents
    sendTelegramCallAlert({
      chatIds: unit.residents.map((r) => r.telegramChatId),
      doorbellName,
      doorbellSlug,
      unitLabel: unit.label,
      callId: callSession.id,
      residentCallUrl,
      visitorIp,
      startedAt,
    }).catch((err) => {
      console.error('❌ [Telegram Dispatch Error]:', err);
    });

    // 8. Respond to visitor
    res.status(201).json({
      success: true,
      callId: callSession.id,
      doorbellName,
      unitLabel: unit.label,
      status: 'RINGING',
      timeoutSeconds: ENV.CALL_TIMEOUT_SECONDS,
      stunServer: ENV.STUN_SERVER_URL,
    });
  } catch (error) {
    console.error('❌ [API] Error initiating call:', error);
    res.status(500).json({ error: 'Error al iniciar la llamada del timbre.' });
  }
});

/**
 * GET /api/calls/:callId/validate?token=...
 * Validates the ephemeral token for the resident intercom screen
 */
callRouter.get('/:callId/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawCallId = req.params.callId;
    const callId = (typeof rawCallId === 'string' ? rawCallId : Array.isArray(rawCallId) ? rawCallId[0] : '').trim();
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token de acceso no proporcionado. Este enlace requiere autorización.',
      });
      return;
    }

    // 1. Cryptographic JWT verification
    const verified = verifyResidentToken(token);
    if (!verified || verified.callId !== callId) {
      res.status(401).json({
        success: false,
        error: 'El token de acceso es inválido o ha expirado. Por seguridad los enlaces caducan a los pocos minutos.',
      });
      return;
    }

    // 2. Fetch call session from database
    const session = await prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        unit: {
          include: {
            doorbell: {
              select: {
                name: true,
                slug: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Sesión de llamada no encontrada.',
      });
      return;
    }

    const isTerminal = ['COMPLETED', 'MISSED', 'REJECTED'].includes(session.status);

    res.json({
      success: true,
      callId: session.id,
      status: session.status,
      doorbellName: session.unit.doorbell.name || 'Timbre UrGrowUp',
      unitLabel: session.unit.label,
      doorbellSlug: session.unit.doorbell.slug || session.unit.doorbell.serialNumber,
      startedAt: session.startedAt,
      isTerminal,
      stunServer: ENV.STUN_SERVER_URL,
    });
  } catch (error) {
    console.error('❌ [API] Error validating resident call token:', error);
    res.status(500).json({ success: false, error: 'Error interno al validar la sesión de llamada.' });
  }
});
