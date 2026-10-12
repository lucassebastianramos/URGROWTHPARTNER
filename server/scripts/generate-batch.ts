import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOTAL_PLACAS = 50;
const DOMAIN = 'https://urgrowup.com/d';
const OUTPUT_DIR = path.resolve(__dirname, '../../qrs_para_laser');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface HardwarePlateItem {
  serialNumber: string;
  claimCode: string;
  url: string;
  svgFile: string;
}

export async function generateBatch(count: number = TOTAL_PLACAS): Promise<HardwarePlateItem[]> {
  const inventoryList: HardwarePlateItem[] = [];

  console.log(`🏭 Iniciando generación de lote láser: ${count} chapas de aluminio...`);
  console.log(`📂 Directorio de salida vectorial SVG: ${OUTPUT_DIR}`);

  for (let i = 1; i <= count; i++) {
    // Formato de serial: UG-1001, UG-1002...
    const serialNumber = `UG-${1000 + i}`;
    // PIN de activación aleatorio de 4 dígitos (tarjeta en sobre sellado)
    const claimCode = Math.floor(1000 + Math.random() * 9000).toString();
    const targetUrl = `${DOMAIN}/${serialNumber}`;
    const svgFileName = `${serialNumber}.svg`;
    const svgPath = path.join(OUTPUT_DIR, svgFileName);

    // Generar archivo SVG vectorial optimizado para grabado láser con nivel H (30% redundancia)
    await QRCode.toFile(svgPath, targetUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H', // Alta corrección para resistencia a lluvia, barro y rayones
      margin: 1,                 // Borde mínimo para maximizar tamaño de matriz
      width: 400,                // Escala vectorial nítida
    });

    inventoryList.push({
      serialNumber,
      claimCode,
      url: targetUrl,
      svgFile: svgFileName,
    });
  }

  // Guardar archivo JSON para control de stock e importación a la base de datos
  const jsonPath = path.join(OUTPUT_DIR, 'inventario_inicial.json');
  fs.writeFileSync(jsonPath, JSON.stringify(inventoryList, null, 2), 'utf8');

  console.log(`✅ Listo: ${count} archivos SVG vectoriales generados exitosamente.`);
  console.log(`📋 Archivo de inventario exportado en: ${jsonPath}`);

  return inventoryList;
}

// Ejecutar directamente si se llama como script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateBatch().catch(console.error);
}
