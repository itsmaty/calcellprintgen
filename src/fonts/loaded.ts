import type { Font as OtFont, Glyph } from 'opentype.js';

/** Eine einsatzbereite Schrift (ein Schnitt) für Layout und Rendering. */
export interface LoadedFont {
  /** familyId|faceKey */
  id: string;
  familyId: string;
  faceKey: string;
  /** Anzeigename der Familie */
  name: string;
  /** Familienname für editierbaren SVG-Text / CSS (echter Name, z. B. „Inter“) */
  cssFamily: string;
  weight: number;
  italic: boolean;
  /** Geparste Schrift – null, wenn nur per Name (installierte Schrift) nutzbar */
  ot: OtFont | null;
  /** Achsenwerte bei variablen Schriften */
  coords?: Record<string, number>;
  /** Metriken in em */
  capHeight: number;
  ascender: number;
  descender: number;
  /** Cache für transformierte Glyphen (variable Schriften) und Kerning-Tabellen */
  glyphCache: Map<number, Glyph>;
  kerningTables?: unknown;
}

export function createLoadedFont(p: {
  familyId: string;
  faceKey: string;
  name: string;
  cssFamily: string;
  weight: number;
  italic: boolean;
  ot: OtFont;
  coords?: Record<string, number>;
}): LoadedFont {
  const { ot } = p;
  const upm = ot.unitsPerEm || 1000;
  let cap = ot.tables.os2?.sCapHeight ?? 0;
  if (!cap || cap <= 0) {
    const h = ot.charToGlyph('H');
    const bb = h && h.index > 0 ? h.getBoundingBox() : null;
    cap = bb && bb.y2 > 0 ? bb.y2 : upm * 0.7;
  }
  let kerningTables: unknown = undefined;
  try {
    kerningTables = ot.position.getKerningTables(ot.position.getDefaultScriptName()) ?? undefined;
  } catch {
    kerningTables = undefined;
  }
  return {
    id: `${p.familyId}|${p.faceKey}`,
    familyId: p.familyId,
    faceKey: p.faceKey,
    name: p.name,
    cssFamily: p.cssFamily,
    weight: p.weight,
    italic: p.italic,
    ot,
    coords: p.coords,
    capHeight: cap / upm,
    ascender: Math.abs(ot.ascender || upm * 0.8) / upm,
    descender: Math.abs(ot.descender || upm * 0.2) / upm,
    glyphCache: new Map(),
    kerningTables,
  };
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function cssFontString(font: Pick<LoadedFont, 'cssFamily' | 'weight' | 'italic'>, px: number): string {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${px}px "${font.cssFamily.replace(/"/g, '')}"`;
}

export function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Schrift, die nur über ihren Namen (installiert im System) angesprochen wird. */
export function createCssFont(p: {
  familyId: string;
  faceKey: string;
  name: string;
  cssFamily: string;
  weight: number;
  italic: boolean;
}): LoadedFont {
  let capHeight = 0.7;
  let ascender = 0.9;
  let descender = 0.25;
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = cssFontString(p, 100);
    const m = ctx.measureText('H');
    if (m.actualBoundingBoxAscent > 0) capHeight = m.actualBoundingBoxAscent / 100;
    if (m.fontBoundingBoxAscent) ascender = m.fontBoundingBoxAscent / 100;
    if (m.fontBoundingBoxDescent) descender = m.fontBoundingBoxDescent / 100;
  }
  return {
    id: `${p.familyId}|${p.faceKey}`,
    ...p,
    ot: null,
    capHeight,
    ascender,
    descender,
    glyphCache: new Map(),
  };
}
