/**
 * Genera src/app/favicon.ico (Quiniela Mundial 2026).
 *
 * Diseño (espejo del Logo.tsx):
 *   - Disco verde con gradiente radial
 *   - Pentágono blanco al centro
 *   - 5 patas hexagonales (líneas)
 *   - Arco tricolor inferior (verde · azul · rojo)
 *   - Estrella dorada arriba a la derecha
 *
 * Render con supersampling x4 → BMP DIB 32-bit → multi-resolución ICO (16/32/48 px).
 * No requiere ImageMagick ni libs nativas — solo Node.
 *
 * Uso:  node scripts/generate-favicon.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SIZES = [16, 32, 48];
const SS = 4; // supersample factor para antialiasing

// Paleta oficial
const GREEN_LIGHT = [0x3c, 0xac, 0x3b];
const GREEN_DARK = [0x1f, 0x5a, 0x1e];
const WHITE = [0xff, 0xff, 0xff];
const BLUE = [0x2a, 0x39, 0x8d];
const RED = [0xe6, 0x1d, 0x25];
const GOLD = [0xd4, 0xa0, 0x17];

// ────────────────────────────────────────────────────────────────────────────
// Utilidades de pixeles (RGBA, fila × columna, top-down)
// ────────────────────────────────────────────────────────────────────────────

function makeCanvas(w, h) {
  return { w, h, buf: new Uint8ClampedArray(w * h * 4) };
}

function setPx(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  // composición sobre lo que ya hay (alpha-over)
  const dstA = c.buf[i + 3] / 255;
  const srcA = a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  c.buf[i + 0] = Math.round((r * srcA + c.buf[i + 0] * dstA * (1 - srcA)) / outA);
  c.buf[i + 1] = Math.round((g * srcA + c.buf[i + 1] * dstA * (1 - srcA)) / outA);
  c.buf[i + 2] = Math.round((b * srcA + c.buf[i + 2] * dstA * (1 - srcA)) / outA);
  c.buf[i + 3] = Math.round(outA * 255);
}

function fillDisc(c, cx, cy, r, colorFn) {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(c.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(c.h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const [cr, cg, cb] = colorFn(x, y);
        setPx(c, x, y, cr, cg, cb, 255);
      }
    }
  }
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(c, poly, [r, g, b]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(c.w - 1, Math.ceil(maxX));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(c.h - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) setPx(c, x, y, r, g, b, 255);
    }
  }
}

function strokeLine(c, x1, y1, x2, y2, width, [r, g, b]) {
  // segmento como cápsula — distancia al segmento <= width/2
  const w2 = (width / 2) * (width / 2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  for (let y = Math.max(0, minY); y <= Math.min(c.h - 1, maxY); y++) {
    for (let x = Math.max(0, minX); x <= Math.min(c.w - 1, maxX); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2),
      );
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const d2 = (px - projX) ** 2 + (py - projY) ** 2;
      if (d2 <= w2) setPx(c, x, y, r, g, b, 255);
    }
  }
}

function strokeArc(c, cx, cy, radius, startAngle, endAngle, width, [r, g, b]) {
  // arco como anillo: |r - radius| <= width/2  Y ángulo dentro del rango
  const rOuter = radius + width / 2;
  const rInner = radius - width / 2;
  const r2Outer = rOuter * rOuter;
  const r2Inner = rInner * rInner;
  const x0 = Math.max(0, Math.floor(cx - rOuter));
  const x1 = Math.min(c.w - 1, Math.ceil(cx + rOuter));
  const y0 = Math.max(0, Math.floor(cy - rOuter));
  const y1 = Math.min(c.h - 1, Math.ceil(cy + rOuter));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2Inner || d2 > r2Outer) continue;
      let a = Math.atan2(dy, dx);
      // normalizar a [startAngle, startAngle + 2π)
      while (a < startAngle) a += 2 * Math.PI;
      if (a <= endAngle) setPx(c, x, y, r, g, b, 255);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Render del logo
// ────────────────────────────────────────────────────────────────────────────

function renderLogo(targetSize) {
  const N = targetSize * SS;
  const c = makeCanvas(N, N);

  // Disco verde con gradiente radial (luz desde 35%, 30%)
  const cx = N / 2;
  const cy = N / 2;
  const discR = N * 0.46;
  const lightX = N * 0.35;
  const lightY = N * 0.30;
  const lightMax = N * 0.55;

  fillDisc(c, cx, cy, discR, (x, y) => {
    const d = Math.hypot(x - lightX, y - lightY);
    const t = Math.min(1, d / lightMax);
    return [
      Math.round(GREEN_LIGHT[0] * (1 - t) + GREEN_DARK[0] * t),
      Math.round(GREEN_LIGHT[1] * (1 - t) + GREEN_DARK[1] * t),
      Math.round(GREEN_LIGHT[2] * (1 - t) + GREEN_DARK[2] * t),
    ];
  });

  // Pentágono blanco (apuntando arriba)
  const penR = N * 0.22;
  const penCx = cx;
  const penCy = cy - N * 0.02;
  const pentagon = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pentagon.push([penCx + Math.cos(angle) * penR, penCy + Math.sin(angle) * penR]);
  }
  fillPolygon(c, pentagon, WHITE);

  // 5 patas hexagonales: trazos CORTOS desde cada vértice hacia afuera
  // (no llegan al borde del disco — solo ~35% del radio del pentágono).
  // Solo si el tamaño lo justifica (≥ 32 px), si no se ve sucio.
  if (targetSize >= 32) {
    const lineW = Math.max(SS * 1.0, N * 0.022);
    const legLen = penR * 0.55;
    for (const [vx, vy] of pentagon) {
      const dx = vx - cx;
      const dy = vy - cy;
      const L = Math.hypot(dx, dy);
      const outX = vx + (dx / L) * legLen;
      const outY = vy + (dy / L) * legLen;
      strokeLine(c, vx, vy, outX, outY, lineW, WHITE);
    }
  }

  // Arco tricolor inferior (verde · azul · rojo)
  const arcW = Math.max(SS * 1.5, N * 0.045);
  const arcR = discR * 0.92;
  // 3 segmentos: 150°→210° verde, 210°→270° (debajo) azul, ... espejo
  // Usamos coordenadas: 0 derecha, π/2 abajo. Recorremos de 0.65π a 0.92π (verde)
  const start = Math.PI * 0.60;
  const end = Math.PI * 0.95; // hasta cerca del fondo derecho del disco
  const total = end - start;
  strokeArc(c, cx, cy, arcR, start, start + total / 3, arcW, GREEN_LIGHT);
  strokeArc(c, cx, cy, arcR, start + total / 3, start + (2 * total) / 3, arcW, BLUE);
  strokeArc(c, cx, cy, arcR, start + (2 * total) / 3, end, arcW, RED);

  // Estrella dorada arriba a la derecha (5 puntas) — solo a 32+
  if (targetSize >= 32) {
    const sCx = cx + N * 0.26;
    const sCy = cy - N * 0.26;
    const outerR = N * 0.075;
    const innerR = outerR * 0.42;
    const star = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      star.push([sCx + Math.cos(a) * r, sCy + Math.sin(a) * r]);
    }
    fillPolygon(c, star, GOLD);
  }

  return downsample(c, targetSize, targetSize);
}

function downsample(c, dstW, dstH) {
  const out = makeCanvas(dstW, dstH);
  const sx = c.w / dstW;
  const sy = c.h / dstH;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * sx);
      const y0 = Math.floor(y * sy);
      const x1 = Math.floor((x + 1) * sx);
      const y1 = Math.floor((y + 1) * sy);
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * c.w + xx) * 4;
          r += c.buf[i];
          g += c.buf[i + 1];
          b += c.buf[i + 2];
          a += c.buf[i + 3];
          n++;
        }
      }
      const i = (y * dstW + x) * 4;
      out.buf[i] = Math.round(r / n);
      out.buf[i + 1] = Math.round(g / n);
      out.buf[i + 2] = Math.round(b / n);
      out.buf[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Empaquetado ICO (BMP DIB 32-bit por imagen)
// ────────────────────────────────────────────────────────────────────────────

/** Convierte un canvas RGBA top-down a BMP DIB (sin file header) bottom-up. */
function canvasToBmpDib(c) {
  const { w, h, buf } = c;
  const headerSize = 40;
  const xorRowBytes = w * 4; // 32-bit, sin padding
  const xorSize = xorRowBytes * h;

  const andRowBytes = Math.ceil(w / 32) * 4; // 1 bpp, padding a 32-bit
  const andSize = andRowBytes * h;

  const total = headerSize + xorSize + andSize;
  const out = Buffer.alloc(total);

  // BITMAPINFOHEADER
  out.writeUInt32LE(headerSize, 0);
  out.writeInt32LE(w, 4);
  out.writeInt32LE(h * 2, 8); // ICO: height incluye AND mask
  out.writeUInt16LE(1, 12); // planes
  out.writeUInt16LE(32, 14); // bpp
  out.writeUInt32LE(0, 16); // compression BI_RGB
  out.writeUInt32LE(xorSize + andSize, 20);
  out.writeInt32LE(0, 24);
  out.writeInt32LE(0, 28);
  out.writeUInt32LE(0, 32);
  out.writeUInt32LE(0, 36);

  // XOR mask: BGRA, bottom-up
  let p = headerSize;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[p++] = buf[i + 2]; // B
      out[p++] = buf[i + 1]; // G
      out[p++] = buf[i + 0]; // R
      out[p++] = buf[i + 3]; // A
    }
  }

  // AND mask: 1 bit por pixel, bottom-up; 0 = visible, 1 = transparente.
  // Para 32-bit ICO la mayoría de loaders ignoran AND, pero hay que escribirla.
  for (let y = h - 1; y >= 0; y--) {
    const row = Buffer.alloc(andRowBytes, 0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const transparent = buf[i + 3] < 128;
      if (transparent) {
        const byte = x >> 3;
        const bit = 7 - (x & 7);
        row[byte] |= 1 << bit;
      }
    }
    row.copy(out, p);
    p += andRowBytes;
  }

  return out;
}

function packIco(canvases) {
  const N = canvases.length;
  const dibs = canvases.map(canvasToBmpDib);

  const headerSize = 6;
  const entrySize = 16;
  const dirSize = N * entrySize;

  const buffers = [];
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type=1 (ICO)
  header.writeUInt16LE(N, 4); // count
  buffers.push(header);

  let offset = headerSize + dirSize;
  const dir = Buffer.alloc(dirSize);
  for (let i = 0; i < N; i++) {
    const c = canvases[i];
    const dib = dibs[i];
    const o = i * entrySize;
    dir[o + 0] = c.w === 256 ? 0 : c.w;
    dir[o + 1] = c.h === 256 ? 0 : c.h;
    dir[o + 2] = 0; // color count
    dir[o + 3] = 0; // reserved
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(dib.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += dib.length;
  }
  buffers.push(dir);
  buffers.push(...dibs);

  return Buffer.concat(buffers);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

const canvases = SIZES.map((s) => {
  process.stdout.write(`  · render ${s}×${s} (supersample ×${SS})... `);
  const c = renderLogo(s);
  process.stdout.write("ok\n");
  return c;
});

const ico = packIco(canvases);

const outPath = path.join(ROOT, "src", "app", "favicon.ico");
fs.writeFileSync(outPath, ico);
console.log(`✔ Escrito ${path.relative(ROOT, outPath)} — ${ico.length} bytes, ${SIZES.length} resoluciones (${SIZES.join("/")} px)`);
