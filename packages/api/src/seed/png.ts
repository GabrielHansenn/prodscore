import { deflateSync } from 'node:zlib';

/**
 * Imagens PNG simples geradas sem dependências (zlib do Node) — avatares,
 * comprovações de tarefa e uma imagem para o chat de grupo do seed.
 */

type RGB = readonly [number, number, number];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** Codifica uma imagem RGB (pixel(x, y) → cor) como PNG */
export function encodePng(width: number, height: number, pixel: (x: number, y: number) => RGB): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filtro "None" na linha
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;  // 8 bits por canal
  header[9] = 2;  // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Cores de destaque usadas nos avatares (harmonizam com o roxo da marca) */
const PALETTE: RGB[] = [
  [124, 58, 237], [37, 99, 235], [5, 150, 105], [217, 119, 6],
  [219, 39, 119], [14, 116, 144], [101, 163, 13], [220, 38, 38],
];

/** Hash simples de texto → inteiro (para escolher cor e padrão a partir do username) */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Avatar "identicon" 5×5 simétrico (estilo GitHub) a partir do username:
 * sempre o mesmo desenho para o mesmo nome.
 */
export function identiconPng(seedText: string, size = 160): Buffer {
  const h = hash(seedText);
  const color = PALETTE[h % PALETTE.length]!;
  const background: RGB = [243, 240, 255];
  const cells: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < 3; col++) line.push(((h >>> (row * 3 + col)) & 1) === 1);
    cells.push([line[0]!, line[1]!, line[2]!, line[1]!, line[0]!]);
  }
  const margin = size * 0.12;
  const cell = (size - margin * 2) / 5;
  return encodePng(size, size, (x, y) => {
    const col = Math.floor((x - margin) / cell);
    const row = Math.floor((y - margin) / cell);
    const inside = col >= 0 && col < 5 && row >= 0 && row < 5;
    return inside && cells[row]![col] ? color : background;
  });
}

/** "Foto" de comprovação: cartão claro com faixas e um selo verde de concluído */
export function proofPng(seedText: string): Buffer {
  const h = hash(seedText);
  const accent = PALETTE[h % PALETTE.length]!;
  return encodePng(320, 200, (x, y) => {
    const dx = x - 260, dy = y - 60;
    if (dx * dx + dy * dy < 900) return [101, 163, 13];                     // selo
    if (y > 30 && y < 42 && x > 24 && x < 200) return accent;                // título
    if ((y - 70) % 22 < 8 && y > 70 && y < 170 && x > 24 && x < 24 + ((h >> (y % 7)) % 180) + 80) {
      return [203, 213, 225];                                                // linhas de texto
    }
    return [248, 250, 252];
  });
}

/** Imagem para o chat de grupo: gráfico de barras simples (ex: "progresso da sprint") */
export function chartPng(seedText: string): Buffer {
  const h = hash(seedText);
  const bars = Array.from({ length: 6 }, (_, i) => 40 + ((h >>> (i * 4)) % 110));
  return encodePng(360, 220, (x, y) => {
    const i = Math.floor((x - 30) / 52);
    if (i >= 0 && i < 6 && (x - 30) % 52 < 36 && y > 200 - bars[i]! && y < 200) {
      return i === 5 ? [101, 163, 13] : [124, 58, 237];
    }
    if (y === 200 && x > 20 && x < 340) return [148, 163, 184];
    return [255, 255, 255];
  });
}
