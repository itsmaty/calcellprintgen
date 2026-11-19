import type { Config } from './types';
import { applyPartial, createDefaultConfig, type DeepPartial } from './defaults';

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** auf neutrale Grundwerte zurücksetzen, bevor das Preset angewendet wird */
  clean: boolean;
  patch: DeepPartial<Config>;
}

const f = (family: string, face: string) => ({ family, face });

/** Neutrale Grundlage für Vorlagen, die nicht auf dem Kästchen-Look aufbauen. */
const CLEAN: DeepPartial<Config> = {
  layout: { cellWidth: 38, cellHeight: 26, gapX: 2, gapY: 2, padding: 4, overflow: 'dimmed', overflowOpacity: 35 },
  cell: {
    shape: 'rect',
    scale: 100,
    cornerStyle: 'round',
    radius: 2.5,
    individualCorners: false,
    fillEnabled: true,
    fill: '#f1f3f5',
    fillMode: 'solid',
    fillOpacity: 100,
    strokeEnabled: false,
    stroke: '#c5cad1',
    strokeWidth: 0.5,
    strokeStyle: 'solid',
    borderMode: 'cell',
    shadowEnabled: false,
    shadowX: 0.6,
    shadowY: 0.8,
    shadowBlur: 0,
    shadowColor: '#000000',
    shadowOpacity: 15,
  },
  dayNumber: { font: f('inter', '600'), size: 15, color: '#1f2328', tracking: 0, anchor: 'tl', padX: 2.6, padY: 2.6, prefix: '', suffix: '' },
  header: {
    format: 'two',
    textCase: 'upper',
    font: f('inter', '600'),
    size: 8.5,
    color: '#6b7280',
    tracking: 80,
    align: 'left',
    padX: 2.6,
    height: 7,
    gap: 1,
    matchCell: false,
    background: 'none',
    weekendColors: true,
  },
  title: { show: true },
  highlight: { sunday: { enabled: true }, holiday: { enabled: true } },
  holidays: { showNames: true, font: f('inter', '500'), size: 6, anchor: 'bl', padX: 2.6, padY: 2.4, maxLines: 2 },
};

export const PRESETS: Preset[] = [
  {
    id: 'boxes',
    name: 'Kästchen mit Schatten',
    description: 'Rahmen, Verlauf, Schlagschatten – Wochentage im gleichen Stil',
    clean: false,
    patch: {},
  },
  {
    id: 'slanted',
    name: 'Schräge Kästchen',
    description: 'Parallelogramme mit Schatten, Schrift mitgeneigt',
    clean: false,
    patch: {
      layout: { gapX: 3.5 },
      cell: { shape: 'parallelogram', skew: 14, skewText: true, radius: 0.3 },
    },
  },
  {
    id: 'overlay-light',
    name: 'Foto-Overlay hell',
    description: 'Halbtransparente weiße Kästchen für Fotos',
    clean: true,
    patch: {
      layout: { cellWidth: 36, cellHeight: 14, gapX: 2.5, gapY: 2.5, overflow: 'hidden' },
      cell: { radius: 1.6, fill: '#ffffff', fillOpacity: 78, shadowEnabled: true, shadowX: 0, shadowY: 0.5, shadowBlur: 1.2, shadowOpacity: 25 },
      dayNumber: { font: f('montserrat', '700'), size: 14, color: '#1b1e22', anchor: 'tl', padX: 1.8, padY: 1.8 },
      header: { format: 'long', textCase: 'upper', font: f('montserrat', '700'), size: 8, color: '#1b1e22', tracking: 60, padX: 1.8, matchCell: false, height: 7, gap: 2.5, background: 'cells', bgColor: '#ffffff', bgRadius: 1.6, weekendColors: false },
      title: { show: false },
      highlight: { sunday: { numberOn: true, number: '#c62828', fillOn: false }, holiday: { fillOn: false } },
      holidays: { showNames: true, font: f('montserrat', '500'), size: 5.5, anchor: 'bl', padX: 1.8, padY: 1.6, color: '#3d4349' },
    },
  },
  {
    id: 'overlay-dark',
    name: 'Foto-Overlay dunkel',
    description: 'Dunkle, halbtransparente Kästchen mit heller Schrift',
    clean: true,
    patch: {
      layout: { cellWidth: 36, cellHeight: 14, gapX: 2.5, gapY: 2.5, overflow: 'hidden' },
      cell: { radius: 1.6, fill: '#0d0f12', fillOpacity: 55 },
      dayNumber: { font: f('outfit', '600'), size: 15, color: '#ffffff', anchor: 'tl', padX: 1.8, padY: 1.8 },
      header: { format: 'long', textCase: 'upper', font: f('outfit', '600'), size: 8, color: '#ffffff', tracking: 80, padX: 1.8, height: 7, gap: 2.5, background: 'cells', bgColor: '#0d0f12', bgRadius: 1.6, weekendColors: false },
      title: { show: false },
      highlight: {
        sunday: { numberOn: true, number: '#ffb4a8', labelOn: true, label: '#ffb4a8' },
        holiday: { numberOn: true, number: '#ffb4a8', fillOn: false, labelOn: true, label: '#ffb4a8' },
      },
      holidays: { showNames: true, font: f('outfit', '400'), size: 5.5, color: '#e6e8eb', anchor: 'bl', padX: 1.8, padY: 1.6 },
    },
  },
  {
    id: 'classic',
    name: 'Klassisch hell',
    description: 'Abgerundete graue Felder, Titel, Sonn- und Feiertage rot',
    clean: true,
    patch: {},
  },
  {
    id: 'minimal',
    name: 'Minimal mit Linie',
    description: 'Keine Füllung, nur eine feine Linie über jedem Tag',
    clean: true,
    patch: {
      layout: { gapX: 3, gapY: 4, overflow: 'hidden' },
      cell: { fillEnabled: false, strokeEnabled: true, stroke: '#1f2328', strokeWidth: 0.75, radius: 0, sideTop: true, sideRight: false, sideBottom: false, sideLeft: false },
      dayNumber: { font: f('work-sans', '300'), size: 18, padX: 0, padY: 2.2 },
      header: { font: f('work-sans', '500'), size: 7.5, tracking: 140, padX: 0, color: '#1f2328' },
      title: { font: f('work-sans', '300'), size: 32, textCase: 'upper', tracking: 120, yearFont: f('work-sans', '600'), yearSize: 32, yearColor: '#1f2328' },
      highlight: { holiday: { fillOn: false } },
      holidays: { font: f('work-sans', '400'), padX: 0 },
    },
  },
  {
    id: 'table',
    name: 'Tabelle',
    description: 'Gemeinsames Linienraster wie ein Tischkalender',
    clean: true,
    patch: {
      layout: { overflow: 'empty', overflowOpacity: 100, cellHeight: 22 },
      cell: { borderMode: 'grid', fillEnabled: false, strokeEnabled: true, stroke: '#8a9099', strokeWidth: 0.6 },
      dayNumber: { font: f('roboto', '500'), size: 12, padX: 2, padY: 2 },
      header: { background: 'bar', bgColor: '#1f2328', color: '#ffffff', height: 7, gap: 0, align: 'center', font: f('roboto', '500'), weekendColors: false, bgRadius: 0 },
      title: { font: f('roboto', '700'), yearFont: f('roboto', '300') },
      holidays: { font: f('roboto', '400'), padX: 2 },
    },
  },
  {
    id: 'circles',
    name: 'Kreise',
    description: 'Runde Tage mit zentrierten Zahlen',
    clean: true,
    patch: {
      layout: { cellWidth: 22, cellHeight: 22, gapX: 3, gapY: 3, overflow: 'hidden' },
      cell: { shape: 'circle', fill: '#e8edff' },
      dayNumber: { font: f('poppins', '600'), size: 14, color: '#2b3a8c', anchor: 'mc' },
      header: { align: 'center', font: f('poppins', '600'), tracking: 40, padX: 0 },
      title: { align: 'center', font: f('poppins', '700'), yearFont: f('poppins', '300') },
      highlight: {
        sunday: { fillOn: true, fill: '#ffe1dc', numberOn: true, number: '#c2410c' },
        holiday: { fillOn: true, fill: '#ffc9c0', numberOn: true, number: '#b42318' },
      },
      holidays: { showNames: false },
    },
  },
  {
    id: 'pastel',
    name: 'Pastell Squircle',
    description: 'Weiche Squircle-Formen in Pastelltönen',
    clean: true,
    patch: {
      layout: { cellWidth: 30, cellHeight: 24, gapX: 3, gapY: 3 },
      cell: { shape: 'squircle', squircleN: 5, fill: '#fff1e0' },
      dayNumber: { font: f('nunito', '800'), size: 16, color: '#7a4a12', anchor: 'tc', padY: 3.2 },
      header: { align: 'center', font: f('nunito', '800'), color: '#b07a3c', padX: 0 },
      title: { font: f('nunito', '900'), color: '#7a4a12', yearFont: f('nunito', '300'), yearColor: '#d9a05b', align: 'center' },
      highlight: { sunday: { fillOn: true, fill: '#ffe2dc' }, holiday: { fill: '#ffd3cc' } },
      holidays: { font: f('nunito', '700'), anchor: 'bc', color: '#b07a3c' },
    },
  },
  {
    id: 'ticket',
    name: 'Ticket',
    description: 'Nach innen gewölbte Ecken, gestrichelter Rahmen',
    clean: true,
    patch: {
      layout: { gapX: 2.5, gapY: 2.5 },
      cell: { cornerStyle: 'scoop', radius: 3, fill: '#fffaf0', strokeEnabled: true, stroke: '#c08a2b', strokeWidth: 0.8, strokeStyle: 'dashed', dashLength: 1.4, dashGap: 1 },
      dayNumber: { font: f('space-mono', '700'), size: 14, color: '#5a3d0a', anchor: 'tl', padX: 3.2, padY: 3 },
      header: { font: f('space-mono', '700'), color: '#c08a2b', tracking: 40, padX: 3.2 },
      title: { font: f('space-mono', '700'), color: '#5a3d0a', yearFont: f('space-mono', '400'), yearColor: '#c08a2b' },
      holidays: { font: f('space-mono', '400'), padX: 3.2 },
    },
  },
  {
    id: 'poster',
    name: 'Poster',
    description: 'Schwarze Felder, große helle Zahlen, rote Sonntage',
    clean: true,
    patch: {
      layout: { gapX: 1.5, gapY: 1.5 },
      cell: { radius: 0, fill: '#121212' },
      dayNumber: { font: f('anton', '400'), size: 24, color: '#ffffff', anchor: 'br', padX: 2.4, padY: 2.2 },
      header: { font: f('anton', '400'), size: 11, color: '#121212', tracking: 60, padX: 0, height: 8 },
      title: { font: f('bebas-neue', '400'), size: 56, textCase: 'upper', tracking: 20, yearFont: f('bebas-neue', '400'), yearSize: 56, yearColor: '#e63946' },
      highlight: {
        sunday: { fillOn: true, fill: '#e63946', numberOn: true, number: '#ffffff', labelOn: true, label: '#ffffff' },
        holiday: { fillOn: true, fill: '#e63946', numberOn: true, number: '#ffffff', labelOn: true, label: '#ffffff' },
      },
      holidays: { font: f('oswald', '500'), size: 6.5, color: '#bdbdbd', anchor: 'tl', padY: 2.2, padX: 2.4, textCase: 'upper' },
    },
  },
  {
    id: 'notes',
    name: 'Notizen',
    description: 'Felder mit Schreiblinien, handschriftlicher Titel',
    clean: true,
    patch: {
      layout: { cellHeight: 32 },
      cell: { radius: 1.5, fill: '#ffffff', strokeEnabled: true, stroke: '#d5d9de', strokeWidth: 0.5 },
      dayNumber: { font: f('dm-sans', '700'), size: 13 },
      lines: { show: true, count: 3, top: 13, bottom: 4, inset: 2.6, color: '#d5d9de' },
      title: { font: f('caveat', '700'), size: 40, yearFont: f('caveat', '400'), yearSize: 40 },
      header: { font: f('dm-sans', '700') },
      holidays: { anchor: 'tr', padY: 3, maxLines: 1 },
    },
  },
];

/** Wendet eine Vorlage an, behält aber Jahr, Sprache, Feiertagsregion, eigene Einträge und Exporteinstellungen. */
export function applyPreset(current: Config, preset: Preset): Config {
  let next = createDefaultConfig();
  if (preset.clean) next = applyPartial(next, CLEAN);
  next = applyPartial(next, preset.patch);
  next.general = current.general;
  next.holidays = {
    ...next.holidays,
    region: current.holidays.region,
    observances: current.holidays.observances,
    entries: current.holidays.entries,
  };
  next.output = { ...current.output };
  return next;
}
