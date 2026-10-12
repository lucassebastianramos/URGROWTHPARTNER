import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { DoorbellStatus } from '@prisma/client';

export const doorbellRouter = Router();

/**
 * Normalizes input serial or slug
 */
function cleanIdentifier(idParam: string | string[] | undefined): string {
  if (!idParam) return '';
  const raw = Array.isArray(idParam) ? idParam[0] : idParam;
  return raw.trim().toUpperCase();
}

/**
 * GET /api/d/:serial and /d/:serial
 * Hardware serialized QR resolution point
 */
async function handleGetBySerial(req: Request, res: Response): Promise<void> {
  try {
    const rawSerial = req.params.serial;
    const serialUpper = cleanIdentifier(rawSerial);
    const slugLower = (typeof rawSerial === 'string' ? rawSerial : rawSerial[0] || '').trim().toLowerCase();

    // Find by serialNumber or slug
    const doorbell = await prisma.doorbell.findFirst({
      where: {
        OR: [
          { serialNumber: serialUpper },
          { slug: slugLower },
          { slug: serialUpper },
        ],
      },
      include: {
        units: {
          select: {
            id: true,
            label: true,
            floor: true,
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!doorbell) {
      res.status(404).json({
        error: 'Chapa o timbre no encontrado. Verifica el código QR o número de serie.',
      });
      return;
    }

    // 1. Chapa en caja / sin activar
    if (doorbell.status === DoorbellStatus.UNCLAIMED) {
      res.json({
        status: DoorbellStatus.UNCLAIMED,
        serialNumber: doorbell.serialNumber,
        message: 'Este timbre aún no fue activado. Si sos el propietario, ingresá tu código de activación para configurarlo.',
      });
      return;
    }

    // 2. Chapa suspendida
    if (doorbell.status === DoorbellStatus.SUSPENDED) {
      res.status(403).json({
        status: DoorbellStatus.SUSPENDED,
        serialNumber: doorbell.serialNumber,
        name: doorbell.name,
        message: 'Servicio temporalmente no disponible.',
      });
      return;
    }

    // 3. Chapa activa
    res.json({
      status: DoorbellStatus.ACTIVE,
      id: doorbell.id,
      serialNumber: doorbell.serialNumber,
      slug: doorbell.slug,
      name: doorbell.name,
      address: doorbell.address,
      units: doorbell.units,
    });
  } catch (error) {
    console.error('❌ [API] Error resolving hardware serial:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/**
 * POST /api/d/:serial/activate
 * Client activation endpoint with card PIN / claim code
 */
async function handleActivateDoorbell(req: Request, res: Response): Promise<void> {
  try {
    const rawSerial = req.params.serial;
    const serialUpper = cleanIdentifier(rawSerial);
    const { claimCode, name, address, residentName, telegramChatId, units } = req.body;

    if (!claimCode || typeof claimCode !== 'string') {
      res.status(400).json({ error: 'Debes proporcionar el PIN de activación de 4 dígitos.' });
      return;
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Debes indicar el nombre de la propiedad o timbre.' });
      return;
    }

    // Lookup doorbell
    const doorbell = await prisma.doorbell.findUnique({
      where: { serialNumber: serialUpper },
    });

    if (!doorbell) {
      res.status(404).json({ error: 'Número de serie de chapa no encontrado.' });
      return;
    }

    if (doorbell.status === DoorbellStatus.ACTIVE) {
      res.status(400).json({ error: 'Este timbre ya fue activado previamente.' });
      return;
    }

    // Security check: Match PIN code
    if (doorbell.claimCode.trim() !== claimCode.trim()) {
      res.status(401).json({
        error: 'El código PIN de activación es incorrecto. Verifica la tarjeta dentro del sobre.',
      });
      return;
    }

    // Parse units (default to single unit "Recepción" or custom units array)
    const unitList: { label: string; floor?: string }[] = [];
    if (Array.isArray(units) && units.length > 0) {
      for (const u of units) {
        if (typeof u === 'string' && u.trim()) {
          unitList.push({ label: u.trim() });
        } else if (typeof u === 'object' && u.label) {
          unitList.push({ label: String(u.label).trim(), floor: u.floor ? String(u.floor) : undefined });
        }
      }
    }

    if (unitList.length === 0) {
      unitList.push({ label: 'Recepción' });
    }

    // Transaction to activate and configure
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Create or find resident user
      const user = await tx.user.create({
        data: {
          name: residentName ? String(residentName).trim() : 'Propietario',
          telegramChatId: telegramChatId ? String(telegramChatId).trim() : null,
        },
      });

      // 2. Activate Doorbell
      const activatedDoorbell = await tx.doorbell.update({
        where: { id: doorbell.id },
        data: {
          status: DoorbellStatus.ACTIVE,
          name: name.trim(),
          address: address ? address.trim() : null,
          activatedAt: new Date(),
        },
      });

      // 3. Create units associated with resident
      for (const unitItem of unitList) {
        await tx.doorbellUnit.create({
          data: {
            doorbellId: activatedDoorbell.id,
            label: unitItem.label,
            floor: unitItem.floor,
            residents: {
              connect: { id: user.id },
            },
          },
        });
      }

      return activatedDoorbell;
    });

    console.log(`🎉 [Hardware Activation] Chapa ${serialUpper} activada exitosamente para "${name}".`);

    res.json({
      success: true,
      message: '¡Timbre activado exitosamente!',
      serialNumber: updated.serialNumber,
      name: updated.name,
    });
  } catch (error) {
    console.error('❌ [API] Error activating doorbell hardware:', error);
    res.status(500).json({ error: 'Error interno al activar el timbre.' });
  }
}

/**
 * GET /api/v/:slug
 * Backward-compatible endpoint to resolve property & units by slug
 */
async function handleGetBySlug(req: Request, res: Response): Promise<void> {
  try {
    const rawSlug = req.params.slug;
    const slug = (typeof rawSlug === 'string' ? rawSlug : Array.isArray(rawSlug) ? rawSlug[0] : '').trim().toLowerCase();
    const serialUpper = cleanIdentifier(rawSlug);

    const doorbell = await prisma.doorbell.findFirst({
      where: {
        OR: [
          { slug },
          { serialNumber: serialUpper },
        ],
        status: DoorbellStatus.ACTIVE,
      },
      select: {
        id: true,
        slug: true,
        serialNumber: true,
        name: true,
        address: true,
        units: {
          select: {
            id: true,
            label: true,
            floor: true,
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!doorbell) {
      res.status(404).json({
        error: 'Timbre no encontrado o inactivo',
      });
      return;
    }

    res.json(doorbell);
  } catch (error) {
    console.error('❌ [API] Error resolving doorbell slug:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// Routes
doorbellRouter.get('/d/:serial', handleGetBySerial);
doorbellRouter.post('/d/:serial/activate', handleActivateDoorbell);

doorbellRouter.get('/v/:slug', handleGetBySlug);
doorbellRouter.get('/:slug', handleGetBySlug);
