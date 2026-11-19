import type { StrokeStyle } from '../config/types';

export const PT_TO_MM = 25.4 / 72;

/** Zahl kompakt für SVG formatieren (max. 3 Nachkommastellen = 1 µm). */
export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '0';
  const p = 10 ** digits;
  const r = Math.round(v * p) / p;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** Nur saubere Hex-Farben durchlassen (schützt auch vor kaputten Importen). */
export function safeColor(c: string | undefined | null, fallback = '#000000'): string {
  return typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c) ? c.toLowerCase() : fallback;
}

export function safeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Attribute für Strichart (gestrichelt/gepunktet). Längen in mm. */
export function dashAttrs(style: StrokeStyle, widthMm: number, dash: number, gap: number): string {
  if (style === 'dashed') return ` stroke-dasharray="${fmt(Math.max(0.05, dash))} ${fmt(Math.max(0.05, gap))}"`;
  if (style === 'dotted') return ` stroke-dasharray="0 ${fmt(Math.max(0.05, gap + widthMm))}" stroke-linecap="round"`;
  return '';
}

export function opacityAttr(name: string, value: number): string {
  return value < 0.999 ? ` ${name}="${fmt(Math.max(0, value), 3)}"` : '';
}
