// Vite-Plugin: stellt die auf diesem Rechner installierten Schriften (und den Projektordner
// „lokale-schriften/“) der App zur Verfügung – im Dev-Server und in `vite preview`.
//
//   GET /__local-fonts/list[?refresh=1]  → Liste aller Schnitte (Familie, Stil, Gewicht …)
//   GET /__local-fonts/font/<id>         → Schriftdatei (bei Collections nur der eine Schnitt)
//
// Antwortet nur auf Anfragen vom eigenen Rechner (localhost).

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { extname, join, basename } from 'node:path';
import { inflateSync } from 'node:zlib';

export interface LocalFontFace {
  id: string;
  family: string;
  style: string;
  fullName: string;
  postscript: string;
  weight: number;
  italic: boolean;
  variable: boolean;
  file: string;
  source: 'system' | 'project';
}

interface FaceRecord extends LocalFontFace {
  path: string;
  /** Index in einer TrueType-Collection, sonst -1 */
  index: number;
  format: 'sfnt' | 'ttc' | 'woff';
}

const EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc', '.woff']);
const SKIP_FAMILIES = /^(\.|LastResort$|Apple Color Emoji$)/;

function fontDirectories(projectDir: string): { dir: string; source: 'system' | 'project' }[] {
  const home = homedir();
  const system: string[] = [];
  switch (platform()) {
    case 'darwin':
      system.push(join(home, 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts', '/Network/Library/Fonts');
      break;
    case 'win32': {
      system.push(join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts'));
      if (process.env.LOCALAPPDATA) system.push(join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
      break;
    }
    default:
      system.push(join(home, '.fonts'), join(home, '.local/share/fonts'), '/usr/share/fonts', '/usr/local/share/fonts');
  }
  return [{ dir: join(projectDir, 'lokale-schriften'), source: 'project' }, ...system.map((dir) => ({ dir, source: 'system' as const }))];
}

async function walk(dir: string, depth: number, out: string[], seen: Set<string>): Promise<void> {
  if (depth < 0) return;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, depth - 1, out, seen);
    else if (EXTENSIONS.has(extname(e.name).toLowerCase())) {
      let real = full;
      try {
        real = await fs.realpath(full);
      } catch {
        /* egal */
      }
      if (!seen.has(real)) {
        seen.add(real);
        out.push(full);
      }
    }
  }
}

async function readAt(fh: FileHandle, position: number, length: number): Promise<Buffer> {
  const buf = Buffer.alloc(Math.max(0, length));
  const { bytesRead } = await fh.read(buf, 0, buf.length, position);
  return buf.subarray(0, bytesRead);
}

interface TableRecord {
  offset: number;
  length: number;
  compLength: number;
}

async function readTableDirectory(fh: FileHandle, offset: number, woff: boolean): Promise<Map<string, TableRecord>> {
  const tables = new Map<string, TableRecord>();
  if (woff) {
    const head = await readAt(fh, 0, 44);
    const numTables = head.readUInt16BE(12);
    const dir = await readAt(fh, 44, numTables * 20);
    for (let i = 0; i < numTables; i++) {
      const r = i * 20;
      tables.set(dir.toString('latin1', r, r + 4), {
        offset: dir.readUInt32BE(r + 4),
        compLength: dir.readUInt32BE(r + 8),
        length: dir.readUInt32BE(r + 12),
      });
    }
  } else {
    const head = await readAt(fh, offset, 12);
    const numTables = head.readUInt16BE(4);
    const dir = await readAt(fh, offset + 12, numTables * 16);
    for (let i = 0; i < numTables; i++) {
      const r = i * 16;
      const length = dir.readUInt32BE(r + 12);
      tables.set(dir.toString('latin1', r, r + 4), { offset: dir.readUInt32BE(r + 8), length, compLength: length });
    }
  }
  return tables;
}

async function readTable(fh: FileHandle, rec: TableRecord | undefined, woff: boolean): Promise<Buffer | null> {
  if (!rec) return null;
  const raw = await readAt(fh, rec.offset, woff ? rec.compLength : rec.length);
  if (woff && rec.compLength < rec.length) return inflateSync(raw);
  return raw;
}

function utf16be(bytes: Buffer): string {
  const copy = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2)));
  copy.swap16();
  return copy.toString('utf16le');
}

/** Liest die wichtigsten Einträge der name-Tabelle (bevorzugt englische Windows-Namen). */
function parseNames(buf: Buffer): Record<number, string> {
  const result: Record<number, string> = {};
  if (buf.length < 6) return result;
  const count = buf.readUInt16BE(2);
  const stringOffset = buf.readUInt16BE(4);
  const score: Record<number, number> = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (r + 12 > buf.length) break;
    const pid = buf.readUInt16BE(r);
    const eid = buf.readUInt16BE(r + 2);
    const lid = buf.readUInt16BE(r + 4);
    const nid = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const off = buf.readUInt16BE(r + 10);
    if (![1, 2, 4, 6, 16, 17].includes(nid)) continue;
    const start = stringOffset + off;
    if (start + len > buf.length) continue;
    const bytes = buf.subarray(start, start + len);
    let value: string;
    let s: number;
    if (pid === 3 && (eid === 1 || eid === 10)) {
      value = utf16be(bytes);
      s = lid === 0x409 ? 4 : 3;
    } else if (pid === 0) {
      value = utf16be(bytes);
      s = 2;
    } else if (pid === 1 && eid === 0) {
      value = bytes.toString('latin1');
      s = lid === 0 ? 1.5 : 1;
    } else continue;
    if (value && (score[nid] === undefined || s > score[nid])) {
      score[nid] = s;
      result[nid] = value.replace(/\0/g, '').trim();
    }
  }
  return result;
}

function guessWeight(style: string): number {
  const s = style.toLowerCase().replace(/[\s_-]/g, '');
  if (/hairline|thin/.test(s)) return 100;
  if (/extralight|ultralight/.test(s)) return 200;
  if (/semibold|demibold|demi/.test(s)) return 600;
  if (/extrabold|ultrabold/.test(s)) return 800;
  if (/black|heavy/.test(s)) return 900;
  if (/light/.test(s)) return 300;
  if (/medium/.test(s)) return 500;
  if (/bold/.test(s)) return 700;
  return 400;
}

async function readFaces(path: string, source: 'system' | 'project', nextId: () => string): Promise<FaceRecord[]> {
  const fh = await fs.open(path, 'r');
  try {
    const head = await readAt(fh, 0, 12);
    if (head.length < 12) return [];
    const tag = head.toString('latin1', 0, 4);
    if (tag === 'wOF2') return []; // WOFF2 kann die App nicht lesen
    const woff = tag === 'wOFF';
    let offsets = [0];
    let format: FaceRecord['format'] = woff ? 'woff' : 'sfnt';
    if (tag === 'ttcf') {
      format = 'ttc';
      const n = head.readUInt32BE(8);
      const list = await readAt(fh, 12, n * 4);
      offsets = Array.from({ length: n }, (_, i) => list.readUInt32BE(i * 4));
    } else if (!woff && head.readUInt32BE(0) !== 0x00010000 && tag !== 'OTTO' && tag !== 'true') {
      return [];
    }
    const faces: FaceRecord[] = [];
    for (let index = 0; index < offsets.length; index++) {
      const tables = await readTableDirectory(fh, offsets[index], woff);
      if (!tables.has('cmap') || (!tables.has('glyf') && !tables.has('CFF ') && !tables.has('CFF2'))) continue;
      const nameBuf = await readTable(fh, tables.get('name'), woff);
      if (!nameBuf) continue;
      const names = parseNames(nameBuf);
      const family = names[16] || names[1];
      if (!family || SKIP_FAMILIES.test(family)) continue;
      const style = names[17] || names[2] || 'Regular';
      const os2 = await readTable(fh, tables.get('OS/2'), woff);
      const weight = os2 && os2.length >= 6 ? os2.readUInt16BE(4) || guessWeight(style) : guessWeight(style);
      const fsSelection = os2 && os2.length >= 64 ? os2.readUInt16BE(62) : 0;
      faces.push({
        id: nextId(),
        family,
        style,
        fullName: names[4] || `${family} ${style}`,
        postscript: names[6] || '',
        weight: Math.min(1000, Math.max(1, weight)),
        italic: (fsSelection & 1) === 1 || /italic|oblique|kursiv/i.test(style),
        variable: tables.has('fvar'),
        file: basename(path),
        source,
        path,
        index: format === 'ttc' ? index : -1,
        format,
      });
    }
    return faces;
  } finally {
    await fh.close();
  }
}

/** Einen einzelnen Schnitt aus einer TrueType-Collection als eigenständige Datei zusammensetzen. */
async function extractFromCollection(path: string, index: number): Promise<Buffer> {
  const fh = await fs.open(path, 'r');
  try {
    const head = await readAt(fh, 0, 12 + (index + 1) * 4);
    const dirOffset = head.readUInt32BE(12 + index * 4);
    const offsetTable = await readAt(fh, dirOffset, 12);
    const numTables = offsetTable.readUInt16BE(4);
    const dir = await readAt(fh, dirOffset + 12, numTables * 16);
    const records = Array.from({ length: numTables }, (_, i) => ({
      tag: dir.readUInt32BE(i * 16),
      checksum: dir.readUInt32BE(i * 16 + 4),
      offset: dir.readUInt32BE(i * 16 + 8),
      length: dir.readUInt32BE(i * 16 + 12),
    }));
    const headerSize = 12 + numTables * 16;
    const total = records.reduce((n, r) => n + ((r.length + 3) & ~3), headerSize);
    const out = Buffer.alloc(total);
    offsetTable.copy(out, 0);
    let cursor = headerSize;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const p = 12 + i * 16;
      out.writeUInt32BE(r.tag, p);
      out.writeUInt32BE(r.checksum, p + 4);
      out.writeUInt32BE(cursor, p + 8);
      out.writeUInt32BE(r.length, p + 12);
      (await readAt(fh, r.offset, r.length)).copy(out, cursor);
      cursor += (r.length + 3) & ~3;
    }
    return out;
  } finally {
    await fh.close();
  }
}

function isLocalRequest(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

export function localFonts(projectDir: string): Plugin {
  let cache: Promise<FaceRecord[]> | null = null;

  const scan = async (): Promise<FaceRecord[]> => {
    const seen = new Set<string>();
    let counter = 0;
    const nextId = () => `f${(counter++).toString(36)}`;
    const all: FaceRecord[] = [];
    for (const { dir, source } of fontDirectories(projectDir)) {
      const files: string[] = [];
      await walk(dir, 5, files, seen);
      for (const file of files) {
        try {
          all.push(...(await readFaces(file, source, nextId)));
        } catch {
          /* unlesbare Datei überspringen */
        }
      }
    }
    return all;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/__local-fonts/')) return next();
    if (!isLocalRequest(req)) {
      res.statusCode = 403;
      res.end('Nur lokal verfügbar');
      return;
    }
    try {
      if (url.pathname === '/__local-fonts/list') {
        if (!cache || url.searchParams.has('refresh')) cache = scan();
        const faces = await cache;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ fonts: faces.map(({ path: _p, index: _i, format: _f, ...pub }) => pub) }));
        return;
      }
      const m = url.pathname.match(/^\/__local-fonts\/font\/([a-z0-9]+)$/);
      if (m) {
        const faces = await (cache ?? (cache = scan()));
        const face = faces.find((f) => f.id === m[1]);
        if (!face) {
          res.statusCode = 404;
          res.end('Unbekannte Schrift');
          return;
        }
        const data = face.format === 'ttc' ? await extractFromCollection(face.path, face.index) : await fs.readFile(face.path);
        res.setHeader('Content-Type', face.format === 'woff' ? 'font/woff' : 'font/sfnt');
        res.setHeader('Cache-Control', 'no-store');
        res.end(data);
        return;
      }
      res.statusCode = 404;
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  };

  return {
    name: 'calcell-local-fonts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next));
    },
  };
}
