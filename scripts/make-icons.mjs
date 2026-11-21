import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function png(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4 + y + 1;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = a;
  };
  for (let y = 0; y < size; y++) raw[y * (size * 4 + 1)] = 0;
  draw(pixel, size);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function icon(size, pad = 0) {
  return png(size, (pixel, s) => {
    const bg = [243, 236, 223];
    const yarn = [196, 98, 74];
    const ink = [43, 36, 32];
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) pixel(x, y, ...bg);
    }
    const cx = s * 0.4;
    const cy = s * 0.55;
    const rad = s * 0.2;
    const thick = Math.max(2, s * 0.045);
    for (let y = pad; y < s - pad; y++) {
      for (let x = pad; x < s - pad; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (Math.abs(d - rad) < thick) pixel(x, y, ...yarn);
        const t = (x - s * 0.42) / (s * 0.4);
        if (t > 0 && t < 1) {
          const hookY = s * 0.34 + Math.sin(t * Math.PI) * s * -0.12 + (t > 0.72 ? (t - 0.72) * s * 0.35 : 0);
          if (Math.abs(y - hookY) < thick * 0.7 && x > s * 0.4) pixel(x, y, ...ink);
        }
      }
    }
  });
}

writeFileSync('public/pwa-192.png', icon(192, 8));
writeFileSync('public/pwa-512.png', icon(512, 20));
writeFileSync('public/pwa-512-maskable.png', icon(512, 64));
writeFileSync('public/apple-touch-icon.png', icon(180, 10));
console.log('icons written');
