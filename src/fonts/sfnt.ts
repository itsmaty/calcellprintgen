// Hilfen rund um Font-Binärformate: Format erkennen und TrueType-Collections (.ttc) zerlegen.

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'ttc' | 'unknown';

function tag(view: DataView, offset: number): string {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

export function detectFormat(buffer: ArrayBuffer): FontFormat {
  if (buffer.byteLength < 12) return 'unknown';
  const view = new DataView(buffer);
  const t = tag(view, 0);
  if (t === 'wOFF') return 'woff';
  if (t === 'wOF2') return 'woff2';
  if (t === 'ttcf') return 'ttc';
  if (t === 'OTTO') return 'otf';
  if (view.getUint32(0) === 0x00010000 || t === 'true') return 'ttf';
  return 'unknown';
}

/** Zerlegt eine TrueType-Collection in eigenständige SFNT-Dateien (eine je Schnitt). */
export function splitCollection(buffer: ArrayBuffer): ArrayBuffer[] {
  const view = new DataView(buffer);
  if (tag(view, 0) !== 'ttcf') return [buffer];
  const numFonts = view.getUint32(8);
  const out: ArrayBuffer[] = [];
  for (let f = 0; f < numFonts; f++) {
    const dirOffset = view.getUint32(12 + f * 4);
    const numTables = view.getUint16(dirOffset + 4);
    const records: { tag: number; checksum: number; offset: number; length: number }[] = [];
    for (let i = 0; i < numTables; i++) {
      const r = dirOffset + 12 + i * 16;
      records.push({
        tag: view.getUint32(r),
        checksum: view.getUint32(r + 4),
        offset: view.getUint32(r + 8),
        length: view.getUint32(r + 12),
      });
    }
    const headerSize = 12 + numTables * 16;
    let size = headerSize;
    for (const rec of records) size += (rec.length + 3) & ~3;
    const target = new ArrayBuffer(size);
    const tv = new DataView(target);
    const bytes = new Uint8Array(target);
    // Offset-Tabelle (sfntVersion, numTables, searchRange, entrySelector, rangeShift) übernehmen
    bytes.set(new Uint8Array(buffer, dirOffset, 12), 0);
    let cursor = headerSize;
    records.forEach((rec, i) => {
      const r = 12 + i * 16;
      tv.setUint32(r, rec.tag);
      tv.setUint32(r + 4, rec.checksum);
      tv.setUint32(r + 8, cursor);
      tv.setUint32(r + 12, rec.length);
      bytes.set(new Uint8Array(buffer, rec.offset, rec.length), cursor);
      cursor += (rec.length + 3) & ~3;
    });
    out.push(target);
  }
  return out;
}
