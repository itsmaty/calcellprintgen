// Reine Datumslogik ohne Zeitzonen-Effekte (alles in UTC).

export interface CalDay {
  year: number;
  /** 0–11 */
  month: number;
  day: number;
  /** 0 = Sonntag … 6 = Samstag */
  dow: number;
  /** gehört zum dargestellten Monat */
  inMonth: boolean;
  /** YYYY-MM-DD */
  key: string;
}

export interface MonthGrid {
  year: number;
  month: number;
  weekStart: number;
  /** Wochentag (0–6) je Spalte */
  columns: number[];
  /** Zeilen à 7 Tage */
  rows: CalDay[][];
}

const DAY_MS = 86_400_000;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

function fromUtc(ms: number, refMonth: number, refYear: number): CalDay {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    year,
    month,
    day,
    dow: d.getUTCDay(),
    inMonth: year === refYear && month === refMonth,
    key: dateKey(year, month, day),
  };
}

/**
 * Baut das Monatsraster. rows = 'auto': nur so viele Wochen wie nötig (4–6),
 * 'six': immer 6 Wochen (gleich große Bilder für alle Monate).
 */
export function buildMonthGrid(year: number, month: number, weekStart: number, rows: 'auto' | 'six'): MonthGrid {
  const firstDow = dayOfWeek(year, month, 1);
  const lead = (firstDow - weekStart + 7) % 7;
  const total = rows === 'six' ? 42 : Math.ceil((lead + daysInMonth(year, month)) / 7) * 7;
  const start = Date.UTC(year, month, 1 - lead);
  const grid: CalDay[][] = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / 7);
    if (!grid[r]) grid[r] = [];
    grid[r].push(fromUtc(start + i * DAY_MS, month, year));
  }
  const columns = Array.from({ length: 7 }, (_, c) => (weekStart + c) % 7);
  return { year, month, weekStart, columns, rows: grid };
}

/** ISO-8601-Kalenderwoche (Woche beginnt Montag, KW 1 enthält den ersten Donnerstag). */
export function isoWeek(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month, day));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
}

/** KW einer Rasterzeile – bei Wochenbeginn Sonntag/Samstag zählt der Montag der Zeile. */
export function weekNumberOfRow(row: CalDay[]): number {
  const monday = row.find((d) => d.dow === 1) ?? row[0];
  return isoWeek(monday.year, monday.month, monday.day);
}

export function addDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month, day + delta));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}
