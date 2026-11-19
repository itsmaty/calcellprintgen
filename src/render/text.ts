import type { BoundingBox, Glyph } from 'opentype.js';
import { cssFontString, getMeasureContext, type LoadedFont } from '../fonts/loaded';
import { escapeXml, fmt } from './svgutil';

/** Gesetzte Textzeile. Alle Maße in mm, bezogen auf Zeilenanfang und Grundlinie. */
export interface TextRun {
  text: string;
  font: LoadedFont;
  size: number;
  /** Zusätzlicher Abstand zwischen zwei Zeichen (mm) */
  tracking: number;
  /** Laufweite ohne Sperrung nach dem letzten Zeichen */
  width: number;
  capHeight: number;
  /** tatsächliche Ausdehnung der Glyphen über/unter der Grundlinie */
  inkTop: number;
  inkBottom: number;
  /** x relativ zum Zeilenanfang (mm); scale = mm pro Font-Einheit (kann bei Ersatzglyphen abweichen) */
  glyphs: { glyph: Glyph; x: number; scale: number }[] | null;
}

type FallbackResolver = (weight: number, italic: boolean) => LoadedFont | undefined;
let fallbackResolver: FallbackResolver | null = null;

/**
 * Ersatzschrift für Zeichen, die einer Schrift fehlen (z. B. Demo-Schriften ohne Punkt).
 * Ohne Ersatz würde das „.notdef“-Zeichen (meist ein leeres Kästchen) erscheinen.
 */
export function setGlyphFallback(resolver: FallbackResolver | null): void {
  fallbackResolver = resolver;
}

const weightCache = new WeakMap<LoadedFont, number>();

function inkArea(cmds: { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }[]): number {
  let a = 0;
  let x0 = 0;
  let y0 = 0;
  let sx = 0;
  let sy = 0;
  const seg = (x1: number, y1: number) => {
    a += x0 * y1 - x1 * y0;
    x0 = x1;
    y0 = y1;
  };
  for (const c of cmds) {
    if (c.type === 'M') {
      x0 = sx = c.x ?? 0;
      y0 = sy = c.y ?? 0;
    } else if (c.type === 'L') seg(c.x ?? 0, c.y ?? 0);
    else if (c.type === 'Q') {
      const px = x0;
      const py = y0;
      for (let t = 1; t <= 8; t++) {
        const u = t / 8;
        const v = 1 - u;
        seg(v * v * px + 2 * v * u * (c.x1 ?? 0) + u * u * (c.x ?? 0), v * v * py + 2 * v * u * (c.y1 ?? 0) + u * u * (c.y ?? 0));
      }
    } else if (c.type === 'C') {
      const px = x0;
      const py = y0;
      for (let t = 1; t <= 10; t++) {
        const u = t / 10;
        const v = 1 - u;
        seg(
          v * v * v * px + 3 * v * v * u * (c.x1 ?? 0) + 3 * v * u * u * (c.x2 ?? 0) + u * u * u * (c.x ?? 0),
          v * v * v * py + 3 * v * v * u * (c.y1 ?? 0) + 3 * v * u * u * (c.y2 ?? 0) + u * u * u * (c.y ?? 0),
        );
      }
    } else if (c.type === 'Z') seg(sx, sy);
  }
  return Math.abs(a / 2);
}

/**
 * Optisches Gewicht einer Schrift (100–900), gemessen an der „Schwärze“ der Ziffern.
 * Dient dazu, fehlende Zeichen aus einem passend fetten Ersatzschnitt zu holen.
 */
export function visualWeight(font: LoadedFont): number {
  const cached = weightCache.get(font);
  if (cached !== undefined) return cached;
  let weight = font.weight;
  if (font.ot) {
    let ink = 0;
    let box = 0;
    for (const ch of '0123456789') {
      if (!hasGlyph(font, ch)) continue;
      const g = glyphFor(font, ch);
      const bb = glyphBox(g);
      if (!bb) continue;
      ink += inkArea(g.path.commands);
      box += (bb.x2 - bb.x1) * (bb.y2 - bb.y1);
    }
    if (box > 0) {
      const d = ink / box;
      // Schwellen = Mitte zwischen den gemessenen Werten von Inter 300 … 900
      const steps: [number, number][] = [
        [0.364, 300],
        [0.43, 400],
        [0.48, 500],
        [0.525, 600],
        [0.569, 700],
        [0.614, 800],
      ];
      weight = steps.find(([limit]) => d < limit)?.[1] ?? 900;
    }
  }
  weightCache.set(font, weight);
  return weight;
}

/** Enthält die Schrift ein Zeichen? (über die Zeichentabelle, nicht über den Glyphen-Index) */
function hasGlyph(font: LoadedFont, ch: string): boolean {
  try {
    return (font.ot?.charToGlyphIndex(ch) ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Zeichen aus text, die die Schrift nicht enthält (Leerzeichen ausgenommen). */
export function missingGlyphs(font: LoadedFont, text: string): string[] {
  if (!font.ot) return [];
  return [...new Set(Array.from(text))].filter((ch) => ch.trim() && !hasGlyph(font, ch));
}

const bboxCache = new WeakMap<Glyph, BoundingBox | null>();

function glyphBox(g: Glyph): BoundingBox | null {
  let bb = bboxCache.get(g);
  if (bb === undefined) {
    try {
      const b = g.getBoundingBox();
      bb = b.x1 === 0 && b.x2 === 0 && b.y1 === 0 && b.y2 === 0 ? null : b;
    } catch {
      bb = null;
    }
    bboxCache.set(g, bb);
  }
  return bb;
}

function glyphFor(font: LoadedFont, ch: string): Glyph {
  const ot = font.ot!;
  const base = ot.charToGlyph(ch);
  if (!font.coords || !ot.variation) return base;
  let g = font.glyphCache.get(base.index);
  if (!g) {
    try {
      g = ot.variation.getTransform(base, font.coords);
    } catch {
      g = base;
    }
    font.glyphCache.set(base.index, g);
  }
  return g;
}

function kerning(font: LoadedFont, left: number, right: number): number {
  const ot = font.ot!;
  try {
    if (font.kerningTables) return ot.position.getKerningValue(font.kerningTables, left, right) || 0;
    return ot.kerningPairs?.[`${left},${right}`] || 0;
  } catch {
    return 0;
  }
}

/** Setzt einen einzeiligen Text. trackingPermille: Laufweite in 1/1000 em. */
export function layoutRun(text: string, font: LoadedFont, size: number, trackingPermille = 0): TextRun {
  const tracking = (trackingPermille / 1000) * size;
  if (font.ot) {
    const scale = size / font.ot.unitsPerEm;
    const glyphs: { glyph: Glyph; x: number; scale: number }[] = [];
    let x = 0;
    let top = 0;
    let bottom = 0;
    let prev: Glyph | null = null;
    let prevFromFallback = false;
    for (const ch of text) {
      let g = glyphFor(font, ch);
      let gScale = scale;
      let fromFallback = false;
      if (ch.trim() && fallbackResolver && !hasGlyph(font, ch)) {
        const fb = fallbackResolver(visualWeight(font), font.italic);
        if (fb?.ot && fb !== font && hasGlyph(fb, ch)) {
          const fg = glyphFor(fb, ch);
          {
            g = fg;
            gScale = size / fb.ot.unitsPerEm;
            fromFallback = true;
          }
        }
      }
      if (prev) x += (fromFallback || prevFromFallback ? 0 : kerning(font, prev.index, g.index) * scale) + tracking;
      glyphs.push({ glyph: g, x, scale: gScale });
      const bb = glyphBox(g);
      if (bb) {
        top = Math.max(top, bb.y2 * gScale);
        bottom = Math.max(bottom, -bb.y1 * gScale);
      }
      x += (g.advanceWidth ?? 0) * gScale;
      prev = g;
      prevFromFallback = fromFallback;
    }
    return { text, font, size, tracking, width: x, capHeight: font.capHeight * size, inkTop: top, inkBottom: bottom, glyphs };
  }
  // Nur per Name verfügbare Schrift: Maße vom Browser holen
  const chars = Array.from(text).length;
  let width = chars * size * 0.55;
  let top = font.capHeight * size;
  let bottom = font.descender * size * 0.6;
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = cssFontString(font, 100);
    const m = ctx.measureText(text);
    width = (m.width / 100) * size;
    top = (m.actualBoundingBoxAscent / 100) * size;
    bottom = (m.actualBoundingBoxDescent / 100) * size;
  }
  width += tracking * Math.max(0, chars - 1);
  return { text, font, size, tracking, width, capHeight: font.capHeight * size, inkTop: top, inkBottom: bottom, glyphs: null };
}

/** shear: Neigung (tan des Winkels); oberhalb der Grundlinie wird nach rechts verschoben. */
function glyphPathData(glyph: Glyph, ox: number, oy: number, scale: number, shear = 0): string {
  let d = '';
  const P = (vx: number | undefined, vy: number | undefined) => {
    const y = (vy ?? 0) * scale;
    return `${fmt(ox + (vx ?? 0) * scale + y * shear)} ${fmt(oy - y)}`;
  };
  for (const c of glyph.path.commands) {
    switch (c.type) {
      case 'M':
        d += `M${P(c.x, c.y)}`;
        break;
      case 'L':
        d += `L${P(c.x, c.y)}`;
        break;
      case 'C':
        d += `C${P(c.x1, c.y1)} ${P(c.x2, c.y2)} ${P(c.x, c.y)}`;
        break;
      case 'Q':
        d += `Q${P(c.x1, c.y1)} ${P(c.x, c.y)}`;
        break;
      case 'Z':
        d += 'Z';
        break;
    }
  }
  return d;
}

/** Pfaddaten (Umrisse) eines gesetzten Texts – leer, wenn die Schrift keine Umrisse liefert. */
export function runPathData(run: TextRun, x: number, baseline: number, shear = 0): string {
  if (!run.glyphs || !run.font.ot) return '';
  let d = '';
  for (const { glyph, x: gx, scale } of run.glyphs) d += glyphPathData(glyph, x + gx, baseline, scale, shear);
  return d;
}

function familyAttr(font: LoadedFont): string {
  const name = font.cssFamily.replace(/['"]/g, '');
  return escapeXml(`'${name}', sans-serif`);
}

/**
 * Text als SVG-Element: mode 'path' = Umrisse (druckfest, keine Schrift nötig),
 * 'text' = editierbarer Text (Schrift muss beim Öffnen installiert sein).
 */
export function runToSvg(run: TextRun, x: number, baseline: number, fill: string, mode: 'path' | 'text', extra = '', shear = 0): string {
  if (!run.text.trim()) return '';
  if (mode === 'path' && run.glyphs) {
    const d = runPathData(run, x, baseline, shear);
    return d ? `<path d="${d}" fill="${fill}"${extra}/>` : '';
  }
  const f = run.font;
  // Neigung um die Grundlinie: x' = x − y·shear + baseline·shear
  const transform = shear ? ` transform="matrix(1 0 ${fmt(-shear, 5)} 1 ${fmt(baseline * shear)} 0)"` : '';
  return (
    `<text x="${fmt(x)}" y="${fmt(baseline)}" font-family="${familyAttr(f)}" font-size="${fmt(run.size)}" font-weight="${f.weight}"` +
    `${f.italic ? ' font-style="italic"' : ''}${run.tracking ? ` letter-spacing="${fmt(run.tracking)}"` : ''} fill="${fill}"${transform}${extra}>` +
    `${escapeXml(run.text)}</text>`
  );
}

/**
 * Bricht Namen (z. B. Feiertage) in Zeilen um. Jeder Name beginnt in einer neuen Zeile.
 * Passt es nicht, wird die Schrift bis auf 60 % verkleinert, danach wird gekürzt.
 */
export function wrapNames(
  names: string[],
  font: LoadedFont,
  size: number,
  trackingPermille: number,
  maxWidth: number,
  maxLines: number,
): TextRun[] {
  const limit = Math.max(1, Math.round(maxLines));
  const attempt = (s: number): { lines: TextRun[]; fits: boolean } => {
    const lines: TextRun[] = [];
    let fits = true;
    for (const name of names) {
      const words = name.split(/\s+/).filter(Boolean);
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || layoutRun(candidate, font, s, trackingPermille).width <= maxWidth) {
          current = candidate;
        } else {
          lines.push(layoutRun(current, font, s, trackingPermille));
          current = word;
        }
        if (layoutRun(word, font, s, trackingPermille).width > maxWidth) fits = false;
      }
      if (current) lines.push(layoutRun(current, font, s, trackingPermille));
    }
    return { lines, fits: fits && lines.length <= limit };
  };
  let s = size;
  let result = attempt(s);
  while (!result.fits && s > size * 0.6) {
    s *= 0.92;
    result = attempt(s);
  }
  if (result.lines.length > limit) {
    const kept = result.lines.slice(0, limit);
    const last = kept[limit - 1];
    let text = last.text;
    while (text.length > 1 && layoutRun(`${text}…`, font, s, trackingPermille).width > maxWidth) text = text.slice(0, -1);
    kept[limit - 1] = layoutRun(`${text.trimEnd()}…`, font, s, trackingPermille);
    return kept;
  }
  return result.lines;
}
