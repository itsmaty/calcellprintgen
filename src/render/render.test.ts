import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'opentype.js';
import { createDefaultConfig, applyPartial } from '../config/defaults';
import type { Config, FontRef } from '../config/types';
import { createLoadedFont, type LoadedFont } from '../fonts/loaded';
import catalog from '../fonts/catalog.json';
import { createYearContext, renderMonth } from './month';
import * as opentype from 'opentype.js';
import { layoutRun, missingGlyphs, setGlyphFallback, visualWeight } from './text';
import { PRESETS, applyPreset } from '../config/presets';

const root = join(__dirname, '../..');
const cache = new Map<string, LoadedFont>();

/** Schriften direkt von der Platte laden (statt fetch im Browser). */
function resolveFont(ref: FontRef): LoadedFont {
  const key = `${ref.family}|${ref.face}`;
  let f = cache.get(key);
  if (!f) {
    const fam = (catalog as { id: string; family: string; variants: { weight: number; style: string; file: string }[] }[]).find((c) => c.id === ref.family)!;
    const italic = ref.face.endsWith('i');
    const weight = Number.parseInt(ref.face, 10);
    const v = fam.variants.find((x) => x.weight === weight && (x.style === 'italic') === italic) ?? fam.variants[0];
    const buf = readFileSync(join(root, 'src/assets/fonts', v.file));
    const ot = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    f = createLoadedFont({ familyId: fam.id, faceKey: ref.face, name: fam.family, cssFamily: fam.family, weight: v.weight, italic, ot });
    cache.set(key, f);
  }
  return f;
}

function renderAll(cfg: Config) {
  const ctx = createYearContext(cfg, resolveFont);
  return Array.from({ length: 12 }, (_, m) => renderMonth(ctx, m, { textMode: 'path' }));
}

const out = process.env.CALCELL_SVG_OUT;

describe('Monats-SVG', () => {
  it('rendert alle Monate mit Standardeinstellungen', () => {
    const months = renderAll(createDefaultConfig());
    for (const m of months) {
      expect(m.svg.startsWith('<svg')).toBe(true);
      expect(m.svg).toContain('</svg>');
      expect(m.svg).not.toContain('NaN');
      expect(m.svg).not.toContain('undefined');
    }
    // Februar 2027 hat 4 Zeilen, Mai 6 → unterschiedliche Höhen, gleiche Breite
    expect(months[1].geometry.rows).toBe(4);
    expect(months[4].geometry.rows).toBe(6);
    expect(months[1].width).toBeCloseTo(months[4].width, 6);
    expect(months[1].height).toBeLessThan(months[4].height);
    if (out) {
      mkdirSync(out, { recursive: true });
      months.forEach((m) => writeFileSync(join(out, `default-${m.month + 1}.svg`), m.svg));
    }
  });

  it('immer 6 Zeilen → identische Bildgröße in allen Monaten', () => {
    const cfg = applyPartial(createDefaultConfig(), { layout: { rows: 'six' } });
    const months = renderAll(cfg);
    const h = months[0].height;
    expect(months.every((m) => Math.abs(m.height - h) < 1e-9)).toBe(true);
  });

  it('Gesamtgröße wird exakt eingehalten', () => {
    const cfg = applyPartial(createDefaultConfig(), { layout: { sizeMode: 'total', totalWidth: 297, totalHeight: 210 } });
    for (const m of renderAll(cfg)) {
      expect(m.width).toBe(297);
      expect(m.height).toBe(210);
    }
  });

  it('ausgeblendete Überlauftage erzeugen keine Zellen', () => {
    const cfg = applyPartial(createDefaultConfig(), { layout: { overflow: 'hidden' } });
    const may = renderAll(cfg)[4].svg;
    expect(may).not.toContain('tag-2027-04-30');
    expect(may).toContain('tag-2027-05-01');
    const dimmed = renderAll(applyPartial(createDefaultConfig(), { layout: { overflow: 'dimmed', overflowOpacity: 35 } }))[4].svg;
    expect(dimmed).toMatch(/id="tag-2027-04-30" opacity="0.35"/);
    // Standard: leere Kästchen ohne Zahl
    const empty = renderAll(createDefaultConfig())[4].svg;
    expect(empty).toMatch(/id="tag-2027-04-30"><path[^>]*\/><\/g>/);
  });

  it('alle Formen und Optionen rendern ohne Fehler', () => {
    const shapes = ['none', 'rect', 'circle', 'ellipse', 'squircle', 'hexagon'] as const;
    const corners = ['round', 'bevel', 'scoop', 'notch'] as const;
    for (const shape of shapes) {
      for (const cornerStyle of corners) {
        const cfg = applyPartial(createDefaultConfig(), {
          cell: { shape, cornerStyle, strokeEnabled: true, strokeStyle: 'dashed', shadowEnabled: true, shadowBlur: 1, sideTop: false },
          dayNumber: { badge: 'circle', anchor: 'mc' },
          weekday: { show: true },
          weekNumbers: { show: true, side: 'right' },
          lines: { show: true },
          holidays: { region: 'DE-BY', observances: true, entries: '!14.02. Valentinstag\n24.12. Heiligabend' },
          title: { position: 'bottom', align: 'center' },
          header: { background: 'cells' },
          output: { background: 'color' },
        });
        for (const m of renderAll(cfg)) {
          expect(m.svg).not.toContain('NaN');
          expect(m.svg).not.toContain('undefined');
        }
      }
    }
  });

  it('Tabellenraster zeichnet gemeinsame Linien', () => {
    const cfg = applyPartial(createDefaultConfig(), {
      cell: { borderMode: 'grid', strokeEnabled: true, fillEnabled: false },
      layout: { overflow: 'hidden' },
    });
    const months = renderAll(cfg);
    expect(months[0].svg).toContain('id="raster"');
    if (out) months.slice(0, 3).forEach((m) => writeFileSync(join(out, `grid-${m.month + 1}.svg`), m.svg));
  });

  it('editierbarer Text nutzt <text> mit Schriftname', () => {
    const cfg = applyPartial(createDefaultConfig(), { title: { show: true } });
    const ctx = createYearContext(cfg, resolveFont);
    const m = renderMonth(ctx, 0, { textMode: 'text' });
    expect(m.svg).toContain("font-family=\"&apos;Inter&apos;, sans-serif\"");
    expect(m.svg).toContain('>Januar</text>');
    expect(m.svg).toContain("font-family=\"&apos;Oswald&apos;, sans-serif\"");
    expect(m.svg).toContain('>1.</text>');
    expect(m.svg).toContain('>Montag</text>');
  });

  it('Kopfzeile wie Zellen: gleiche Höhe, Verlauf und Schatten', () => {
    const months = renderAll(createDefaultConfig());
    const g = months[0].geometry;
    expect(g.headerH).toBe(g.cellH);
    expect(g.gridY - (g.headerY! + g.headerH)).toBeCloseTo(g.gapY, 9);
    expect(months[0].svg).toContain('<linearGradient id="zellverlauf"');
    expect(months[0].svg).toContain('id="schatten"');
    if (out) months.forEach((m) => writeFileSync(join(out, `boxes-${m.month + 1}.svg`), m.svg));
  });

  it('Gesamtgröße mit Kopfzeile wie Zellen verteilt die Höhe auf alle Zeilen', () => {
    const cfg = applyPartial(createDefaultConfig(), { layout: { sizeMode: 'total', totalWidth: 280, totalHeight: 70, rows: 'six' } });
    const m = renderAll(cfg)[0];
    const g = m.geometry;
    expect(m.height).toBe(70);
    expect(g.headerH).toBeCloseTo(g.cellH, 9);
    // 7 Zeilen (Kopf + 6 Wochen) + 6 Abstände füllen die Höhe zwischen den Rändern
    expect(g.gridY + g.gridH).toBeLessThanOrEqual(70);
  });

  it('Kopfzeile nimmt bei weißer Zahl auf roter Zelle die rote Akzentfarbe', () => {
    const poster = applyPreset(createDefaultConfig(), PRESETS.find((p) => p.id === 'poster')!);
    const ctx = createYearContext(poster, resolveFont);
    const svg = renderMonth(ctx, 0, { textMode: 'text' }).svg;
    expect(svg).toMatch(/fill="#e63946">SO<\/text>/);
  });

  it('alle Vorlagen rendern fehlerfrei', () => {
    for (const p of PRESETS) {
      const cfg = applyPreset(createDefaultConfig(), p);
      for (const m of renderAll(cfg)) {
        expect(m.svg, p.id).not.toContain('NaN');
        expect(m.svg, p.id).not.toContain('undefined');
      }
    }
  });

  it('Parallelogramme bleiben vollständig im Bild und Text richtet sich an der schrägen Kante aus', () => {
    const cfg = applyPartial(createDefaultConfig(), { cell: { shape: 'parallelogram', skew: 25, skewText: true } });
    for (const m of renderAll(cfg)) {
      expect(m.svg).not.toContain('NaN');
      const xs = [...m.svg.matchAll(/d="([^"]+)"/g)].flatMap((d) => [...d[1].matchAll(/[ML](-?[\d.]+) /g)].map((x) => Number(x[1])));
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(m.width);
    }
    // Bild ist breiter als bei Rechtecken (Überstand links und rechts)
    const rect = renderAll(createDefaultConfig())[0];
    const para = renderAll(cfg)[0];
    const over = (8 / 2) * Math.tan((25 * Math.PI) / 180);
    expect(para.width).toBeCloseTo(rect.width + 2 * over, 6);
  });

  it('negative Neigung spiegelt die Form', () => {
    const cfg = applyPartial(createDefaultConfig(), { cell: { shape: 'parallelogram', skew: -20 } });
    const months = renderAll(cfg);
    expect(months[0].svg).not.toContain('NaN');
  });

  it('Kopfzeile verkleinert zu lange Wochentage gemeinsam', () => {
    const big = applyPartial(createDefaultConfig(), { header: { size: 40 } });
    const ctx = createYearContext(big, resolveFont);
    const svg = renderMonth(ctx, 0, { textMode: 'text' }).svg;
    const sizes = [...svg.matchAll(/<text [^>]*font-size="([\d.]+)"[^>]*>(Montag|Donnerstag|Sonntag)</g)].map((m) => Number(m[1]));
    expect(sizes).toHaveLength(3);
    expect(new Set(sizes).size).toBe(1); // alle gleich groß
    expect(sizes[0]).toBeLessThan(40 * (25.4 / 72));
    const off = applyPartial(big, { header: { autoFit: false } });
    const svgOff = renderMonth(createYearContext(off, resolveFont), 0, { textMode: 'text' }).svg;
    expect(svgOff).toContain(`font-size="${Math.round(40 * (25.4 / 72) * 1000) / 1000}"`);
  });

  it('fehlende Zeichen kommen aus der Ersatzschrift', () => {
    // Mini-Schrift, die nur die Ziffer 1 kennt
    const ot = opentype as unknown as {
      Font: new (o: object) => import('opentype.js').Font;
      Glyph: new (o: object) => import('opentype.js').Glyph;
      Path: new () => { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; close(): void };
    };
    const p = new ot.Path();
    p.moveTo(100, 0);
    p.lineTo(200, 0);
    p.lineTo(200, 700);
    p.lineTo(100, 700);
    p.close();
    const tiny = new ot.Font({
      familyName: 'Mini',
      styleName: 'Regular',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      glyphs: [new ot.Glyph({ name: '.notdef', advanceWidth: 500, path: new ot.Path() }), new ot.Glyph({ name: 'one', unicode: 49, advanceWidth: 300, path: p })],
    });
    const mini = createLoadedFont({ familyId: 'mini', faceKey: '400', name: 'Mini', cssFamily: 'Mini', weight: 400, italic: false, ot: tiny });
    expect(missingGlyphs(mini, '1.')).toEqual(['.']);
    setGlyphFallback(null);
    const without = layoutRun('1.', mini, 10);
    expect(without.glyphs![1].glyph.index).toBe(0);
    setGlyphFallback(() => resolveFont({ family: 'inter', face: '700' }));
    const withFb = layoutRun('1.', mini, 10);
    setGlyphFallback(null);
    expect(withFb.glyphs![1].glyph.index).toBeGreaterThan(0);
    expect(withFb.glyphs![1].scale).toBeCloseTo(10 / resolveFont({ family: 'inter', face: '700' }).ot!.unitsPerEm, 9);
  });

  it('optisches Gewicht wird an den Ziffern gemessen', () => {
    expect(visualWeight(resolveFont({ family: 'inter', face: '400' }))).toBe(400);
    expect(visualWeight(resolveFont({ family: 'inter', face: '900' }))).toBe(900);
    expect(visualWeight(resolveFont({ family: 'oswald', face: '700' }))).toBe(900);
  });
});
