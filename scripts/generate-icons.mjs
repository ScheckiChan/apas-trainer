// Generates simple placeholder PNG icons (no dependencies — raw PNG encoding via zlib).
// Replace apps/web/public/icons/* with real artwork later.
//
//   node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const RED = [183, 28, 28];
const DARK = [29, 31, 36];
const WHITE = [255, 255, 255];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/**
 * Motif: red tile with a white "A" lettermark and a dark underline bar.
 * Coordinates are in a 0..1 unit square; `scale` shrinks the motif towards the
 * centre (maskable icons need an 80 % safe zone).
 */
function icon(size, { scale = 1, rounded = true } = {}) {
  const corner = rounded ? size * 0.18 : 0;
  const u = (v) => (0.5 + (v - 0.5) * scale) * size;
  const p = (x, y) => [u(x), u(y)];
  const strokes = [
    [p(0.3, 0.72), p(0.5, 0.24)],
    [p(0.5, 0.24), p(0.7, 0.72)],
    [p(0.38, 0.55), p(0.62, 0.55)],
  ];
  const stroke = size * 0.055 * scale;
  const bar = { x0: u(0.3), x1: u(0.7), y0: u(0.78), y1: u(0.82) };
  return encodePng(size, (x, y) => {
    // Rounded tile corners → dark background outside.
    if (corner) {
      const dx = Math.max(corner - x, x - (size - 1 - corner), 0);
      const dy = Math.max(corner - y, y - (size - 1 - corner), 0);
      if (dx * dx + dy * dy > corner * corner) return DARK;
    }
    if (strokes.some(([a, b]) => distToSegment(x, y, a, b) <= stroke)) return WHITE;
    if (x >= bar.x0 && x <= bar.x1 && y >= bar.y0 && y <= bar.y1) return DARK;
    return RED;
  });
}

const files = {
  'icon-192.png': icon(192),
  'icon-512.png': icon(512),
  'icon-maskable-512.png': icon(512, { scale: 0.75, rounded: false }),
  'apple-touch-icon.png': icon(180, { rounded: false }),
};
for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(outDir, name), buf);
  console.log(`wrote ${join('apps/web/public/icons', name)} (${buf.length} bytes)`);
}
