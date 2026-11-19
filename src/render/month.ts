import type { Anchor, CellConfig, Config, DayOverride, FontRef } from '../config/types';
import type { LoadedFont } from '../fonts/loaded';
import { buildMonthGrid, pad2, weekNumberOfRow, type CalDay, type MonthGrid } from '../calendar/dates';
import { buildAnnotations, type DayAnnotations } from '../calendar/holidays';
import { applyCase, monthName, weekdayName } from '../calendar/locale';
import { cellShapePath, cornerRadii, ellipsePath, rectPath, shapeBounds, shapeEdges, skewOverhang, skewTan, type Box } from './shapes';
import { layoutRun, runToSvg, wrapNames, type TextRun } from './text';
import { PT_TO_MM, dashAttrs, escapeXml, fmt, opacityAttr, safeColor } from './svgutil';

export type FontResolver = (ref: FontRef) => LoadedFont;
export type TextMode = 'path' | 'text';

export interface RenderOptions {
  /** 'path' = Text als Umrisse (Vorschau, PNG, druckfertiges SVG), 'text' = editierbarer SVG-Text */
  textMode: TextMode;
  /** Pixelmaße des SVG-Elements (für die Rasterung). Ohne Angabe: physische Größe in mm. */
  pixelSize?: { width: number; height: number };
}

interface TitleRuns {
  month: TextRun;
  sep: TextRun | null;
  year: TextRun | null;
  width: number;
}

export interface YearContext {
  cfg: Config;
  /** Zellkonfiguration nach Modus-Regeln (z. B. Tabellenraster erzwingt Rechtecke) */
  cell: CellConfig;
  gridMode: boolean;
  fonts: {
    day: LoadedFont;
    weekday: LoadedFont;
    header: LoadedFont;
    title: LoadedFont;
    year: LoadedFont;
    weekNo: LoadedFont;
    notes: LoadedFont;
  };
  annotations: Map<string, DayAnnotations>;
  titleInkTop: number;
  titleInkBottom: number;
}

export interface MonthGeometry {
  grid: MonthGrid;
  rows: number;
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  titleBaseline: number | null;
  headerY: number | null;
  headerH: number;
  weekNoX: number | null;
}

export interface RenderedMonth {
  month: number;
  svg: string;
  width: number;
  height: number;
  geometry: MonthGeometry;
}

const GRADIENT_ID = 'zellverlauf';
const pt = (v: number) => v * PT_TO_MM;

export function createYearContext(cfg: Config, resolveFont: FontResolver): YearContext {
  const gridMode = cfg.cell.borderMode === 'grid';
  const cell: CellConfig = gridMode
    ? { ...cfg.cell, shape: 'rect', scale: 100, radius: 0, individualCorners: false, cornerStyle: 'round', shadowEnabled: false }
    : cfg.cell;
  const year = cfg.general.year;
  const ctx: YearContext = {
    cfg,
    cell,
    gridMode,
    fonts: {
      day: resolveFont(cfg.dayNumber.font),
      weekday: resolveFont(cfg.weekday.font),
      header: resolveFont(cfg.header.font),
      title: resolveFont(cfg.title.font),
      year: resolveFont(cfg.title.yearFont),
      weekNo: resolveFont(cfg.weekNumbers.font),
      notes: resolveFont(cfg.holidays.font),
    },
    annotations: buildAnnotations([year - 1, year, year + 1], cfg.holidays.region, cfg.holidays.observances, cfg.holidays.entries),
    titleInkTop: 0,
    titleInkBottom: 0,
  };
  // Titelmaße über alle 12 Monate, damit das Raster in jedem Monat an derselben Stelle sitzt.
  if (cfg.title.show) {
    for (let m = 0; m < 12; m++) {
      const t = titleRuns(ctx, m);
      for (const run of [t.month, t.sep, t.year]) {
        if (!run) continue;
        ctx.titleInkTop = Math.max(ctx.titleInkTop, run.inkTop, run.capHeight);
        ctx.titleInkBottom = Math.max(ctx.titleInkBottom, run.inkBottom);
      }
    }
  }
  return ctx;
}

function titleRuns(ctx: YearContext, month: number): TitleRuns {
  const { title, general } = ctx.cfg;
  const text = applyCase(monthName(general, month, title.format), title.textCase, general.locale);
  const m = layoutRun(text, ctx.fonts.title, pt(title.size), title.tracking);
  if (!title.showYear) return { month: m, sep: null, year: null, width: m.width };
  const sep = title.yearSeparator ? layoutRun(title.yearSeparator, ctx.fonts.title, pt(title.size), title.tracking) : null;
  const y = layoutRun(String(general.year), ctx.fonts.year, pt(title.yearSize), title.tracking);
  const join = m.tracking;
  const width = m.width + (sep ? join + sep.width : 0) + join + y.width;
  return { month: m, sep, year: y, width };
}

export function computeGeometry(ctx: YearContext, month: number): MonthGeometry {
  const { cfg, cell } = ctx;
  const L = cfg.layout;
  const grid = buildMonthGrid(cfg.general.year, month, cfg.general.weekStart, L.rows);
  const rows = grid.rows.length;
  const gapX = ctx.gridMode ? 0 : Math.max(0, L.gapX);
  const gapY = ctx.gridMode ? 0 : Math.max(0, L.gapY);

  // Ränder + Platz für Schatten bzw. halbe Rasterlinie
  let padL = Math.max(0, L.padding);
  let padR = padL;
  let padT = padL;
  let padB = padL;
  if (cell.shadowEnabled && cell.shape !== 'none') {
    const blur = Math.max(0, cell.shadowBlur) * 1.5;
    padL += Math.max(0, -cell.shadowX) + blur;
    padR += Math.max(0, cell.shadowX) + blur;
    padT += Math.max(0, -cell.shadowY) + blur;
    padB += Math.max(0, cell.shadowY) + blur;
  }
  if (ctx.gridMode && cell.strokeEnabled) {
    const half = pt(cell.strokeWidth) / 2;
    padL += half;
    padR += half;
    padT += half;
    padB += half;
  }

  const wn = cfg.weekNumbers;
  const wnBlock = wn.show ? Math.max(0, wn.width) + Math.max(0, wn.gap) : 0;
  const wnLeft = wn.show && wn.side === 'left' ? wnBlock : 0;
  const wnRight = wn.show && wn.side === 'right' ? wnBlock : 0;

  const t = cfg.title;
  const titleTop = t.show && t.position === 'top' ? ctx.titleInkTop + t.gap : 0;
  const titleBottom = t.show && t.position === 'bottom' ? t.gap + ctx.titleInkTop + ctx.titleInkBottom : 0;
  const hd = cfg.header;
  // Kopfzeile „wie Zellen“ zählt als zusätzliche Zeile mit Zellhöhe und Zeilenabstand
  const headerRows = hd.show && hd.matchCell ? 1 : 0;
  const headerFixed = hd.show && !hd.matchCell ? Math.max(0, hd.height) + Math.max(0, hd.gap) : 0;

  let cellH = Math.max(1, L.cellHeight);
  if (L.sizeMode === 'total') {
    const free = L.totalHeight - padT - padB - titleTop - titleBottom - headerFixed - (rows - 1 + headerRows) * gapY;
    cellH = Math.max(1, free / (rows + headerRows));
  }
  const headerH = hd.show ? (hd.matchCell ? cellH : Math.max(0, hd.height)) : 0;
  const headerGap = hd.show ? (hd.matchCell ? gapY : Math.max(0, hd.gap)) : 0;

  // Schräge Kästchen ragen seitlich über ihren Kasten hinaus – Platz dafür am Rand lassen
  if (cell.shape === 'parallelogram') {
    const scale = Math.max(0.05, cell.scale / 100);
    const tallest = Math.max(cellH, hd.show && hd.background === 'cell' ? headerH : 0) * scale;
    const over = skewOverhang(cell, tallest);
    padL += over;
    padR += over;
  }
  let cellW = Math.max(1, L.cellWidth);
  if (L.sizeMode === 'total') cellW = Math.max(1, (L.totalWidth - padL - padR - wnLeft - wnRight - 6 * gapX) / 7);

  const gridW = 7 * cellW + 6 * gapX;
  const gridH = rows * cellH + (rows - 1) * gapY;
  const gridX = padL + wnLeft;
  let y = padT;
  let titleBaseline: number | null = null;
  if (t.show && t.position === 'top') {
    titleBaseline = y + ctx.titleInkTop;
    y = titleBaseline + t.gap;
  }
  let headerY: number | null = null;
  if (hd.show) {
    headerY = y;
    y += headerH + headerGap;
  }
  const gridY = y;
  y += gridH;
  if (t.show && t.position === 'bottom') {
    titleBaseline = y + t.gap + ctx.titleInkTop;
    y = titleBaseline + ctx.titleInkBottom;
  }
  const width = L.sizeMode === 'total' ? Math.max(1, L.totalWidth) : gridX + gridW + wnRight + padR;
  const height = L.sizeMode === 'total' ? Math.max(1, L.totalHeight) : y + padB;
  const weekNoX = wn.show ? (wn.side === 'left' ? gridX - wnBlock : gridX + gridW + Math.max(0, wn.gap)) : null;
  return { grid, rows, width, height, cellW, cellH, gapX, gapY, gridX, gridY, gridW, gridH, titleBaseline, headerY, headerH, weekNoX };
}

/** Linke/rechte Kante der Form auf Höhe y (bei schrägen Kästchen nicht senkrecht). */
type Edges = (y: number) => [number, number];

function alignX(h: string, l: number, r: number, padX: number, w: number): number {
  return h === 'l' ? l + padX : h === 'c' ? (l + r) / 2 - w / 2 : r - padX - w;
}

/** Position eines Texts (Breite w, Versalhöhe cap) an einem Ankerpunkt innerhalb von box. */
function anchorText(anchor: Anchor, box: Box, padX: number, padY: number, w: number, cap: number, edges?: Edges): { x: number; baseline: number } {
  const v = anchor[0];
  const baseline = v === 't' ? box.y + padY + cap : v === 'm' ? box.y + box.h / 2 + cap / 2 : box.y + box.h - padY;
  const [l, r] = edges ? edges(baseline - cap / 2) : [box.x, box.x + box.w];
  return { x: alignX(anchor[1], l, r, padX, w), baseline };
}

/** Position eines Kastens (w × h) an einem Ankerpunkt. */
function anchorBox(anchor: Anchor, box: Box, padX: number, padY: number, w: number, h: number, edges?: Edges): Box {
  const v = anchor[0];
  const y = v === 't' ? box.y + padY : v === 'm' ? box.y + box.h / 2 - h / 2 : box.y + box.h - padY - h;
  const [l, r] = edges ? edges(y + h / 2) : [box.x, box.x + box.w];
  return { x: alignX(anchor[1], l, r, padX, w), y, w, h };
}

interface DayStyle {
  /** Farbe oder Verweis auf den Verlauf (url(#…)) */
  fill: string | null;
  stroke: string | null;
  number: string;
  label: string;
  notes: string;
  badge: string;
  opacity: number;
  highlighted: boolean;
}

function baseFill(cell: CellConfig): string | null {
  if (!cell.fillEnabled) return null;
  return cell.fillMode === 'gradient' ? `url(#${GRADIENT_ID})` : safeColor(cell.fill);
}

function dayStyle(ctx: YearContext, day: CalDay, ann: DayAnnotations | undefined): DayStyle {
  const { dayNumber, weekday, holidays, highlight, layout } = ctx.cfg;
  const cell = ctx.cell;
  const s: DayStyle = {
    fill: baseFill(cell),
    stroke: cell.strokeEnabled ? cell.stroke : null,
    number: dayNumber.color,
    label: weekday.color,
    notes: holidays.color,
    badge: dayNumber.badgeColor,
    opacity: 1,
    highlighted: false,
  };
  const apply = (o: DayOverride, marks: boolean) => {
    if (!o.enabled) return;
    if (marks) s.highlighted = true;
    if (o.fillOn) s.fill = safeColor(o.fill);
    if (o.strokeOn) s.stroke = o.stroke;
    if (o.numberOn) s.number = o.number;
    if (o.labelOn) {
      s.label = o.label;
      s.notes = o.label;
    }
    if (o.badgeOn) s.badge = o.badge;
  };
  if (day.dow === 6) apply(highlight.saturday, true);
  if (day.dow === 0) apply(highlight.sunday, true);
  if (ann?.highlight) apply(highlight.holiday, true);
  if (!day.inMonth) {
    apply(highlight.overflow, false);
    s.opacity = Math.min(1, Math.max(0, layout.overflowOpacity / 100));
  }
  s.stroke = s.stroke ? safeColor(s.stroke) : null;
  s.number = safeColor(s.number);
  s.label = safeColor(s.label);
  s.notes = safeColor(s.notes);
  s.badge = safeColor(s.badge);
  return s;
}

function offsetBox(b: Box, dx: number, dy: number): Box {
  return { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
}

/** Form einer Zelle (Füllung, Rahmen) und ihr Schatten. Wird für Tageszellen und Kopfzeilen-Kästen genutzt. */
function drawShape(ctx: YearContext, sb: Box, fill: string | null, stroke: string | null, opacity: number): { shadow: string; body: string } {
  const cell = ctx.cell;
  if (cell.shape === 'none') return { shadow: '', body: '' };
  let body = '';
  let shadow = '';
  const sw = stroke && !ctx.gridMode ? Math.max(0, pt(cell.strokeWidth)) : 0;
  const allSides = cell.sideTop && cell.sideRight && cell.sideBottom && cell.sideLeft;
  const partial = cell.shape === 'rect' && !allSides;
  const outline = cellShapePath(cell, sb, sw > 0 && !partial ? sw / 2 : 0);
  const dash = sw > 0 ? dashAttrs(cell.strokeStyle, sw, cell.dashLength, cell.dashGap) : '';
  if (outline) {
    const fillAttr = fill ? `fill="${fill}"${opacityAttr('fill-opacity', cell.fillOpacity / 100)}` : 'fill="none"';
    const strokeAttr = sw > 0 && !partial ? ` stroke="${stroke}" stroke-width="${fmt(sw)}"${dash}` : '';
    if (fill || strokeAttr) body += `<path d="${outline}" ${fillAttr}${strokeAttr}/>`;
    if (sw > 0 && partial) {
      const h = sw / 2;
      let d = '';
      if (cell.sideTop) d += `M${fmt(sb.x)} ${fmt(sb.y + h)}H${fmt(sb.x + sb.w)}`;
      if (cell.sideBottom) d += `M${fmt(sb.x)} ${fmt(sb.y + sb.h - h)}H${fmt(sb.x + sb.w)}`;
      if (cell.sideLeft) d += `M${fmt(sb.x + h)} ${fmt(sb.y)}V${fmt(sb.y + sb.h)}`;
      if (cell.sideRight) d += `M${fmt(sb.x + sb.w - h)} ${fmt(sb.y)}V${fmt(sb.y + sb.h)}`;
      if (d) body += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${fmt(sw)}"${dash}/>`;
    }
  }
  if (cell.shadowEnabled) {
    const sp = cellShapePath(cell, offsetBox(sb, cell.shadowX, cell.shadowY), 0);
    if (sp) shadow = `<path d="${sp}" fill="${safeColor(cell.shadowColor)}"${opacityAttr('fill-opacity', (cell.shadowOpacity / 100) * opacity)}/>`;
  }
  return { shadow, body };
}

interface CellOutput {
  shadow: string;
  body: string;
}

function renderCell(ctx: YearContext, day: CalDay, cellBox: Box, mode: TextMode, defs: string[], index: number): CellOutput | null {
  const { cfg, cell } = ctx;
  const { dayNumber: dn, weekday: wd, holidays: hol, lines, layout, general } = cfg;
  const content = day.inMonth ? 'full' : layout.overflow === 'hidden' ? 'none' : layout.overflow === 'empty' ? 'shape' : 'full';
  if (content === 'none') return null;
  const ann = ctx.annotations.get(day.key);
  const style = dayStyle(ctx, day, ann);
  const sb = shapeBounds(cell, cellBox);
  const hasShape = cell.shape !== 'none';
  const edges = shapeEdges(cell, sb);
  const shear = cell.skewText ? skewTan(cell) : 0;
  // geneigter Text: um die halbe Versalhöhe zurückschieben, damit er mittig zur Kante sitzt
  const put = (run: TextRun, x: number, baseline: number, color: string) =>
    runToSvg(run, x - (shear * run.capHeight) / 2, baseline, color, mode, '', shear);
  const shape = drawShape(ctx, sb, style.fill, style.stroke, style.opacity);
  let body = shape.body;

  if (content === 'full') {
    // Notizlinien
    if (lines.show && lines.count > 0) {
      const top = sb.y + Math.max(0, lines.top);
      const bottom = sb.y + sb.h - Math.max(0, lines.bottom);
      const n = Math.max(1, Math.round(lines.count));
      const lw = Math.max(0.01, pt(lines.width));
      const inset = Math.max(0, lines.inset);
      if (sb.w - 2 * inset > 0 && bottom >= top) {
        let d = '';
        for (let i = 0; i < n; i++) {
          const ly = n === 1 ? top : top + ((bottom - top) * i) / (n - 1);
          const [l, r] = edges(ly);
          d += `M${fmt(l + inset)} ${fmt(ly)}H${fmt(r - inset)}`;
        }
        let linesSvg = `<path d="${d}" fill="none" stroke="${safeColor(lines.color)}" stroke-width="${fmt(lw)}"${dashAttrs(lines.style, lw, 1.2, 0.8)}/>`;
        const roundedRect = cell.shape === 'rect' && Math.max(...cornerRadii(cell)) > 0;
        if (hasShape && (cell.shape !== 'rect' || roundedRect)) {
          const clip = cellShapePath(cell, sb, 0);
          defs.push(`<clipPath id="clip${index}"><path d="${clip}"/></clipPath>`);
          linesSvg = `<g clip-path="url(#clip${index})">${linesSvg}</g>`;
        }
        body += linesSvg;
      }
    }

    // Tageszahl (optional mit Badge)
    if (dn.show) {
      const text = `${dn.prefix}${dn.leadingZero ? pad2(day.day) : String(day.day)}${dn.suffix}`;
      const run = layoutRun(text, ctx.fonts.day, pt(dn.size), dn.tracking);
      let x: number;
      let baseline: number;
      if (dn.badge !== 'none') {
        const size = Math.max(0.5, dn.badgeSize);
        const b = anchorBox(dn.anchor, sb, dn.padX, dn.padY, size, size, edges);
        if (dn.badgeScope === 'all' || style.highlighted) {
          const bp =
            dn.badge === 'circle'
              ? ellipsePath(b.x + size / 2, b.y + size / 2, size / 2, size / 2)
              : rectPath(b, [dn.badgeRadius, dn.badgeRadius, dn.badgeRadius, dn.badgeRadius], 'round');
          body += `<path d="${bp}" fill="${style.badge}"/>`;
        }
        x = b.x + size / 2 - run.width / 2;
        baseline = b.y + size / 2 + run.capHeight / 2;
      } else {
        ({ x, baseline } = anchorText(dn.anchor, sb, dn.padX, dn.padY, run.width, run.capHeight, edges));
      }
      body += put(run, x, baseline, style.number);
    }

    // Wochentag in der Zelle
    if (wd.show) {
      const text = applyCase(weekdayName(general, day.dow, wd.format), wd.textCase, general.locale);
      const run = layoutRun(text, ctx.fonts.weekday, pt(wd.size), wd.tracking);
      const pos = anchorText(wd.anchor, sb, wd.padX, wd.padY, run.width, run.capHeight, edges);
      body += put(run, pos.x, pos.baseline, style.label);
    }

    // Feiertage & eigene Einträge
    if (hol.showNames && day.inMonth && ann?.names.length) {
      const names = ann.names.map((n) => applyCase(n, hol.textCase, general.locale));
      const maxW = Math.max(2, sb.w - 2 * Math.max(0, hol.padX));
      const runs = wrapNames(names, ctx.fonts.notes, pt(hol.size), hol.tracking, maxW, hol.maxLines);
      if (runs.length) {
        const lh = runs[0].size * (Math.max(50, hol.lineHeight) / 100);
        const cap = runs[0].capHeight;
        const v = hol.anchor[0];
        let first: number;
        if (v === 't') first = sb.y + hol.padY + cap;
        else if (v === 'm') first = sb.y + sb.h / 2 - ((runs.length - 1) * lh) / 2 + cap / 2;
        else first = sb.y + sb.h - hol.padY - (runs.length - 1) * lh;
        runs.forEach((run, i) => {
          const base = first + i * lh;
          const [l, r] = edges(base - run.capHeight / 2);
          body += put(run, alignX(hol.anchor[1], l, r, hol.padX, run.width), base, style.notes);
        });
      }
    }
  }

  if (!body && !shape.shadow) return null;
  const op = opacityAttr('opacity', style.opacity);
  return {
    shadow: shape.shadow,
    body: body ? `<g id="tag-${day.key}"${op}>${body}</g>` : '',
  };
}

function luminance(hex: string): number {
  const c = safeColor(hex).slice(1);
  const full = c.length <= 4 ? c.slice(0, 3).replace(/./g, (x) => x + x) : c.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Akzentfarbe eines Wochenendtags für die Kopfzeile: die dunklere der überschriebenen
 * Farben (Zahl bzw. Füllung) – eine weiße Zahl auf roter Zelle ergibt also Rot.
 */
function weekendAccent(o: DayOverride): string | null {
  if (!o.enabled) return null;
  const candidates = [o.numberOn ? o.number : null, o.fillOn ? o.fill : null].filter((c): c is string => !!c);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));
}

function renderHeader(ctx: YearContext, g: MonthGeometry, mode: TextMode): { shadow: string; body: string } {
  const { header: hd, general, highlight } = ctx.cfg;
  if (!hd.show || g.headerY === null) return { shadow: '', body: '' };
  const y = g.headerY;
  const h = g.headerH;
  let out = '';
  let shadows = '';
  const r = Math.max(0, hd.bgRadius);
  if (hd.background === 'bar') {
    out += `<path d="${rectPath({ x: g.gridX, y, w: g.gridW, h }, [r, r, r, r], 'round')}" fill="${safeColor(hd.bgColor)}"/>`;
  }
  const cellStyle = hd.background === 'cell';
  const labels = g.grid.columns.map((dow) => applyCase(weekdayName(general, dow, hd.format), hd.textCase, general.locale));
  let size = pt(hd.size);
  if (hd.autoFit) {
    const sample = cellStyle ? shapeBounds(ctx.cell, { x: 0, y: 0, w: g.cellW, h }) : { w: g.cellW };
    const avail = sample.w - 2 * Math.max(0, hd.padX);
    const widest = Math.max(...labels.map((t) => layoutRun(t, ctx.fonts.header, size, hd.tracking).width));
    if (avail > 0 && widest > avail) size *= Math.max(0.4, avail / widest);
  }
  const shear = cellStyle && ctx.cell.skewText ? skewTan(ctx.cell) : 0;
  g.grid.columns.forEach((dow, c) => {
    const x0 = g.gridX + c * (g.cellW + g.gapX);
    let box: Box = { x: x0, y, w: g.cellW, h };
    if (hd.background === 'cells') {
      out += `<path d="${rectPath(box, [r, r, r, r], 'round')}" fill="${safeColor(hd.bgColor)}"/>`;
    } else if (hd.background === 'cell') {
      box = shapeBounds(ctx.cell, box);
      const shape = drawShape(ctx, box, baseFill(ctx.cell), ctx.cell.strokeEnabled ? safeColor(ctx.cell.stroke) : null, 1);
      out += shape.body;
      shadows += shape.shadow;
    }
    const run = layoutRun(labels[c], ctx.fonts.header, size, hd.tracking);
    let color = hd.color;
    if (hd.weekendColors) {
      const accent = dow === 6 ? weekendAccent(highlight.saturday) : dow === 0 ? weekendAccent(highlight.sunday) : null;
      if (accent) color = accent;
    }
    const baseline = box.y + box.h / 2 + run.capHeight / 2;
    const [edgeL, edgeR] = cellStyle ? shapeEdges(ctx.cell, box)(box.y + box.h / 2) : [box.x, box.x + box.w];
    const x = alignX(hd.align === 'left' ? 'l' : hd.align === 'center' ? 'c' : 'r', edgeL, edgeR, hd.padX, run.width);
    out += runToSvg(run, x - (shear * run.capHeight) / 2, baseline, safeColor(color), mode, '', shear);
  });
  return { shadow: shadows, body: `<g id="kopfzeile">${out}</g>` };
}

function renderTitle(ctx: YearContext, g: MonthGeometry, month: number, mode: TextMode): string {
  const t = ctx.cfg.title;
  if (!t.show || g.titleBaseline === null) return '';
  const runs = titleRuns(ctx, month);
  const base = g.titleBaseline;
  let x = t.align === 'left' ? g.gridX + t.offsetX : t.align === 'center' ? g.gridX + g.gridW / 2 - runs.width / 2 + t.offsetX : g.gridX + g.gridW - runs.width - t.offsetX;
  let out = runToSvg(runs.month, x, base, safeColor(t.color), mode);
  x += runs.month.width + runs.month.tracking;
  if (runs.sep) {
    out += runToSvg(runs.sep, x, base, safeColor(t.color), mode);
    x += runs.sep.width + runs.month.tracking;
  }
  if (runs.year) out += runToSvg(runs.year, x, base, safeColor(t.yearColor), mode);
  return `<g id="titel">${out}</g>`;
}

function renderWeekNumbers(ctx: YearContext, g: MonthGeometry, visibleRows: boolean[], mode: TextMode): string {
  const wn = ctx.cfg.weekNumbers;
  if (!wn.show || g.weekNoX === null) return '';
  const dn = ctx.cfg.dayNumber;
  let out = '';
  g.grid.rows.forEach((row, r) => {
    if (!visibleRows[r]) return;
    const run = layoutRun(`${wn.prefix}${weekNumberOfRow(row)}`, ctx.fonts.weekNo, pt(wn.size), wn.tracking);
    const rowY = g.gridY + r * (g.cellH + g.gapY);
    const pad = Math.min(dn.padY, g.cellH / 2);
    const baseline =
      wn.valign === 'top' ? rowY + pad + run.capHeight : wn.valign === 'middle' ? rowY + g.cellH / 2 + run.capHeight / 2 : rowY + g.cellH - pad;
    const x = g.weekNoX! + Math.max(0, wn.width) / 2 - run.width / 2;
    out += runToSvg(run, x, baseline, safeColor(wn.color), mode);
  });
  return `<g id="kalenderwochen">${out}</g>`;
}

/**
 * Gemeinsames Tabellenraster: jede Kante nur einmal zeichnen, gerade Stücke zusammenfassen.
 * rowYs: y-Koordinaten der Zeilengrenzen (Länge = Zeilen + 1).
 */
function gridLinePaths(ctx: YearContext, g: MonthGeometry, rowYs: number[], visible: boolean[][]): string[] {
  const cell = ctx.cell;
  const rows = rowYs.length - 1;
  const colX = (c: number) => g.gridX + c * g.cellW;
  const isVis = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < 7 && visible[r][c];
  const segs: string[] = [];
  const merge = (runs: [number, number][]) => {
    runs.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const s of runs) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push([...s]);
    }
    return merged;
  };
  for (let rb = 0; rb <= rows; rb++) {
    const runs: [number, number][] = [];
    for (let c = 0; c < 7; c++) {
      const above = isVis(rb - 1, c);
      const below = isVis(rb, c);
      if (!above && !below) continue;
      if (above && below ? cell.gridInnerH : cell.gridOuter) runs.push([c, c + 1]);
    }
    for (const [a, b] of merge(runs)) segs.push(`M${fmt(colX(a))} ${fmt(rowYs[rb])}H${fmt(colX(b))}`);
  }
  for (let cb = 0; cb <= 7; cb++) {
    const runs: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      const left = isVis(r, cb - 1);
      const right = isVis(r, cb);
      if (!left && !right) continue;
      if (left && right ? cell.gridInnerV : cell.gridOuter) runs.push([r, r + 1]);
    }
    for (const [a, b] of merge(runs)) segs.push(`M${fmt(colX(cb))} ${fmt(rowYs[a])}V${fmt(rowYs[b])}`);
  }
  return segs;
}

function renderGridLines(ctx: YearContext, g: MonthGeometry, visible: boolean[][]): string {
  const cell = ctx.cell;
  if (!ctx.gridMode || !cell.strokeEnabled) return '';
  const sw = Math.max(0.01, pt(cell.strokeWidth));
  const rowYs = Array.from({ length: g.rows + 1 }, (_, r) => g.gridY + r * g.cellH);
  const segs = gridLinePaths(ctx, g, rowYs, visible);
  // Kopfzeile im Zellstil bekommt ebenfalls Tabellenlinien
  const hd = ctx.cfg.header;
  if (hd.show && hd.background === 'cell' && g.headerY !== null) {
    segs.push(...gridLinePaths(ctx, g, [g.headerY, g.headerY + g.headerH], [Array(7).fill(true)]));
  }
  if (!segs.length) return '';
  const caps = cell.strokeStyle === 'solid' && cell.gridOuter ? ' stroke-linecap="square"' : '';
  return `<g id="raster"><path d="${segs.join('')}" fill="none" stroke="${safeColor(cell.stroke)}" stroke-width="${fmt(sw)}"${caps}${dashAttrs(cell.strokeStyle, sw, cell.dashLength, cell.dashGap)}/></g>`;
}

function gradientDef(cell: CellConfig): string {
  const dir = { vertical: [0, 0, 0, 1], horizontal: [0, 0, 1, 0], diagonal: [0, 0, 1, 1] }[cell.gradientDir] ?? [0, 0, 0, 1];
  return (
    `<linearGradient id="${GRADIENT_ID}" x1="${dir[0]}" y1="${dir[1]}" x2="${dir[2]}" y2="${dir[3]}">` +
    `<stop offset="0" stop-color="${safeColor(cell.fill)}"/><stop offset="1" stop-color="${safeColor(cell.fill2)}"/></linearGradient>`
  );
}

export function renderMonth(ctx: YearContext, month: number, opts: RenderOptions = { textMode: 'path' }): RenderedMonth {
  const { cfg } = ctx;
  const g = computeGeometry(ctx, month);
  const mode = opts.textMode;
  const defs: string[] = [];
  const cellsSvg: string[] = [];
  const shadows: string[] = [];
  const visible: boolean[][] = [];
  const hidden = cfg.layout.overflow === 'hidden';
  if (ctx.cell.fillEnabled && ctx.cell.fillMode === 'gradient') defs.push(gradientDef(ctx.cell));

  g.grid.rows.forEach((row, r) => {
    visible[r] = [];
    row.forEach((day, c) => {
      visible[r][c] = day.inMonth || !hidden;
      const box: Box = { x: g.gridX + c * (g.cellW + g.gapX), y: g.gridY + r * (g.cellH + g.gapY), w: g.cellW, h: g.cellH };
      const out = renderCell(ctx, day, box, mode, defs, r * 7 + c);
      if (!out) return;
      if (out.shadow) shadows.push(out.shadow);
      if (out.body) cellsSvg.push(out.body);
    });
  });
  const visibleRows = visible.map((row) => row.some(Boolean));
  const header = renderHeader(ctx, g, mode);
  if (header.shadow) shadows.unshift(header.shadow);

  const W = fmt(g.width);
  const H = fmt(g.height);
  const sizeAttrs = opts.pixelSize ? `width="${opts.pixelSize.width}" height="${opts.pixelSize.height}"` : `width="${W}mm" height="${H}mm"`;
  const label = `${applyCase(monthName(cfg.general, month, 'long'), 'auto', cfg.general.locale)} ${cfg.general.year}`;

  let shadowLayer = '';
  if (shadows.length) {
    const blur = Math.max(0, ctx.cell.shadowBlur);
    if (blur > 0) {
      defs.push(
        `<filter id="schatten-blur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${fmt(blur / 2)}"/></filter>`,
      );
    }
    shadowLayer = `<g id="schatten"${blur > 0 ? ' filter="url(#schatten-blur)"' : ''}>${shadows.join('')}</g>`;
  }

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs} viewBox="0 0 ${W} ${H}">`,
    `<title>${escapeXml(label)}</title>`,
    defs.length ? `<defs>${defs.join('')}</defs>` : '',
    cfg.output.background === 'color' ? `<rect id="hintergrund" width="${W}" height="${H}" fill="${safeColor(cfg.output.backgroundColor, '#ffffff')}"/>` : '',
    renderTitle(ctx, g, month, mode),
    renderWeekNumbers(ctx, g, visibleRows, mode),
    shadowLayer,
    header.body,
    `<g id="zellen">${cellsSvg.join('')}</g>`,
    renderGridLines(ctx, g, visible),
    '</svg>',
  ];
  return { month, svg: parts.join(''), width: g.width, height: g.height, geometry: g };
}
