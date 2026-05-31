/**
 * Generador XLSX minimalista — solo Node nativo (`node:zlib`).
 *
 * Produce un workbook de una sola hoja, sin estilos, suficiente para
 * comprobantes y auditoría. El archivo es un ZIP que contiene:
 *
 *   - [Content_Types].xml
 *   - _rels/.rels
 *   - xl/workbook.xml
 *   - xl/_rels/workbook.xml.rels
 *   - xl/worksheets/sheet1.xml
 *
 * No agrega dependencias al proyecto.
 */

import zlib from "node:zlib";

export type CellValue = string | number | null | undefined;
export type Row = CellValue[];

export type XlsxOptions = {
  sheetName?: string;
  headers: string[];
  rows: Row[];
  /**
   * Líneas de metadata que aparecen ANTES de la tabla (titulo, hash,
   * usuario, fecha). Cada string ocupa una fila completa (columna A).
   */
  metadata?: string[];
};

// ────────────────────────────────────────────────────────────────────────────
// CRC32 — tabla precalculada (polinomio IEEE 0xEDB88320)
// ────────────────────────────────────────────────────────────────────────────

const CRC32_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers de XML
// ────────────────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
function colName(col: number): string {
  let s = "";
  let n = col;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) return s;
  }
}

function buildSheetXml(rows: Row[]): string {
  const out: string[] = [];
  out.push(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>`,
  );

  rows.forEach((row, idx) => {
    const r = idx + 1;
    out.push(`<row r="${r}">`);
    row.forEach((value, c) => {
      if (value === null || value === undefined || value === "") return;
      const ref = `${colName(c)}${r}`;
      if (typeof value === "number" && Number.isFinite(value)) {
        out.push(`<c r="${ref}"><v>${value}</v></c>`);
      } else {
        out.push(
          `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`,
        );
      }
    });
    out.push(`</row>`);
  });

  out.push(`</sheetData></worksheet>`);
  return out.join("");
}

// ────────────────────────────────────────────────────────────────────────────
// ZIP (sin dependencias)
// ────────────────────────────────────────────────────────────────────────────

type ZipEntry = { name: string; data: Buffer };

function makeZip(entries: ZipEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const filename = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const compressed = zlib.deflateRawSync(e.data);
    const uncompSize = e.data.length;
    const compSize = compressed.length;

    // Local file header (30 bytes fijos + filename + datos)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // general purpose flags
    lh.writeUInt16LE(8, 8); // compression: DEFLATE
    lh.writeUInt16LE(0, 10); // mod time
    lh.writeUInt16LE(0, 12); // mod date
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compSize, 18);
    lh.writeUInt32LE(uncompSize, 22);
    lh.writeUInt16LE(filename.length, 26);
    lh.writeUInt16LE(0, 28); // extra len
    local.push(lh, filename, compressed);

    // Central directory entry (46 bytes fijos + filename)
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compSize, 20);
    cd.writeUInt32LE(uncompSize, 24);
    cd.writeUInt16LE(filename.length, 28);
    cd.writeUInt16LE(0, 30); // extra len
    cd.writeUInt16LE(0, 32); // comment len
    cd.writeUInt16LE(0, 34); // disk start
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42); // local header offset
    central.push(cd, filename);

    offset += 30 + filename.length + compSize;
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const centralOffset = offset;

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...local, ...central, eocd]);
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────

export function generateXlsx(opts: XlsxOptions): Buffer {
  const sheetName = (opts.sheetName ?? "Hoja1").slice(0, 31); // límite Excel

  const allRows: Row[] = [];
  if (opts.metadata && opts.metadata.length > 0) {
    for (const line of opts.metadata) allRows.push([line]);
    allRows.push([]); // separador
  }
  allRows.push(opts.headers);
  for (const r of opts.rows) allRows.push(r);

  const sheetXml = buildSheetXml(allRows);

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  return makeZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") },
  ]);
}
