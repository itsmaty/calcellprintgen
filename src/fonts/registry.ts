import { parse, type Font as OtFont } from 'opentype.js';
import catalogJson from './catalog.json';
import type { FontRef } from '../config/types';
import { createCssFont, createLoadedFont, type LoadedFont } from './loaded';
import { detectFormat, splitCollection } from './sfnt';
import { deleteStoredFont, listStoredFonts, putStoredFont } from './storage';

export type FontSource = 'bundled' | 'upload' | 'system' | 'local' | 'css';
export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono' | 'other';

export interface FaceInfo {
  key: string;
  label: string;
  weight: number;
  italic: boolean;
}

export interface FamilyInfo {
  id: string;
  name: string;
  source: FontSource;
  category: FontCategory;
  faces: FaceInfo[];
}

interface FaceEntry extends FaceInfo {
  load: () => Promise<LoadedFont>;
  /** ID beim lokalen Schriften-Server (nur source 'local') */
  serverId?: string;
}

interface FamilyEntry {
  id: string;
  name: string;
  source: FontSource;
  category: FontCategory;
  faces: FaceEntry[];
  /** Upload-Datei-IDs (zum Entfernen) */
  fileIds?: string[];
  /** CSS-Familie, unter der eine Vorschau-Schrift für die Oberfläche registriert ist */
  previewFamily?: string;
  previewRequested?: boolean;
}

/** Eintrag aus /__local-fonts/list (siehe server/localFonts.ts) */
interface LocalServerFace {
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

interface CatalogEntry {
  id: string;
  family: string;
  category: FontCategory;
  variants: { weight: number; style: 'normal' | 'italic'; file: string }[];
}

interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
}

declare global {
  interface Window {
    queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<LocalFontData[]>;
  }
}

const catalog = catalogJson as CatalogEntry[];
const fontUrls = import.meta.glob('../assets/fonts/*/*.woff', { query: '?url', import: 'default', eager: true }) as Record<
  string,
  string
>;

export const DEFAULT_FAMILY = 'inter';

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: 'Serifenlos',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handschrift',
  mono: 'Monospace',
  other: 'Weitere',
};

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

export function weightLabel(weight: number, italic: boolean): string {
  const name = WEIGHT_NAMES[Math.round(weight / 100) * 100] ?? '';
  return `${weight} ${name}${italic ? ' Kursiv' : ''}`.trim();
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

function guessItalic(style: string): boolean {
  return /italic|oblique|kursiv/i.test(style);
}

function nameOf(ot: OtFont, key: string): string | undefined {
  for (const platform of ['windows', 'macintosh', 'unicode']) {
    const entry = ot.names?.[platform]?.[key];
    if (entry) return entry.en ?? Object.values(entry)[0];
  }
  return undefined;
}

function faceKeyOf(weight: number, italic: boolean): string {
  return `${weight}${italic ? 'i' : ''}`;
}

/** Gewicht aus einem Face-Key wie „700i“ ablesen (für Ersatzschriften). */
function parseFaceKey(key: string): { weight: number; italic: boolean } {
  const m = key.match(/^(\d{3})(i?)$/);
  if (m) return { weight: Number(m[1]), italic: m[2] === 'i' };
  return { weight: guessWeight(key), italic: guessItalic(key) };
}

function closestFace<T extends FaceInfo>(faces: T[], weight: number, italic: boolean): T {
  let best = faces[0];
  let bestScore = Infinity;
  for (const f of faces) {
    const score = Math.abs(f.weight - weight) + (f.italic === italic ? 0 : 1000);
    if (score < bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

/** Wartet höchstens ms Millisekunden – danach undefined. */
function withTimeout<T>(promise: Promise<T> | undefined, ms: number): Promise<T | undefined> {
  if (!promise) return Promise.resolve(undefined);
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

let uid = 0;
function newId(): string {
  uid += 1;
  return `${Date.now().toString(36)}${uid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface ResolvedFace {
  familyId: string;
  faceKey: string;
  /** false, wenn eine Ersatzschrift verwendet wird */
  exact: boolean;
}

class FontRegistry {
  private families = new Map<string, FamilyEntry>();
  private loaded = new Map<string, LoadedFont>();
  private loading = new Map<string, Promise<LoadedFont>>();
  private listeners = new Set<() => void>();
  private initPromise: Promise<void> | null = null;
  version = 0;
  systemFontsLoaded = false;
  /** true, wenn der lokale Dev-/Preview-Server die installierten Schriften liefert */
  localServerAvailable = false;

  constructor() {
    for (const entry of catalog) {
      const family: FamilyEntry = {
        id: entry.id,
        name: entry.family,
        source: 'bundled',
        category: entry.category,
        faces: [],
        previewFamily: `cc-${entry.id}`,
      };
      for (const v of entry.variants) {
        const italic = v.style === 'italic';
        const key = faceKeyOf(v.weight, italic);
        family.faces.push({
          key,
          label: weightLabel(v.weight, italic),
          weight: v.weight,
          italic,
          load: async () => {
            const url = fontUrls[`../assets/fonts/${v.file}`];
            if (!url) throw new Error(`Schriftdatei fehlt: ${v.file}`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Schrift konnte nicht geladen werden: ${v.file}`);
            const buffer = await res.arrayBuffer();
            this.registerPreview(family.previewFamily!, buffer, v.weight, italic);
            return createLoadedFont({
              familyId: entry.id,
              faceKey: key,
              name: entry.family,
              cssFamily: entry.family,
              weight: v.weight,
              italic,
              ot: parse(buffer),
            });
          },
        });
      }
      this.families.set(entry.id, family);
    }
  }

  /** Lädt gespeicherte Uploads und – falls bereits erlaubt – die Systemschriften. */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const stored = await listStoredFonts();
        for (const file of stored.sort((a, b) => a.addedAt - b.addedAt)) {
          try {
            this.ingest(file.id, file.fileName, file.data);
          } catch (err) {
            console.warn('Gespeicherte Schrift konnte nicht gelesen werden', file.fileName, err);
          }
        }
        await withTimeout(this.loadLocalServerFonts(), 10000).catch(() => undefined);
        if (!this.localServerAvailable) {
          try {
            const status = await withTimeout(navigator.permissions?.query({ name: 'local-fonts' as PermissionName }), 1500);
            if (status?.state === 'granted') await withTimeout(this.loadSystemFonts(), 5000);
          } catch {
            /* Local Font Access nicht verfügbar */
          }
        }
        this.changed();
      })();
    }
    return this.initPromise;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }

  listFamilies(): FamilyInfo[] {
    return [...this.families.values()].map((f) => ({
      id: f.id,
      name: f.name,
      source: f.source,
      category: f.category,
      faces: f.faces.map(({ key, label, weight, italic }) => ({ key, label, weight, italic })),
    }));
  }

  getFamily(id: string): FamilyInfo | undefined {
    const f = this.families.get(id);
    return f
      ? { id: f.id, name: f.name, source: f.source, category: f.category, faces: f.faces.map(({ key, label, weight, italic }) => ({ key, label, weight, italic })) }
      : undefined;
  }

  previewFamilyOf(id: string): string | undefined {
    const f = this.families.get(id);
    if (!f) return undefined;
    if (f.source === 'css' || f.source === 'system') return f.name;
    return f.previewFamily;
  }

  /** Ordnet eine Referenz einem vorhandenen Schnitt zu (mit Ersatz bei fehlender Schrift). */
  resolve(ref: FontRef): ResolvedFace {
    let family = this.families.get(ref.family);
    let exact = true;
    if (!family) {
      // Schriften „per Name“ lassen sich jederzeit neu anlegen; fehlende Systemschriften
      // (Zugriff noch nicht erteilt) werden ebenfalls über ihren Namen angesprochen.
      if (ref.family.startsWith('css:')) family = this.families.get(this.createCssFamily(ref.family.slice(4)));
      else if (ref.family.startsWith('sys:') || ref.family.startsWith('loc:')) {
        family = this.families.get(this.createCssFamily(ref.family.slice(4)));
        exact = false;
      }
    }
    if (family && family.faces.length) {
      const face = family.faces.find((f) => f.key === ref.face);
      if (face) return { familyId: family.id, faceKey: face.key, exact };
      const want = parseFaceKey(ref.face);
      return { familyId: family.id, faceKey: closestFace(family.faces, want.weight, want.italic).key, exact: false };
    }
    const fallback = this.families.get(DEFAULT_FAMILY)!;
    const want = parseFaceKey(ref.face);
    return { familyId: fallback.id, faceKey: closestFace(fallback.faces, want.weight, want.italic).key, exact: false };
  }

  /** Sofort verfügbare (bereits geladene) Schrift, sonst undefined. */
  peek(ref: FontRef): LoadedFont | undefined {
    const r = this.resolve(ref);
    return this.loaded.get(`${r.familyId}|${r.faceKey}`);
  }

  async ensure(ref: FontRef): Promise<LoadedFont> {
    const r = this.resolve(ref);
    const id = `${r.familyId}|${r.faceKey}`;
    const done = this.loaded.get(id);
    if (done) return done;
    let pending = this.loading.get(id);
    if (!pending) {
      const face = this.families.get(r.familyId)!.faces.find((f) => f.key === r.faceKey)!;
      pending = face
        .load()
        .then((font) => {
          this.loaded.set(id, font);
          this.loading.delete(id);
          this.changed();
          return font;
        })
        .catch(async (err) => {
          this.loading.delete(id);
          console.warn('Schrift konnte nicht geladen werden', id, err);
          if (r.familyId === DEFAULT_FAMILY) throw err;
          // Ersatz: Standardschrift im passenden Gewicht
          return this.ensure({ family: DEFAULT_FAMILY, face: faceKeyOf(Math.round(face.weight / 100) * 100 || 400, false) });
        });
      this.loading.set(id, pending);
    }
    return pending;
  }

  /** Lädt einen Schnitt nur für die Schriftvorschau in der Oberfläche. */
  async ensurePreview(familyId: string): Promise<string | undefined> {
    const family = this.families.get(familyId);
    if (!family) return undefined;
    if (family.source === 'css' || family.source === 'system') return family.name;
    const face = closestFace(family.faces.filter((f) => !f.italic).length ? family.faces.filter((f) => !f.italic) : family.faces, 400, false);
    if (family.source === 'local') {
      // Nur für die Anzeige: Datei direkt als Webfont laden, ohne sie zu zerlegen
      if (!family.previewRequested && face.serverId && typeof FontFace !== 'undefined') {
        family.previewRequested = true;
        try {
          const ff = new FontFace(family.previewFamily!, `url(./__local-fonts/font/${face.serverId})`, { weight: '400', style: 'normal' });
          await ff.load();
          document.fonts.add(ff);
        } catch {
          /* Vorschau ist optional */
        }
      }
      return family.previewFamily;
    }
    await this.ensure({ family: familyId, face: face.key }).catch(() => undefined);
    return family.previewFamily;
  }

  private registerPreview(cssName: string, buffer: ArrayBuffer, weight: number, italic: boolean) {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
    try {
      const face = new FontFace(cssName, buffer.slice(0), { weight: String(weight), style: italic ? 'italic' : 'normal' });
      face.load().then((f) => document.fonts.add(f)).catch(() => undefined);
    } catch {
      /* Vorschau ist optional */
    }
  }

  // ---------- Installierte Schriften über den lokalen Server ----------

  /** Holt die Liste der auf diesem Rechner installierten Schriften (nur mit `npm run dev`/`preview`). */
  async loadLocalServerFonts(refresh = false): Promise<number> {
    let data: { fonts?: LocalServerFace[] } | null = null;
    try {
      const res = await fetch(`./__local-fonts/list${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return 0;
      data = await res.json();
    } catch {
      return 0; // z. B. als Einzeldatei geöffnet – dann gibt es keinen Server
    }
    const list = Array.isArray(data?.fonts) ? data!.fonts! : [];
    for (const [id, fam] of [...this.families]) if (fam.source === 'local') this.families.delete(id);
    const byFamily = new Map<string, LocalServerFace[]>();
    for (const f of list) {
      if (!byFamily.has(f.family)) byFamily.set(f.family, []);
      byFamily.get(f.family)!.push(f);
    }
    let n = 0;
    for (const [name, faces] of byFamily) {
      const familyId = `loc:${name}`;
      const entry: FamilyEntry = { id: familyId, name, source: 'local', category: 'other', faces: [], previewFamily: `cc-loc-${n++}` };
      const used = new Set<string>();
      for (const f of faces) {
        let key = f.postscript || f.fullName || f.style;
        if (used.has(key)) key = `${key}#${f.id}`;
        used.add(key);
        entry.faces.push({
          key,
          label: f.style,
          weight: f.weight,
          italic: f.italic,
          serverId: f.id,
          load: async () => {
            try {
              const res = await fetch(`./__local-fonts/font/${f.id}`, { cache: 'no-store' });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buffer = await res.arrayBuffer();
              const ot = parse(buffer);
              this.registerPreview(entry.previewFamily!, buffer, f.weight, f.italic);
              return createLoadedFont({ familyId, faceKey: key, name, cssFamily: name, weight: f.weight, italic: f.italic, ot });
            } catch {
              // Nicht lesbar → über den Namen vom Browser zeichnen lassen
              return createCssFont({ familyId, faceKey: key, name, cssFamily: name, weight: f.weight, italic: f.italic });
            }
          },
        });
      }
      entry.faces.sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
      this.families.set(familyId, entry);
    }
    if (refresh) for (const key of [...this.loaded.keys()]) if (key.startsWith('loc:')) this.loaded.delete(key);
    this.localServerAvailable = true;
    this.changed();
    return byFamily.size;
  }

  // ---------- Eigene Schriftdateien ----------

  async addFiles(files: File[]): Promise<{ added: string[]; errors: string[] }> {
    const added: string[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const id = newId();
        const families = this.ingest(id, file.name, data);
        added.push(...families);
        await putStoredFont({ id, fileName: file.name, data, addedAt: Date.now() });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (added.length) this.changed();
    return { added: [...new Set(added)], errors };
  }

  /** Liest eine Schriftdatei ein und legt Familien/Schnitte an. Gibt die Familien-IDs zurück. */
  private ingest(fileId: string, fileName: string, buffer: ArrayBuffer): string[] {
    const format = detectFormat(buffer);
    if (format === 'woff2') throw new Error('WOFF2 wird nicht unterstützt – bitte TTF, OTF oder WOFF verwenden.');
    if (format === 'unknown') throw new Error('Unbekanntes Schriftformat.');
    const buffers = format === 'ttc' ? splitCollection(buffer) : [buffer];
    const familyIds: string[] = [];
    buffers.forEach((faceBuffer, index) => {
      const ot = parse(faceBuffer);
      const familyName = nameOf(ot, 'preferredFamily') || nameOf(ot, 'fontFamily') || fileName.replace(/\.[^.]+$/, '');
      const subfamily = nameOf(ot, 'preferredSubfamily') || nameOf(ot, 'fontSubfamily') || 'Regular';
      const baseWeight = ot.tables.os2?.usWeightClass || guessWeight(subfamily);
      const baseItalic = ((ot.tables.os2?.fsSelection ?? 0) & 1) === 1 || guessItalic(subfamily);
      const familyId = `up:${familyName}`;
      let family = this.families.get(familyId);
      if (!family) {
        family = { id: familyId, name: familyName, source: 'upload', category: 'other', faces: [], fileIds: [], previewFamily: `cc-up-${fileId}` };
        this.families.set(familyId, family);
      }
      if (!family.fileIds!.includes(fileId)) family.fileIds!.push(fileId);
      const fam = family;
      const addFace = (key: string, label: string, weight: number, italic: boolean, coords?: Record<string, number>) => {
        if (fam.faces.some((f) => f.key === key)) return;
        const font = createLoadedFont({ familyId, faceKey: key, name: familyName, cssFamily: familyName, weight, italic, ot, coords });
        fam.faces.push({ key, label, weight, italic, load: async () => font });
      };
      const instances = ot.variation && ot.tables.fvar?.instances?.length ? ot.tables.fvar.instances : null;
      if (instances) {
        instances.forEach((inst, i) => {
          const label = inst.name?.en ?? Object.values(inst.name ?? {})[0] ?? `Instanz ${i + 1}`;
          const weight = Math.round(inst.coordinates.wght ?? baseWeight);
          const italic = guessItalic(label) || inst.coordinates.ital === 1 || (inst.coordinates.slnt ?? 0) < 0;
          addFace(`${fileId}:${index}:${i}`, label, weight, italic, { ...inst.coordinates });
        });
      } else {
        addFace(`${fileId}:${index}`, subfamily, baseWeight, baseItalic);
      }
      fam.faces.sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
      if (index === 0 || !baseItalic) this.registerPreview(fam.previewFamily!, faceBuffer, 400, false);
      familyIds.push(familyId);
    });
    return [...new Set(familyIds)];
  }

  async removeFamily(familyId: string): Promise<void> {
    const family = this.families.get(familyId);
    if (!family || family.source === 'bundled') return;
    for (const fileId of family.fileIds ?? []) await deleteStoredFont(fileId);
    this.families.delete(familyId);
    for (const key of [...this.loaded.keys()]) if (key.startsWith(`${familyId}|`)) this.loaded.delete(key);
    this.changed();
  }

  // ---------- Installierte Systemschriften ----------

  get systemFontsSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';
  }

  /** Fragt installierte Schriften ab (Chrome/Edge, Local Font Access API). */
  async loadSystemFonts(): Promise<number> {
    if (!this.systemFontsSupported) throw new Error('Dieser Browser erlaubt keinen Zugriff auf installierte Schriften.');
    const fonts = await window.queryLocalFonts!();
    const byFamily = new Map<string, LocalFontData[]>();
    for (const f of fonts) {
      if (!byFamily.has(f.family)) byFamily.set(f.family, []);
      byFamily.get(f.family)!.push(f);
    }
    for (const [name, list] of byFamily) {
      const familyId = `sys:${name}`;
      if (this.families.has(familyId)) continue;
      const faces: FaceEntry[] = list.map((fd) => {
        const weight = guessWeight(fd.style);
        const italic = guessItalic(fd.style);
        return {
          key: fd.postscriptName,
          label: fd.style,
          weight,
          italic,
          load: async () => {
            try {
              const blob = await fd.blob();
              const data = await blob.arrayBuffer();
              const format = detectFormat(data);
              if (format === 'woff2' || format === 'unknown') throw new Error('Format nicht lesbar');
              const candidates = format === 'ttc' ? splitCollection(data) : [data];
              let ot: OtFont | null = null;
              for (const c of candidates) {
                const parsed = parse(c);
                if (candidates.length === 1 || nameOf(parsed, 'postScriptName') === fd.postscriptName) {
                  ot = parsed;
                  break;
                }
              }
              if (!ot) ot = parse(candidates[0]);
              return createLoadedFont({ familyId, faceKey: fd.postscriptName, name, cssFamily: name, weight, italic, ot });
            } catch {
              // Nicht lesbar → als installierte Schrift per Name verwenden (kein Text-zu-Pfad)
              return createCssFont({ familyId, faceKey: fd.postscriptName, name, cssFamily: name, weight, italic });
            }
          },
        };
      });
      faces.sort((a, b) => Number(a.italic) - Number(b.italic) || a.weight - b.weight);
      this.families.set(familyId, { id: familyId, name, source: 'system', category: 'other', faces });
    }
    this.systemFontsLoaded = true;
    this.changed();
    return byFamily.size;
  }

  /** Eine installierte Schrift nur über ihren Namen nutzen (Fallback ohne Local Font Access). */
  addCssFont(name: string): string {
    const before = this.families.size;
    const familyId = this.createCssFamily(name);
    if (this.families.size !== before) this.changed();
    return familyId;
  }

  /** Legt die Familie still an (ohne Benachrichtigung – darf auch während des Renderns laufen). */
  private createCssFamily(name: string): string {
    const clean = name.trim();
    const familyId = `css:${clean}`;
    if (!this.families.has(familyId)) {
      const faces: FaceEntry[] = [];
      for (const italic of [false, true]) {
        for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
          const key = faceKeyOf(weight, italic);
          faces.push({
            key,
            label: weightLabel(weight, italic),
            weight,
            italic,
            load: async () => createCssFont({ familyId, faceKey: key, name: clean, cssFamily: clean, weight, italic }),
          });
        }
      }
      this.families.set(familyId, { id: familyId, name: clean, source: 'css', category: 'other', faces });
    }
    return familyId;
  }
}

export const fontRegistry = new FontRegistry();

/** Prüft grob, ob eine Schrift unter diesem Namen installiert ist. */
export function isFontInstalled(name: string): boolean {
  if (typeof document === 'undefined') return false;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return false;
  const sample = 'mmmmmmmmmmlli1WQ@#';
  const widthWith = (family: string) => {
    ctx.font = `72px ${family}`;
    return ctx.measureText(sample).width;
  };
  return ['monospace', 'serif', 'sans-serif'].some((generic) => widthWith(`"${name}", ${generic}`) !== widthWith(generic));
}
