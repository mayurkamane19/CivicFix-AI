import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.resolve(__dirname, '..', 'frontend', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ (-1)) >>> 0;
}

function createPNG(size, bgR, bgG, bgB, fgR, fgG, fgB) {
  const width = size;
  const height = size;
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);

  const radius = size * 0.44;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Civic building shape in center
        const inCenter = (Math.abs(dx) < size * 0.22 && dy > -size * 0.05 && dy < size * 0.25) ||
                         (Math.abs(dx) < (size * 0.25 - (dy + size * 0.05)) && dy <= -size * 0.05 && dy > -size * 0.32);
        if (inCenter) {
          rawData[pxOffset] = fgR;
          rawData[pxOffset + 1] = fgG;
          rawData[pxOffset + 2] = fgB;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = bgR;
          rawData[pxOffset + 1] = bgG;
          rawData[pxOffset + 2] = bgB;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG header
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  ihdr[18] = 0;
  ihdr[19] = 0;
  ihdr[20] = 0;
  const ihdrCRC = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(ihdrCRC, 21);

  // IDAT
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCRC = crc32(idat.subarray(4, 8 + compressed.length));
  idat.writeUInt32BE(idatCRC, 8 + compressed.length);

  // IEND
  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write('IEND', 4);
  const iendCRC = crc32(Buffer.from('IEND'));
  iend.writeUInt32BE(iendCRC, 8);

  return Buffer.concat([header, ihdr, idat, iend]);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of sizes) {
  const png = createPNG(s, 37, 99, 235, 255, 255, 255);
  fs.writeFileSync(path.join(iconsDir, `icon-${s}.png`), png);
}

// Maskable icon (full bleed background)
function createMaskablePNG(size) {
  const width = size;
  const height = size;
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const inCenter = (Math.abs(dx) < size * 0.18 && dy > -size * 0.05 && dy < size * 0.22) ||
                       (Math.abs(dx) < (size * 0.22 - (dy + size * 0.05)) && dy <= -size * 0.05 && dy > -size * 0.28);
      if (inCenter) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = 30;
        rawData[pxOffset + 1] = 64;
        rawData[pxOffset + 2] = 175;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  ihdr[18] = 0;
  ihdr[19] = 0;
  ihdr[20] = 0;
  const ihdrCRC = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(ihdrCRC, 21);

  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCRC = crc32(idat.subarray(4, 8 + compressed.length));
  idat.writeUInt32BE(idatCRC, 8 + compressed.length);

  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write('IEND', 4);
  const iendCRC = crc32(Buffer.from('IEND'));
  iend.writeUInt32BE(iendCRC, 8);

  return Buffer.concat([header, ihdr, idat, iend]);
}

const maskable = createMaskablePNG(512);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable.png'), maskable);

// Also create vector SVGs
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="cfxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="60%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#cfxGrad)"/>
  <path d="M120 220 L256 100 L392 220 V400 A24 24 0 0 1 368 424 H144 A24 24 0 0 1 120 400 Z" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="208 424 208 280 304 280 304 424" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="190" r="22" fill="#60a5fa"/>
  <path d="M256 140 V160" stroke="#60a5fa" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="cfxGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#cfxGrad2)"/>
  <g transform="translate(64, 64) scale(0.75)">
    <path d="M120 220 L256 100 L392 220 V400 A24 24 0 0 1 368 424 H144 A24 24 0 0 1 120 400 Z" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="208 424 208 280 304 280 304 424" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="256" cy="190" r="22" fill="#93c5fd"/>
    <path d="M256 140 V160" stroke="#93c5fd" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), svgMaskable);

console.log('✓ Successfully created all PWA icons (PNG and SVG)!');
