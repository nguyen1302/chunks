// Generates the PWA icons as flat PNGs (no image deps — pure zlib).
// Design: dark app-ink background with an accent "c" ring (chunks wordmark).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const INK = [23, 22, 20]; // #171614
const ACCENT = [169, 86, 60]; // #A9563C

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(size, { safe }) {
  const cx = size / 2;
  const cy = size / 2;
  // ring geometry (shrink into the safe zone for maskable icons)
  const scale = safe ? 0.62 : 0.72;
  const outer = (size * scale) / 2;
  const inner = outer * 0.6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // angle of the opening on the right side (letter "c")
      const ang = Math.atan2(dy, dx); // -PI..PI, 0 = +x
      const inGap = Math.abs(ang) < 0.62; // ~35deg opening to the right
      const isRing = dist >= inner && dist <= outer && !inGap;
      const col = isRing ? ACCENT : INK;
      raw[p++] = col[0];
      raw[p++] = col[1];
      raw[p++] = col[2];
      raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return out;
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icon-192.png", png(192, { safe: false }));
writeFileSync("public/icon-512.png", png(512, { safe: false }));
writeFileSync("public/icon-maskable-512.png", png(512, { safe: true }));
writeFileSync("public/apple-touch-icon.png", png(180, { safe: false }));
console.log("icons written to public/");
