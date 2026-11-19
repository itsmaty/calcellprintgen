import { describe, expect, it } from 'vitest';
import { readPngDpi, setPngDpi, pixelSize } from './png';
import { fileBaseName, zipFiles } from './exporter';
import { createDefaultConfig, applyPartial } from '../config/defaults';
import { unzipSync } from 'fflate';

// 1×1 transparentes PNG
const tinyPng = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

function chunkTypes(png: Uint8Array): string[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  let o = 8;
  while (o + 8 <= png.length) {
    const len = view.getUint32(o);
    types.push(String.fromCharCode(...png.subarray(o + 4, o + 8)));
    o += 12 + len;
  }
  return types;
}

describe('PNG-DPI', () => {
  it('fügt pHYs direkt nach IHDR ein', () => {
    const out = setPngDpi(tinyPng, 300);
    expect(chunkTypes(out)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(readPngDpi(out)).toBe(300);
  });

  it('ersetzt eine vorhandene Angabe statt sie zu verdoppeln', () => {
    const twice = setPngDpi(setPngDpi(tinyPng, 150), 600);
    expect(chunkTypes(twice).filter((t) => t === 'pHYs')).toHaveLength(1);
    expect(readPngDpi(twice)).toBe(600);
  });

  it('rechnet mm in Pixel um', () => {
    expect(pixelSize(25.4, 50.8, 300)).toEqual({ width: 300, height: 600 });
  });
});

describe('Dateinamen', () => {
  it('ersetzt Platzhalter', () => {
    const cfg = createDefaultConfig();
    cfg.general.year = 2027;
    expect(fileBaseName(cfg, 2)).toBe('2027-03_März');
    const upper = applyPartial(cfg, { output: { fileName: 'Kalender {MONAT} {jahr}' } });
    expect(fileBaseName(upper, 0)).toBe('Kalender JANUAR 2027');
  });

  it('hängt die Monatsnummer an, wenn das Muster keinen Monat enthält', () => {
    const cfg = applyPartial(createDefaultConfig(), { output: { fileName: 'kalender/{jahr}' } });
    cfg.general.year = 2027;
    expect(fileBaseName(cfg, 10)).toBe('kalender-2027-11');
  });

  it('packt Dateien in ein ZIP', () => {
    const zip = zipFiles([
      { name: 'a.svg', data: new TextEncoder().encode('<svg/>'), mime: 'image/svg+xml' },
      { name: 'März.png', data: tinyPng, mime: 'image/png' },
    ]);
    const back = unzipSync(zip);
    expect(Object.keys(back).sort()).toEqual(['März.png', 'a.svg']);
    expect(back['März.png']).toEqual(tinyPng);
  });
});
