// scripts/generate-batch.ts
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const TOTAL_PLACAS = 50;
const DOMAIN = 'https://urgrowup.com/d';
const OUTPUT_DIR = './qrs_para_laser';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

interface InventoryRecord {
  serial: string;
  pin: string;
  url: string;
}

const inventoryList: InventoryRecord[] = [];

async function generateBatch() {
  console.log(`🚀 Iniciando generación por lotes: ${TOTAL_PLACAS} placas vectoriales SVG...`);

  for (let i = 1; i <= TOTAL_PLACAS; i++) {
    // Formato de serial: UG-1001, UG-1002...
    const serial = `UG-${1000 + i}`;
    // PIN de activación de 4 dígitos para sobre cerrado
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const targetUrl = `${DOMAIN}/${serial}`;

    const svgPath = path.join(OUTPUT_DIR, `${serial}.svg`);

    // Generar SVG vectorial con corrección de error alta (H = 30% de redundancia)
    await QRCode.toFile(svgPath, targetUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 400,
    });

    inventoryList.push({ serial, pin, url: targetUrl });
  }

  // Guardar archivo para importar en la base de datos o control de stock
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'inventario_inicial.json'),
    JSON.stringify(inventoryList, null, 2)
  );

  console.log(`Listo: ${TOTAL_PLACAS} archivos SVG vectoriales listos para el taller láser.`);
  console.log(`Directorio: ${path.resolve(OUTPUT_DIR)}`);
}

generateBatch();
