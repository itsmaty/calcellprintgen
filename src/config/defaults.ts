import type { Config, DayOverride } from './types';
import { lang as uiLang, type Lang } from '../i18n';

export const CONFIG_VERSION = 1;

export const DEFAULT_MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
export const DEFAULT_WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const EN_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Kalender werden meist fürs nächste Jahr gestaltet – ab Juli ist das Folgejahr vorausgewählt. */
export function defaultYear(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function override(partial: Partial<DayOverride>): DayOverride {
  return {
    enabled: false,
    numberOn: false,
    number: '#d93025',
    fillOn: false,
    fill: '#fdecea',
    strokeOn: false,
    stroke: '#d93025',
    labelOn: false,
    label: '#d93025',
    badgeOn: false,
    badge: '#d93025',
    ...partial,
  };
}

/** Startwerte; auf der englischen Seite mit englischem Kalender, ohne „1.“ und ohne deutsche Feiertage. */
export function createDefaultConfig(language: Lang = uiLang): Config {
  const en = language === 'en';
  return {
    version: CONFIG_VERSION,
    general: {
      year: defaultYear(),
      locale: en ? 'en' : 'de',
      weekStart: 1,
      customNames: false,
      monthNames: [...(en ? EN_MONTH_NAMES : DEFAULT_MONTH_NAMES)],
      weekdayNames: [...(en ? EN_WEEKDAY_NAMES : DEFAULT_WEEKDAY_NAMES)],
    },
    // Standard-Look: Kästchen mit Rahmen, Verlauf und Schlagschatten, Wochentage im gleichen Stil.
    layout: {
      sizeMode: 'cell',
      cellWidth: 36,
      cellHeight: 8,
      totalWidth: 297,
      totalHeight: 80,
      gapX: 3,
      gapY: 2.5,
      padding: 3,
      rows: 'auto',
      overflow: 'empty',
      overflowOpacity: 100,
    },
    cell: {
      shape: 'rect',
      scale: 100,
      cornerStyle: 'round',
      radius: 0.4,
      individualCorners: false,
      radiusTL: 0.4,
      radiusTR: 0.4,
      radiusBR: 0.4,
      radiusBL: 0.4,
      squircleN: 4.5,
      hexOrientation: 'pointy',
      skew: 15,
      skewText: false,
      fillEnabled: true,
      fill: '#ffffff',
      fillOpacity: 100,
      fillMode: 'gradient',
      fill2: '#d4d4d4',
      gradientDir: 'vertical',
      strokeEnabled: true,
      stroke: '#262626',
      strokeWidth: 1.6,
      strokeStyle: 'solid',
      dashLength: 2,
      dashGap: 1.5,
      borderMode: 'cell',
      sideTop: true,
      sideRight: true,
      sideBottom: true,
      sideLeft: true,
      gridOuter: true,
      gridInnerH: true,
      gridInnerV: true,
      shadowEnabled: true,
      shadowX: 0.7,
      shadowY: 0.7,
      shadowBlur: 0.5,
      shadowColor: '#000000',
      shadowOpacity: 55,
    },
    dayNumber: {
      show: true,
      font: { family: 'oswald', face: '700' },
      size: 16,
      color: '#1a1a1a',
      tracking: 0,
      anchor: 'ml',
      padX: 1.3,
      padY: 1,
      leadingZero: false,
      prefix: '',
      suffix: en ? '' : '.',
      badge: 'none',
      badgeScope: 'all',
      badgeSize: 7.5,
      badgeRadius: 1.5,
      badgeColor: '#e3e7eb',
    },
    weekday: {
      show: false,
      format: 'two',
      textCase: 'auto',
      font: { family: 'inter', face: '500' },
      size: 7,
      color: '#8a9099',
      tracking: 20,
      anchor: 'tr',
      padX: 2.6,
      padY: 3,
    },
    header: {
      show: true,
      format: 'long',
      textCase: 'auto',
      font: { family: 'oswald', face: '700' },
      size: 16,
      color: '#1a1a1a',
      tracking: 0,
      align: 'left',
      padX: 1.3,
      height: 8,
      gap: 2.5,
      matchCell: true,
      background: 'cell',
      bgColor: '#e8ebee',
      bgRadius: 2,
      weekendColors: false,
      autoFit: true,
    },
    title: {
      show: false,
      position: 'top',
      align: 'left',
      offsetX: 0,
      format: 'long',
      textCase: 'auto',
      font: { family: 'inter', face: '700' },
      size: 30,
      color: '#111418',
      tracking: -10,
      gap: 8,
      showYear: true,
      yearFont: { family: 'inter', face: '300' },
      yearSize: 30,
      yearColor: '#9aa1ab',
      yearSeparator: ' ',
    },
    weekNumbers: {
      show: false,
      side: 'left',
      prefix: '',
      font: { family: 'inter', face: '500' },
      size: 7,
      color: '#9aa1ab',
      tracking: 0,
      width: 6,
      gap: 1.5,
      valign: 'top',
    },
    highlight: {
      saturday: override({ numberOn: true, number: '#5b6470' }),
      sunday: override({ numberOn: true, labelOn: true }),
      holiday: override({ numberOn: true, labelOn: true, fillOn: true }),
      overflow: override({ number: '#9aa1ab', fill: '#f7f8f9', stroke: '#d6dade', label: '#9aa1ab', badge: '#eceef0' }),
    },
    holidays: {
      region: en ? 'none' : 'DE',
      showNames: false,
      observances: false,
      entries: '',
      font: { family: 'oswald', face: '400' },
      size: 7,
      color: '#5b6470',
      tracking: 0,
      anchor: 'mr',
      padX: 1.3,
      padY: 1,
      textCase: 'auto',
      maxLines: 2,
      lineHeight: 115,
    },
    lines: {
      show: false,
      count: 3,
      color: '#d5d9de',
      width: 0.5,
      style: 'solid',
      top: 11,
      bottom: 3,
      inset: 2.6,
    },
    output: {
      background: 'transparent',
      backgroundColor: '#ffffff',
      format: 'png',
      dpi: 300,
      textAsPaths: true,
      fileName: en ? '{year}-{mm}_{month}' : '{jahr}-{mm}_{monat}',
      months: Array(12).fill(true),
    },
  };
}

type Plain = Record<string, unknown>;

function isPlainObject(v: unknown): v is Plain {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Legt (evtl. unvollständige oder ältere) Daten typsicher über die Vorgaben. Unbekanntes wird verworfen. */
function mergeInto(base: unknown, raw: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(raw) || raw.length !== base.length) return base;
    return base.map((b, i) => mergeInto(b, raw[i]));
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(raw)) return base;
    const out: Plain = {};
    for (const key of Object.keys(base)) out[key] = mergeInto(base[key], raw[key]);
    return out;
  }
  if (typeof base === 'number') return typeof raw === 'number' && Number.isFinite(raw) ? raw : base;
  return typeof raw === typeof base ? raw : base;
}

export function normalizeConfig(raw: unknown): Config {
  const merged = mergeInto(createDefaultConfig(), raw) as Config;
  merged.version = CONFIG_VERSION;
  return merged;
}

/** Tiefes Zusammenführen für Presets (Teil-Objekte überschreiben nur die angegebenen Felder). */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function applyPartial<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return base;
  const out: Plain = { ...(base as Plain) };
  for (const [key, value] of Object.entries(patch as Plain)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? applyPartial(current, value) : value;
  }
  return out as T;
}
