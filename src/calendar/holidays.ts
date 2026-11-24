import { addDays, dateKey, dayOfWeek, daysInMonth } from './dates';

export interface Holiday {
  key: string;
  name: string;
  /** gesetzlicher Feiertag (true) oder nur Gedenk-/Aktionstag (false) */
  isPublic: boolean;
}

export interface CalendarEntry {
  key: string;
  name: string;
  highlight: boolean;
}

export const REGIONS: { id: string; label: string; group: string }[] = [
  { id: 'none', label: 'Keine Feiertage', group: '' },
  { id: 'DE', label: 'Deutschland – bundesweit', group: 'Deutschland' },
  { id: 'DE-BW', label: 'Baden-Württemberg', group: 'Deutschland' },
  { id: 'DE-BY', label: 'Bayern', group: 'Deutschland' },
  { id: 'DE-BE', label: 'Berlin', group: 'Deutschland' },
  { id: 'DE-BB', label: 'Brandenburg', group: 'Deutschland' },
  { id: 'DE-HB', label: 'Bremen', group: 'Deutschland' },
  { id: 'DE-HH', label: 'Hamburg', group: 'Deutschland' },
  { id: 'DE-HE', label: 'Hessen', group: 'Deutschland' },
  { id: 'DE-MV', label: 'Mecklenburg-Vorpommern', group: 'Deutschland' },
  { id: 'DE-NI', label: 'Niedersachsen', group: 'Deutschland' },
  { id: 'DE-NW', label: 'Nordrhein-Westfalen', group: 'Deutschland' },
  { id: 'DE-RP', label: 'Rheinland-Pfalz', group: 'Deutschland' },
  { id: 'DE-SL', label: 'Saarland', group: 'Deutschland' },
  { id: 'DE-SN', label: 'Sachsen', group: 'Deutschland' },
  { id: 'DE-ST', label: 'Sachsen-Anhalt', group: 'Deutschland' },
  { id: 'DE-SH', label: 'Schleswig-Holstein', group: 'Deutschland' },
  { id: 'DE-TH', label: 'Thüringen', group: 'Deutschland' },
  { id: 'AT', label: 'Österreich', group: 'Österreich & Schweiz' },
  { id: 'CH', label: 'Schweiz (verbreitete Feiertage)', group: 'Österreich & Schweiz' },
];

/** Ostersonntag (gregorianisch, Algorithmus nach Meeus/Jones/Butcher). Monat 0-basiert. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
}

/** Letzter Sonntag eines Monats (z. B. Zeitumstellung). */
function lastSunday(year: number, month: number): number {
  const last = daysInMonth(year, month);
  return last - dayOfWeek(year, month, last);
}

/** n-ter Sonntag eines Monats (n ab 1). */
function nthSunday(year: number, month: number, n: number): number {
  const first = dayOfWeek(year, month, 1);
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}

export function getHolidays(year: number, region: string, withObservances: boolean): Holiday[] {
  if (!region || region === 'none') return [];
  const list: Holiday[] = [];
  const easter = easterSunday(year);
  const add = (month: number, day: number, name: string, isPublic = true) => {
    list.push({ key: dateKey(year, month, day), name, isPublic });
  };
  const addEaster = (offset: number, name: string, isPublic = true) => {
    const d = addDays(year, easter.month, easter.day, offset);
    list.push({ key: dateKey(d.year, d.month, d.day), name, isPublic });
  };
  const observance = (fn: () => void) => {
    if (withObservances) fn();
  };

  if (region === 'DE' || region.startsWith('DE-')) {
    const s = region.slice(3); // Bundesland-Kürzel oder ''
    const inStates = (...states: string[]) => s !== '' && states.includes(s);

    add(0, 1, 'Neujahr');
    if (inStates('BW', 'BY', 'ST')) add(0, 6, 'Heilige Drei Könige');
    if ((s === 'BE' && year >= 2019) || (s === 'MV' && year >= 2023)) add(2, 8, 'Internationaler Frauentag');
    addEaster(-2, 'Karfreitag');
    if (s === 'BB') addEaster(0, 'Ostersonntag');
    else observance(() => addEaster(0, 'Ostersonntag', false));
    addEaster(1, 'Ostermontag');
    add(4, 1, 'Tag der Arbeit');
    if (s === 'BE' && (year === 2020 || year === 2025)) add(4, 8, 'Tag der Befreiung');
    addEaster(39, 'Christi Himmelfahrt');
    if (s === 'BB') addEaster(49, 'Pfingstsonntag');
    else observance(() => addEaster(49, 'Pfingstsonntag', false));
    addEaster(50, 'Pfingstmontag');
    if (inStates('BW', 'BY', 'HE', 'NW', 'RP', 'SL')) addEaster(60, 'Fronleichnam');
    if (inStates('BY', 'SL')) add(7, 15, 'Mariä Himmelfahrt');
    if (s === 'TH' && year >= 2019) add(8, 20, 'Weltkindertag');
    add(9, 3, 'Tag der Deutschen Einheit');
    if (year === 2017 || inStates('BB', 'MV', 'SN', 'ST', 'TH') || (year >= 2018 && inStates('HB', 'HH', 'NI', 'SH'))) {
      add(9, 31, 'Reformationstag');
    }
    if (inStates('BW', 'BY', 'NW', 'RP', 'SL')) add(10, 1, 'Allerheiligen');
    if (s === 'SN') {
      // Mittwoch vor dem 23. November
      const dow = dayOfWeek(year, 10, 22);
      add(10, 22 - ((dow - 3 + 7) % 7), 'Buß- und Bettag');
    }
    add(11, 25, '1. Weihnachtstag');
    add(11, 26, '2. Weihnachtstag');
    observance(() => {
      add(4, nthSunday(year, 4, 2), 'Muttertag', false);
      add(2, lastSunday(year, 2), 'Beginn Sommerzeit', false);
      add(9, lastSunday(year, 9), 'Ende Sommerzeit', false);
      add(11, 24, 'Heiligabend', false);
      add(11, 31, 'Silvester', false);
    });
  } else if (region === 'AT') {
    add(0, 1, 'Neujahr');
    add(0, 6, 'Heilige Drei Könige');
    observance(() => addEaster(-2, 'Karfreitag', false));
    observance(() => addEaster(0, 'Ostersonntag', false));
    addEaster(1, 'Ostermontag');
    add(4, 1, 'Staatsfeiertag');
    addEaster(39, 'Christi Himmelfahrt');
    observance(() => addEaster(49, 'Pfingstsonntag', false));
    addEaster(50, 'Pfingstmontag');
    addEaster(60, 'Fronleichnam');
    add(7, 15, 'Mariä Himmelfahrt');
    add(9, 26, 'Nationalfeiertag');
    add(10, 1, 'Allerheiligen');
    add(11, 8, 'Mariä Empfängnis');
    add(11, 25, 'Christtag');
    add(11, 26, 'Stefanitag');
    observance(() => {
      add(4, nthSunday(year, 4, 2), 'Muttertag', false);
      add(2, lastSunday(year, 2), 'Beginn Sommerzeit', false);
      add(9, lastSunday(year, 9), 'Ende Sommerzeit', false);
      add(11, 24, 'Heiliger Abend', false);
      add(11, 31, 'Silvester', false);
    });
  } else if (region === 'CH') {
    add(0, 1, 'Neujahr');
    add(0, 2, 'Berchtoldstag');
    addEaster(-2, 'Karfreitag');
    observance(() => addEaster(0, 'Ostersonntag', false));
    addEaster(1, 'Ostermontag');
    addEaster(39, 'Auffahrt');
    observance(() => addEaster(49, 'Pfingstsonntag', false));
    addEaster(50, 'Pfingstmontag');
    add(7, 1, 'Bundesfeier');
    add(11, 25, 'Weihnachten');
    add(11, 26, 'Stephanstag');
    observance(() => {
      add(4, nthSunday(year, 4, 2), 'Muttertag', false);
      add(8, nthSunday(year, 8, 3), 'Eidg. Dank-, Buss- und Bettag', false);
      add(2, lastSunday(year, 2), 'Beginn Sommerzeit', false);
      add(9, lastSunday(year, 9), 'Ende Sommerzeit', false);
      add(11, 24, 'Heiligabend', false);
      add(11, 31, 'Silvester', false);
    });
  }
  return list;
}

/**
 * Eigene Einträge, eine Zeile pro Termin:
 *   24.12. Heiligabend        → jedes Jahr
 *   12.05.2027 Geburtstag     → nur in diesem Jahr
 *   2027-05-12 Geburtstag     → ISO-Schreibweise
 *   !15.08. Urlaub            → mit „!“ wie ein Feiertag hervorheben
 *   # Kommentar
 */
export function parseEntries(text: string, years: number[]): { entries: CalendarEntry[]; errors: number[] } {
  const entries: CalendarEntry[] = [];
  const errors: number[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const highlight = line.startsWith('!');
    const body = highlight ? line.slice(1).trim() : line;
    let day: number;
    let month: number;
    let year: number | undefined;
    let name: string;
    const de = body.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?(?:\s*[-–:]\s*|\s+|$)(.*)$/);
    const iso = body.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s*[-–:]\s*|\s+|$)(.*)$/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]) - 1;
      day = Number(iso[3]);
      name = iso[4];
    } else if (de) {
      day = Number(de[1]);
      month = Number(de[2]) - 1;
      year = de[3] ? Number(de[3]) : undefined;
      name = de[4];
    } else {
      errors.push(index + 1);
      return;
    }
    if (month < 0 || month > 11 || day < 1 || day > 31) {
      errors.push(index + 1);
      return;
    }
    const targetYears = year !== undefined ? [year] : years;
    for (const y of targetYears) {
      if (day > daysInMonth(y, month)) continue; // z. B. 29.02. in Nicht-Schaltjahren
      entries.push({ key: dateKey(y, month, day), name: name.trim(), highlight });
    }
  });
  return { entries, errors };
}

/** Englische Namen, wenn der Kalender auf Englisch erstellt wird. */
const HOLIDAY_NAMES_EN: Record<string, string> = {
  Neujahr: "New Year's Day",
  'Heilige Drei Könige': 'Epiphany',
  'Internationaler Frauentag': "International Women's Day",
  Karfreitag: 'Good Friday',
  Ostersonntag: 'Easter Sunday',
  Ostermontag: 'Easter Monday',
  'Tag der Arbeit': 'Labour Day',
  'Tag der Befreiung': 'Liberation Day',
  'Christi Himmelfahrt': 'Ascension Day',
  Pfingstsonntag: 'Whit Sunday',
  Pfingstmontag: 'Whit Monday',
  Fronleichnam: 'Corpus Christi',
  'Mariä Himmelfahrt': 'Assumption Day',
  Weltkindertag: "World Children's Day",
  'Tag der Deutschen Einheit': 'German Unity Day',
  Reformationstag: 'Reformation Day',
  Allerheiligen: "All Saints' Day",
  'Buß- und Bettag': 'Day of Repentance',
  '1. Weihnachtstag': 'Christmas Day',
  '2. Weihnachtstag': 'Boxing Day',
  Muttertag: "Mother's Day",
  'Beginn Sommerzeit': 'Summer time begins',
  'Ende Sommerzeit': 'Summer time ends',
  Heiligabend: 'Christmas Eve',
  'Heiliger Abend': 'Christmas Eve',
  Silvester: "New Year's Eve",
  Staatsfeiertag: 'Labour Day',
  Nationalfeiertag: 'National Day',
  'Mariä Empfängnis': 'Immaculate Conception',
  Christtag: 'Christmas Day',
  Stefanitag: "St. Stephen's Day",
  Berchtoldstag: "Berchtold's Day",
  Auffahrt: 'Ascension Day',
  Bundesfeier: 'Swiss National Day',
  Weihnachten: 'Christmas Day',
  Stephanstag: "St. Stephen's Day",
  'Eidg. Dank-, Buss- und Bettag': 'Federal Day of Thanksgiving',
};

export interface DayAnnotations {
  /** Namen, die in der Zelle stehen (Feiertage, Gedenktage, eigene Einträge) */
  names: string[];
  /** wie Feiertag hervorheben */
  highlight: boolean;
}

/** Feiertage + eigene Einträge für die angegebenen Jahre, nach Datum. */
export function buildAnnotations(
  years: number[],
  region: string,
  withObservances: boolean,
  entriesText: string,
  nameLang: 'de' | 'en' = 'de',
): Map<string, DayAnnotations> {
  const map = new Map<string, DayAnnotations>();
  const get = (key: string) => {
    let a = map.get(key);
    if (!a) {
      a = { names: [], highlight: false };
      map.set(key, a);
    }
    return a;
  };
  for (const y of years) {
    for (const h of getHolidays(y, region, withObservances)) {
      const a = get(h.key);
      const name = nameLang === 'en' ? (HOLIDAY_NAMES_EN[h.name] ?? h.name) : h.name;
      if (!a.names.includes(name)) a.names.push(name);
      if (h.isPublic) a.highlight = true;
    }
  }
  for (const e of parseEntries(entriesText, years).entries) {
    const a = get(e.key);
    if (e.name) a.names.push(e.name);
    if (e.highlight) a.highlight = true;
  }
  return map;
}
