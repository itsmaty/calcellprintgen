import type { CellConfig, CornerStyle } from '../config/types';
import { fmt } from './svgutil';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Pt = [number, number];

export function insetBox(b: Box, d: number): Box {
  const dx = Math.min(d, b.w / 2);
  const dy = Math.min(d, b.h / 2);
  return { x: b.x + dx, y: b.y + dy, w: b.w - 2 * dx, h: b.h - 2 * dy };
}

export function scaleBox(b: Box, factor: number): Box {
  const w = b.w * factor;
  const h = b.h * factor;
  return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
}

/** Radien wie bei CSS begrenzen, damit sich gegenüberliegende Ecken nicht überlappen. */
function clampRadii(b: Box, r: number[]): number[] {
  const v = r.map((x) => Math.max(0, x));
  const f = Math.min(
    1,
    v[0] + v[1] > 0 ? b.w / (v[0] + v[1]) : 1,
    v[3] + v[2] > 0 ? b.w / (v[3] + v[2]) : 1,
    v[0] + v[3] > 0 ? b.h / (v[0] + v[3]) : 1,
    v[1] + v[2] > 0 ? b.h / (v[1] + v[2]) : 1,
  );
  return v.map((x) => x * f);
}

/** Radius nach innen versetzen, damit die Kontur parallel zur Außenkante bleibt. */
function insetRadius(r: number, d: number, style: CornerStyle): number {
  if (r <= 0) return 0;
  switch (style) {
    case 'round':
      return Math.max(0, r - d);
    case 'scoop':
      return r + d;
    case 'bevel':
      return Math.max(0, r - d * (2 - Math.SQRT2));
    case 'notch':
    default:
      return r;
  }
}

/** Rechteck mit (einzelnen) Eckenradien. Reihenfolge der Radien: oben links, oben rechts, unten rechts, unten links. */
export function rectPath(b: Box, radii: number[], style: CornerStyle): string {
  const [tl, tr, br, bl] = clampRadii(b, radii);
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  // Ecke bis zum Endpunkt (ex, ey); (cx, cy) = Eckpunkt des Rechtecks, r = Radius
  const corner = (r: number, ex: number, ey: number, cx: number, cy: number): string => {
    if (r <= 0.0005) return `L${fmt(cx)} ${fmt(cy)}`;
    if (style === 'bevel') return `L${fmt(ex)} ${fmt(ey)}`;
    // nach innen gewölbt (Viertelkreis um den Eckpunkt) bzw. normal abgerundet
    return `A${fmt(r)} ${fmt(r)} 0 0 ${style === 'scoop' ? 0 : 1} ${fmt(ex)} ${fmt(ey)}`;
  };
  if (style === 'notch') {
    // Eckige Kerbe: Polygonzug
    const p: Pt[] = [];
    p.push([x0 + tl, y0], [x1 - tr, y0]);
    if (tr > 0) p.push([x1 - tr, y0 + tr], [x1, y0 + tr]);
    p.push([x1, y1 - br]);
    if (br > 0) p.push([x1 - br, y1 - br], [x1 - br, y1]);
    p.push([x0 + bl, y1]);
    if (bl > 0) p.push([x0 + bl, y1 - bl], [x0, y1 - bl]);
    p.push([x0, y0 + tl]);
    if (tl > 0) p.push([x0 + tl, y0 + tl]);
    return polyline(dedupe(p));
  }
  let d = `M${fmt(x0 + tl)} ${fmt(y0)}L${fmt(x1 - tr)} ${fmt(y0)}`;
  d += corner(tr, x1, y0 + tr, x1, y0);
  d += `L${fmt(x1)} ${fmt(y1 - br)}`;
  d += corner(br, x1 - br, y1, x1, y1);
  d += `L${fmt(x0 + bl)} ${fmt(y1)}`;
  d += corner(bl, x0, y1 - bl, x0, y1);
  d += `L${fmt(x0)} ${fmt(y0 + tl)}`;
  d += corner(tl, x0 + tl, y0, x0, y0);
  return `${d}Z`;
}

function dedupe(points: Pt[]): Pt[] {
  return points.filter((p, i) => {
    const q = points[(i + points.length - 1) % points.length];
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6;
  });
}

function polyline(points: Pt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join('') + 'Z';
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  if (rx <= 0 || ry <= 0) return '';
  return `M${fmt(cx - rx)} ${fmt(cy)}A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)}A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)}Z`;
}

/** Superellipse |x/a|^n + |y/b|^n = 1, als glatte Kurve (Catmull-Rom → Bézier). */
export function squirclePath(b: Box, n: number): string {
  const a = b.w / 2;
  const bb = b.h / 2;
  if (a <= 0 || bb <= 0) return '';
  const cx = b.x + a;
  const cy = b.y + bb;
  const e = 2 / Math.max(2, n);
  const count = 64;
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([cx + a * Math.sign(c) * Math.abs(c) ** e, cy + bb * Math.sign(s) * Math.abs(s) ** e]);
  }
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d}Z`;
}

export function hexagonPoints(b: Box, orientation: 'pointy' | 'flat'): Pt[] {
  const { x, y, w, h } = b;
  if (orientation === 'flat') {
    return [
      [x + w / 4, y],
      [x + (3 * w) / 4, y],
      [x + w, y + h / 2],
      [x + (3 * w) / 4, y + h],
      [x + w / 4, y + h],
      [x, y + h / 2],
    ];
  }
  return [
    [x + w / 2, y],
    [x + w, y + h / 4],
    [x + w, y + (3 * h) / 4],
    [x + w / 2, y + h],
    [x, y + (3 * h) / 4],
    [x, y + h / 4],
  ];
}

/** Polygon mit optional abgerundeten Ecken (quadratische Bézier-Kurven). */
export function polygonPath(points: Pt[], radius: number): string {
  if (radius <= 0.0005) return polyline(points);
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const lenA = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]);
    const lenB = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const r = Math.min(radius, lenA / 2, lenB / 2);
    const a: Pt = [cur[0] + ((prev[0] - cur[0]) * r) / lenA, cur[1] + ((prev[1] - cur[1]) * r) / lenA];
    const c: Pt = [cur[0] + ((next[0] - cur[0]) * r) / lenB, cur[1] + ((next[1] - cur[1]) * r) / lenB];
    d += `${i ? 'L' : 'M'}${fmt(a[0])} ${fmt(a[1])}Q${fmt(cur[0])} ${fmt(cur[1])} ${fmt(c[0])} ${fmt(c[1])}`;
  }
  return `${d}Z`;
}

/** tan der Parallelogramm-Neigung (0 für alle anderen Formen). Positiv = oben nach rechts versetzt. */
export function skewTan(cell: CellConfig): number {
  if (cell.shape !== 'parallelogram') return 0;
  const deg = Math.max(-75, Math.min(75, cell.skew || 0));
  return Math.tan((deg * Math.PI) / 180);
}

/**
 * Parallelogramm, das um die Mitte des Kastens geschert ist: oben um h/2·tan nach rechts,
 * unten um h/2·tan nach links. Waagrechte Kanten behalten die volle Breite.
 */
export function parallelogramPoints(b: Box, tan: number): Pt[] {
  const dx = (b.h / 2) * tan;
  return [
    [b.x + dx, b.y],
    [b.x + b.w + dx, b.y],
    [b.x + b.w - dx, b.y + b.h],
    [b.x - dx, b.y + b.h],
  ];
}

/**
 * Linke und rechte Kante der Form auf Höhe y – für die Textausrichtung in schrägen Kästchen.
 * Bei allen anderen Formen sind das einfach die Ränder des Kastens.
 */
export function shapeEdges(cell: CellConfig, sb: Box): (y: number) => [number, number] {
  const tan = skewTan(cell);
  if (!tan) return () => [sb.x, sb.x + sb.w];
  const cy = sb.y + sb.h / 2;
  return (y: number) => {
    const shift = (cy - y) * tan;
    return [sb.x + shift, sb.x + sb.w + shift];
  };
}

/** Wie weit ein Parallelogramm seitlich über seinen Kasten hinausragt. */
export function skewOverhang(cell: CellConfig, height: number): number {
  return Math.abs((height / 2) * skewTan(cell));
}

export function cornerRadii(cell: CellConfig): number[] {
  return cell.individualCorners ? [cell.radiusTL, cell.radiusTR, cell.radiusBR, cell.radiusBL] : [cell.radius, cell.radius, cell.radius, cell.radius];
}

/** Begrenzungsrahmen der eigentlichen Form innerhalb der Zelle (für Textpositionen). */
export function shapeBounds(cell: CellConfig, cellBox: Box): Box {
  if (cell.shape === 'none') return cellBox;
  const b = scaleBox(cellBox, Math.max(0.05, cell.scale / 100));
  if (cell.shape === 'circle') {
    const s = Math.min(b.w, b.h);
    return { x: b.x + (b.w - s) / 2, y: b.y + (b.h - s) / 2, w: s, h: s };
  }
  return b;
}

/**
 * Konturpfad der Zellform. inset verschiebt die Kontur nach innen (z. B. um die halbe
 * Linienstärke, damit der Rahmen innerhalb der Zelle liegt).
 */
export function cellShapePath(cell: CellConfig, bounds: Box, inset = 0, forceRect = false): string {
  const shape = forceRect ? 'rect' : cell.shape;
  if (shape === 'parallelogram') {
    // Kontur parallel nach innen versetzen: waagrecht um d/cos, senkrecht um d
    const tan = skewTan(cell);
    const cos = Math.cos(Math.atan(tan));
    const dx = inset / cos;
    const ib: Box = { x: bounds.x + dx, y: bounds.y + inset, w: bounds.w - 2 * dx, h: bounds.h - 2 * inset };
    if (ib.w <= 0 || ib.h <= 0) return '';
    return polygonPath(parallelogramPoints(ib, tan), Math.max(0, cell.radius - inset));
  }
  const b = insetBox(bounds, inset);
  if (b.w <= 0 || b.h <= 0) return '';
  switch (shape) {
    case 'none':
      return '';
    case 'circle': {
      const r = Math.min(b.w, b.h) / 2;
      return ellipsePath(b.x + b.w / 2, b.y + b.h / 2, r, r);
    }
    case 'ellipse':
      return ellipsePath(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2);
    case 'squircle':
      return squirclePath(b, cell.squircleN);
    case 'hexagon':
      return polygonPath(hexagonPoints(b, cell.hexOrientation), Math.max(0, cell.radius - inset));
    case 'rect':
    default: {
      const radii = forceRect ? [0, 0, 0, 0] : cornerRadii(cell).map((r) => insetRadius(r, inset, cell.cornerStyle));
      return rectPath(b, radii, cell.cornerStyle);
    }
  }
}
