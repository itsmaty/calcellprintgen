import { describe, expect, it } from 'vitest';
import { buildMonthGrid, isoWeek, weekNumberOfRow } from './dates';
import { buildAnnotations, easterSunday, getHolidays, parseEntries } from './holidays';
import { monthName, weekdayName } from './locale';
import { createDefaultConfig } from '../config/defaults';

describe('Monatsraster', () => {
  it('Februar 2027 beginnt am Montag und braucht genau 4 Wochen', () => {
    const g = buildMonthGrid(2027, 1, 1, 'auto');
    expect(g.rows).toHaveLength(4);
    expect(g.rows[0][0]).toMatchObject({ day: 1, month: 1, inMonth: true, dow: 1 });
    expect(g.rows[3][6]).toMatchObject({ day: 28, inMonth: true, dow: 0 });
  });

  it('immer 6 Wochen füllt mit Folgemonat auf', () => {
    const g = buildMonthGrid(2027, 1, 1, 'six');
    expect(g.rows).toHaveLength(6);
    expect(g.rows[5][6]).toMatchObject({ day: 14, month: 2, inMonth: false });
  });

  it('Mai 2027 (Mo-Start) hat Überlauftage aus April und 6 Zeilen', () => {
    // 1. Mai 2027 ist ein Samstag → 5 Tage aus dem April davor, 31 Tage → 6 Zeilen
    const g = buildMonthGrid(2027, 4, 1, 'auto');
    expect(g.rows[0].slice(0, 5).every((d) => !d.inMonth && d.month === 3)).toBe(true);
    expect(g.rows[0][5]).toMatchObject({ day: 1, month: 4, inMonth: true });
    expect(g.rows).toHaveLength(6);
  });

  it('Wochenbeginn Sonntag verschiebt die Spalten', () => {
    const g = buildMonthGrid(2027, 0, 0, 'auto');
    expect(g.columns).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // 1.1.2027 ist ein Freitag
    expect(g.rows[0][5]).toMatchObject({ day: 1, month: 0, inMonth: true });
    expect(g.rows[0][0]).toMatchObject({ day: 27, month: 11, year: 2026, inMonth: false });
  });

  it('Jahreswechsel im Überlauf liefert korrektes Jahr', () => {
    const g = buildMonthGrid(2027, 11, 1, 'auto');
    const last = g.rows[g.rows.length - 1];
    expect(last[6]).toMatchObject({ year: 2028, month: 0, day: 2 });
  });
});

describe('Kalenderwochen', () => {
  it('ISO-Wochen an Jahresgrenzen', () => {
    expect(isoWeek(2027, 0, 1)).toBe(53); // Fr 1.1.2027 gehört zu KW 53/2026
    expect(isoWeek(2027, 0, 4)).toBe(1);
    expect(isoWeek(2026, 11, 31)).toBe(53);
    expect(isoWeek(2024, 11, 30)).toBe(1);
  });

  it('KW einer Zeile mit Sonntags-Start nutzt den Montag', () => {
    const g = buildMonthGrid(2027, 0, 0, 'auto');
    // Zeile 2: So 3.1. – Sa 9.1. → Montag 4.1. = KW 1
    expect(weekNumberOfRow(g.rows[1])).toBe(1);
  });
});

describe('Feiertage', () => {
  it('Ostersonntag', () => {
    expect(easterSunday(2024)).toEqual({ month: 2, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 3, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 3, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 2, day: 28 });
    expect(easterSunday(2028)).toEqual({ month: 3, day: 16 });
  });

  it('bundesweit 2027: 9 gesetzliche Feiertage', () => {
    const h = getHolidays(2027, 'DE', false);
    expect(h).toHaveLength(9);
    expect(h.map((x) => x.key)).toEqual(
      expect.arrayContaining(['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-10-03', '2027-12-25', '2027-12-26']),
    );
  });

  it('Bayern hat Fronleichnam, Allerheiligen, Hl. Drei Könige', () => {
    const keys = getHolidays(2027, 'DE-BY', false).map((x) => `${x.key} ${x.name}`);
    expect(keys).toContain('2027-05-27 Fronleichnam');
    expect(keys).toContain('2027-11-01 Allerheiligen');
    expect(keys).toContain('2027-01-06 Heilige Drei Könige');
    expect(keys).not.toContain('2027-10-31 Reformationstag');
  });

  it('Sachsen: Buß- und Bettag', () => {
    const keys = getHolidays(2027, 'DE-SN', false).map((x) => x.key);
    expect(keys).toContain('2027-11-17');
    expect(getHolidays(2025, 'DE-SN', false).map((x) => x.key)).toContain('2025-11-19');
  });

  it('Gedenktage nur auf Wunsch und nicht als gesetzlich markiert', () => {
    const h = getHolidays(2027, 'DE', true);
    const mutter = h.find((x) => x.name === 'Muttertag');
    expect(mutter).toMatchObject({ key: '2027-05-09', isPublic: false });
    expect(h.find((x) => x.name === 'Beginn Sommerzeit')?.key).toBe('2027-03-28');
    expect(h.find((x) => x.name === 'Ende Sommerzeit')?.key).toBe('2027-10-31');
  });

  it('Österreich: Nationalfeiertag, Mariä Empfängnis', () => {
    const keys = getHolidays(2027, 'AT', false).map((x) => x.key);
    expect(keys).toContain('2027-10-26');
    expect(keys).toContain('2027-12-08');
    expect(keys).not.toContain('2027-03-26'); // Karfreitag kein allgemeiner Feiertag
  });
});

describe('Eigene Einträge', () => {
  it('erkennt Formate, Hervorhebung und Fehler', () => {
    const { entries, errors } = parseEntries(
      ['# Kommentar', '24.12. Heiligabend', '!15.08. Urlaub', '12.05.2027 Geburtstag Anna', '2028-01-03 Termin', 'Quatsch', '29.02. Schalttag'].join('\n'),
      [2027, 2028],
    );
    expect(errors).toEqual([6]);
    expect(entries).toContainEqual({ key: '2027-12-24', name: 'Heiligabend', highlight: false });
    expect(entries).toContainEqual({ key: '2028-08-15', name: 'Urlaub', highlight: true });
    expect(entries.filter((e) => e.name === 'Geburtstag Anna')).toHaveLength(1);
    expect(entries).toContainEqual({ key: '2028-01-03', name: 'Termin', highlight: false });
    expect(entries.filter((e) => e.name === 'Schalttag').map((e) => e.key)).toEqual(['2028-02-29']);
  });

  it('kombiniert Feiertage und Einträge', () => {
    const a = buildAnnotations([2027], 'DE', false, '!03.10. Familienfest');
    expect(a.get('2027-10-03')).toEqual({ names: ['Tag der Deutschen Einheit', 'Familienfest'], highlight: true });
  });
});

describe('Bezeichnungen', () => {
  it('liefert deutsche Namen in allen Formaten', () => {
    const g = createDefaultConfig().general;
    expect(monthName(g, 2, 'long')).toBe('März');
    expect(monthName(g, 2, 'numeric')).toBe('03');
    expect(weekdayName(g, 1, 'two')).toBe('Mo');
    expect(weekdayName(g, 0, 'long')).toBe('Sonntag');
    expect(weekdayName(g, 3, 'narrow')).toBe('M');
    expect(monthName({ ...g, locale: 'de-AT' }, 0, 'long')).toBe('Jänner');
  });
});
