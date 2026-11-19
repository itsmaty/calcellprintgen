// SVG → PNG im Browser rastern und die Auflösung (DPI) in die Datei schreiben,
// damit Layoutprogramme (InDesign, Affinity, Photoshop …) die richtige Druckgröße erkennen.

const MAX_SIDE = 32_767;
const MAX_AREA = 268_000_000;

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Setzt bzw. ersetzt den pHYs-Chunk (Pixel pro Meter) einer PNG-Datei. */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  let inserted = false;
  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(21);
  const pv = new DataView(phys.buffer);
  pv.setUint32(0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  pv.setUint32(8, ppm);
  pv.setUint32(12, ppm);
  phys[16] = 1; // Einheit: Meter
  pv.setUint32(17, crc32(phys.subarray(4, 17)));
  while (offset + 8 <= png.length) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const end = offset + 12 + len;
    if (type !== 'pHYs') chunks.push(png.subarray(offset, end));
    if (type === 'IHDR' && !inserted) {
      chunks.push(phys);
      inserted = true;
    }
    offset = end;
    if (type === 'IEND') break;
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Liest die DPI aus einer PNG-Datei (für Tests/Anzeige). */
export function readPngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  while (offset + 8 <= png.length) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    if (type === 'pHYs' && png[offset + 16] === 1) return Math.round(view.getUint32(offset + 8) * 0.0254);
    offset += 12 + len;
    if (type === 'IEND') break;
  }
  return null;
}

export function pixelSize(widthMm: number, heightMm: number, dpi: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((widthMm / 25.4) * dpi)),
    height: Math.max(1, Math.round((heightMm / 25.4) * dpi)),
  };
}

export function checkCanvasSize(width: number, height: number): string | null {
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_AREA) {
    return `Das Bild wäre ${width} × ${height} px groß – zu groß für den Browser. Bitte die Auflösung (dpi) verringern.`;
  }
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Die Grafik konnte nicht gerastert werden.'));
    img.src = url;
  });
}

/** Rastert ein SVG (dessen width/height bereits in Pixeln angegeben sind) zu PNG-Bytes mit DPI-Angabe. */
export async function rasterizeSvg(svg: string, width: number, height: number, dpi: number): Promise<Uint8Array> {
  const problem = checkCanvasSize(width, height);
  if (problem) throw new Error(problem);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  try {
    const img = await loadImage(url);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar.');
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(`PNG mit ${width} × ${height} px konnte nicht erzeugt werden – bitte die Auflösung verringern.`);
    return setPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
