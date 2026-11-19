// Datenmodell aller Einstellungen. Längen in mm, Schriftgrößen und Linienstärken in pt,
// Laufweite (Tracking) in 1/1000 em, Deckkraft in Prozent.

export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type WeekdayFormat = 'long' | 'short' | 'two' | 'narrow';
export type MonthFormat = 'long' | 'short' | 'numeric';
export type TextCase = 'auto' | 'upper' | 'lower';
export type CellShape = 'none' | 'rect' | 'parallelogram' | 'circle' | 'ellipse' | 'squircle' | 'hexagon';
export type CornerStyle = 'round' | 'bevel' | 'scoop' | 'notch';
export type OverflowMode = 'dimmed' | 'empty' | 'hidden';

/** Verweis auf eine Schrift: Familie (ID aus der Font-Registry) + Schnitt (Face-Key). */
export interface FontRef {
  family: string;
  face: string;
}

/** Farb-Überschreibungen für eine Tagesart (Samstag, Sonntag, Feiertag, Überlauf). */
export interface DayOverride {
  enabled: boolean;
  numberOn: boolean;
  number: string;
  fillOn: boolean;
  fill: string;
  strokeOn: boolean;
  stroke: string;
  labelOn: boolean;
  label: string;
  badgeOn: boolean;
  badge: string;
}

export interface GeneralConfig {
  year: number;
  locale: string;
  /** 0 = Sonntag, 1 = Montag, 6 = Samstag */
  weekStart: number;
  customNames: boolean;
  /** 12 Einträge, Januar … Dezember */
  monthNames: string[];
  /** 7 Einträge, Montag … Sonntag */
  weekdayNames: string[];
}

export interface LayoutConfig {
  sizeMode: 'cell' | 'total';
  cellWidth: number;
  cellHeight: number;
  totalWidth: number;
  totalHeight: number;
  gapX: number;
  gapY: number;
  padding: number;
  rows: 'auto' | 'six';
  overflow: OverflowMode;
  overflowOpacity: number;
}

export interface CellConfig {
  shape: CellShape;
  /** Größe der Form relativ zur Zelle in % */
  scale: number;
  cornerStyle: CornerStyle;
  radius: number;
  individualCorners: boolean;
  radiusTL: number;
  radiusTR: number;
  radiusBR: number;
  radiusBL: number;
  squircleN: number;
  hexOrientation: 'pointy' | 'flat';
  /** Neigung des Parallelogramms in Grad (positiv = nach rechts geneigt wie Kursivschrift) */
  skew: number;
  /** Texte in schrägen Kästchen mitneigen */
  skewText: boolean;
  fillEnabled: boolean;
  fill: string;
  fillOpacity: number;
  /** 'gradient' = Verlauf von fill nach fill2 */
  fillMode: 'solid' | 'gradient';
  fill2: string;
  gradientDir: 'vertical' | 'horizontal' | 'diagonal';
  strokeEnabled: boolean;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  dashLength: number;
  dashGap: number;
  /** 'cell' = Rahmen je Zelle, 'grid' = gemeinsames Tabellenraster */
  borderMode: 'cell' | 'grid';
  sideTop: boolean;
  sideRight: boolean;
  sideBottom: boolean;
  sideLeft: boolean;
  gridOuter: boolean;
  gridInnerH: boolean;
  gridInnerV: boolean;
  shadowEnabled: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  shadowOpacity: number;
}

export interface TextBase {
  font: FontRef;
  size: number;
  color: string;
  tracking: number;
}

export interface DayNumberConfig extends TextBase {
  show: boolean;
  anchor: Anchor;
  padX: number;
  padY: number;
  leadingZero: boolean;
  /** Text vor/nach der Zahl, z. B. „.“ für „1.“ */
  prefix: string;
  suffix: string;
  badge: 'none' | 'circle' | 'square';
  badgeScope: 'all' | 'highlighted';
  badgeSize: number;
  badgeRadius: number;
  badgeColor: string;
}

export interface WeekdayConfig extends TextBase {
  show: boolean;
  format: WeekdayFormat;
  textCase: TextCase;
  anchor: Anchor;
  padX: number;
  padY: number;
}

export interface HeaderConfig extends TextBase {
  show: boolean;
  format: WeekdayFormat;
  textCase: TextCase;
  align: HAlign;
  padX: number;
  height: number;
  gap: number;
  /** Höhe und Abstand wie die Tageszellen (Kopfzeile wirkt wie eine weitere Zeile) */
  matchCell: boolean;
  /** 'cell' = gleiche Form, Füllung, Rahmen und Schatten wie die Tageszellen */
  background: 'none' | 'cell' | 'cells' | 'bar';
  bgColor: string;
  bgRadius: number;
  weekendColors: boolean;
  /** zu lange Wochentage gemeinsam verkleinern, bis der längste passt */
  autoFit: boolean;
}

export interface TitleConfig extends TextBase {
  show: boolean;
  position: 'top' | 'bottom';
  align: HAlign;
  offsetX: number;
  format: MonthFormat;
  textCase: TextCase;
  gap: number;
  showYear: boolean;
  yearFont: FontRef;
  yearSize: number;
  yearColor: string;
  yearSeparator: string;
}

export interface WeekNumberConfig extends TextBase {
  show: boolean;
  side: 'left' | 'right';
  prefix: string;
  width: number;
  gap: number;
  valign: VAlign;
}

export interface HighlightConfig {
  saturday: DayOverride;
  sunday: DayOverride;
  holiday: DayOverride;
  overflow: DayOverride;
}

export interface HolidayConfig extends TextBase {
  region: string;
  showNames: boolean;
  observances: boolean;
  entries: string;
  anchor: Anchor;
  padX: number;
  padY: number;
  textCase: TextCase;
  maxLines: number;
  lineHeight: number;
}

export interface LinesConfig {
  show: boolean;
  count: number;
  color: string;
  width: number;
  style: StrokeStyle;
  top: number;
  bottom: number;
  inset: number;
}

export interface OutputConfig {
  background: 'transparent' | 'color';
  backgroundColor: string;
  format: 'png' | 'svg' | 'both';
  dpi: number;
  textAsPaths: boolean;
  fileName: string;
  /** 12 Einträge: welche Monate exportiert werden */
  months: boolean[];
}

export interface Config {
  version: number;
  general: GeneralConfig;
  layout: LayoutConfig;
  cell: CellConfig;
  dayNumber: DayNumberConfig;
  weekday: WeekdayConfig;
  header: HeaderConfig;
  title: TitleConfig;
  weekNumbers: WeekNumberConfig;
  highlight: HighlightConfig;
  holidays: HolidayConfig;
  lines: LinesConfig;
  output: OutputConfig;
}

export type SectionKey = Exclude<keyof Config, 'version'>;
