import { zipSync } from 'fflate';
import type { Config } from '../config/types';
import { pad2 } from '../calendar/dates';
import { applyCase, monthName } from '../calendar/locale';
import { computeGeometry, renderMonth, type YearContext } from '../render/month';
import { pixelSize, rasterizeSvg } from './png';
import { t } from '../i18n';
import { BRAND } from '../brand';

export interface ExportFile {
  name: string;
  data: Uint8Array;
  mime: string;
}

export type ExportFormat = 'png' | 'svg' | 'both';

export interface ExportProgress {
  done: number;
  total: number;
  label: string;
}

const encoder = new TextEncoder();

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
}

/** Dateiname aus Muster, z. B. „{jahr}-{mm}_{monat}“ → „2027-01_Januar“. */
export function fileBaseName(cfg: Config, month: number): string {
  const long = applyCase(monthName(cfg.general, month, 'long'), 'auto', cfg.general.locale);
  const short = applyCase(monthName(cfg.general, month, 'short'), 'auto', cfg.general.locale).replace(/\.$/, '');
  const tokens: Record<string, string> = {
    jahr: String(cfg.general.year),
    year: String(cfg.general.year),
    mm: pad2(month + 1),
    m: String(month + 1),
    monat: long,
    month: long,
    MONAT: long.toLocaleUpperCase(cfg.general.locale),
    MONTH: long.toLocaleUpperCase(cfg.general.locale),
    kurz: short,
    short,
  };
  let usesMonth = false;
  const raw = (cfg.output.fileName || '{jahr}-{mm}_{monat}').replace(/\{(\w+)\}/g, (all, key: string) => {
    if (!(key in tokens)) return all;
    if (key !== 'jahr' && key !== 'year') usesMonth = true;
    return tokens[key];
  });
  let name = sanitizeFileName(raw) || `${cfg.general.year}-${pad2(month + 1)}`;
  if (!usesMonth) name += `-${pad2(month + 1)}`; // sonst hätten alle Dateien denselben Namen
  return name;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Erzeugt die Dateien für die gewählten Monate. */
export async function buildExportFiles(
  ctx: YearContext,
  months: number[],
  format: ExportFormat,
  dpi: number,
  textAsPaths: boolean,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportFile[]> {
  const cfg = ctx.cfg;
  const files: ExportFile[] = [];
  const perMonth = format === 'both' ? 2 : 1;
  const total = months.length * perMonth;
  let done = 0;
  for (const m of months) {
    const base = fileBaseName(cfg, m);
    const label = applyCase(monthName(cfg.general, m, 'long'), 'auto', cfg.general.locale);
    if (format === 'svg' || format === 'both') {
      onProgress?.({ done, total, label: `${label} (SVG)` });
      const r = renderMonth(ctx, m, { textMode: textAsPaths ? 'path' : 'text' });
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${label} ${cfg.general.year} · ${r.width.toFixed(2)} × ${r.height.toFixed(2)} mm · ${BRAND} -->\n${r.svg}\n`;
      files.push({ name: `${base}.svg`, data: encoder.encode(svg), mime: 'image/svg+xml' });
      done += 1;
      await nextFrame();
    }
    if (format === 'png' || format === 'both') {
      onProgress?.({ done, total, label: `${label} (PNG)` });
      const geo = computeGeometry(ctx, m);
      const px = pixelSize(geo.width, geo.height, dpi);
      const r = renderMonth(ctx, m, { textMode: 'path', pixelSize: px });
      const data = await rasterizeSvg(r.svg, px.width, px.height, dpi);
      files.push({ name: `${base}.png`, data, mime: 'image/png' });
      done += 1;
      await nextFrame();
    }
  }
  onProgress?.({ done: total, total, label: t('Fertig') });
  return files;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function toBlob(file: ExportFile): Blob {
  return new Blob([file.data as BlobPart], { type: file.mime });
}

export function zipFiles(files: ExportFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const f of files) entries[f.name] = [f.data, { level: f.mime === 'image/png' ? 0 : 6 }];
  return zipSync(entries);
}

export function saveAsZip(files: ExportFile[], zipName: string): void {
  downloadBlob(new Blob([zipFiles(files) as BlobPart], { type: 'application/zip' }), zipName);
}

interface DirectoryHandle {
  name: string;
  getFileHandle(name: string, options: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string; startIn?: string }) => Promise<DirectoryHandle>;
  }
}

export function canSaveToFolder(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/** Ordner wählen lassen (muss direkt durch einen Klick ausgelöst werden). */
export async function pickFolder(): Promise<DirectoryHandle> {
  return window.showDirectoryPicker!({ mode: 'readwrite', id: 'calcell-export', startIn: 'downloads' });
}

export async function saveToFolder(dir: DirectoryHandle, files: ExportFile[]): Promise<void> {
  for (const f of files) {
    const handle = await dir.getFileHandle(f.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(toBlob(f));
    await writable.close();
  }
}

export async function saveIndividually(files: ExportFile[]): Promise<void> {
  for (const f of files) {
    downloadBlob(toBlob(f), f.name);
    await new Promise((r) => setTimeout(r, 350));
  }
}
