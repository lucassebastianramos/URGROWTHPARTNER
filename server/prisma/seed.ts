import { PrismaClient, DoorbellStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed para Hardware Serializado y Activación Dinámica...');

  // Limpiar datos existentes en orden de dependencia
  await prisma.callSession.deleteMany();
  await prisma.doorbellUnit.deleteMany();
  await prisma.doorbell.deleteMany();
  await prisma.user.deleteMany();

  // Usuario de prueba principal (Ariel Vieyra)
  const ariel = await prisma.user.create({
    data: {
      name: 'Ariel Vieyra',
      telegramChatId: process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID || '123456789',
    },
  });

  // ===========================================================================
  // 1. Chapa Serial UG-1001: Casa / Oficina particular (ACTIVA, 1 unidad)
  // ===========================================================================
  const chapa1001 = await prisma.doorbell.create({
    data: {
      serialNumber: 'UG-1001',
      claimCode: '1234',
      status: DoorbellStatus.ACTIVE,
      slug: 'oficina',
      name: 'Oficina Central',
      address: 'Av. Corrientes 1500, CABA',
      activatedAt: new Date(),
      units: {
        create: [
          {
            label: 'Recepción',
            residents: { connect: { id: ariel.id } },
          },
        ],
      },
    },
  });

  // ===========================================================================
  // 2. Chapa Serial UG-1002: PH Multi-Unidad (ACTIVA, 4 unidades)
  // ===========================================================================
  const chapa1002 = await prisma.doorbell.create({
    data: {
      serialNumber: 'UG-1002',
      claimCode: '5678',
      status: DoorbellStatus.ACTIVE,
      slug: 'ph-brown',
      name: 'Complejo Brown 1200',
      address: 'Almirante Brown 1200, Ramos Mejía',
      activatedAt: new Date(),
      units: {
        create: [
          { label: 'Casa Frente', residents: { connect: { id: ariel.id } } },
          { label: 'Casa Fondo', residents: { connect: { id: ariel.id } } },
          { label: '1° Piso Depto A', residents: { connect: { id: ariel.id } } },
          { label: '1° Piso Depto B', residents: { connect: { id: ariel.id } } },
        ],
      },
    },
  });

  // ===========================================================================
  // 3. Chapas Seriales en Stock (UNCLAIMED - Fabricadas pero en caja/sobre)
  // ===========================================================================
  const chapa1003 = await prisma.doorbell.create({
    data: {
      serialNumber: 'UG-1003',
      claimCode: '8492', // PIN de la tarjeta en el sobre cerrado
      status: DoorbellStatus.UNCLAIMED,
      slug: 'ug-1003',
    },
  });

  const chapa1004 = await prisma.doorbell.create({
    data: {
      serialNumber: 'UG-1004',
      claimCode: '9150',
      status: DoorbellStatus.UNCLAIMED,
      slug: 'ug-1004',
    },
  });

  // ===========================================================================
  // 4. Chapa Serial Suspendida (SUSPENDED - Falta de pago / Reporte de rotura)
  // ===========================================================================
  const chapa1005 = await prisma.doorbell.create({
    data: {
      serialNumber: 'UG-1005',
      claimCode: '7788',
      status: DoorbellStatus.SUSPENDED,
      slug: 'ug-1005',
      name: 'Residencia Suspendida',
      address: 'Calle Falsa 123',
    },
  });

  console.log('✅ Base de datos poblada con hardware serializado:');
  console.log(`   - Chapa ACTIVA (1 Unidad):    ID UG-1001 -> https://urgrowup.com/d/${chapa1001.serialNumber}`);
  console.log(`   - Chapa ACTIVA (PH 4 Unid):   ID UG-1002 -> https://urgrowup.com/d/${chapa1002.serialNumber}`);
  console.log(`   - Chapa SIN ACTIVAR (Stock):  ID UG-1003 -> https://urgrowup.com/d/${chapa1003.serialNumber} (PIN: 8492)`);
  console.log(`   - Chapa SUSPENDIDA:           ID UG-1005 -> https://urgrowup.com/d/${chapa1005.serialNumber}`);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
