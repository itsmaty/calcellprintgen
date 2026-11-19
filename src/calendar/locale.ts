import type { GeneralConfig, MonthFormat, TextCase, WeekdayFormat } from '../config/types';
import { pad2 } from './dates';

/** Sprachen, deren Monats-/Wochentagsnamen vollständig im Latin-Zeichensatz der mitgelieferten Schriften liegen. */
export const LOCALES: { id: string; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'de-AT', label: 'Deutsch (Österreich, „Jänner“)' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' },
  { id: 'it', label: 'Italiano' },
  { id: 'nl', label: 'Nederlands' },
  { id: 'pt', label: 'Português' },
  { id: 'da', label: 'Dansk' },
  { id: 'sv', label: 'Svenska' },
  { id: 'nb', label: 'Norsk' },
  { id: 'fi', label: 'Suomi' },
];

const cache = new Map<string, string[]>();

function intlList(key: string, build: () => string[]): string[] {
  let v = cache.get(key);
  if (!v) {
    v = build();
    cache.set(key, v);
  }
  return v;
}

function intlMonths(locale: string, style: 'long' | 'short'): string[] {
  return intlList(`m|${locale}|${style}`, () => {
    const fmt = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, m) => fmt.format(Date.UTC(2027, m, 15)));
  });
}

/** Index 0 = Sonntag (wie Date.getUTCDay). 1.1.2023 war ein Sonntag. */
function intlWeekdays(locale: string, style: 'long' | 'short' | 'narrow'): string[] {
  return intlList(`w|${locale}|${style}`, () => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, d) => fmt.format(Date.UTC(2023, 0, 1 + d)));
  });
}

export function applyCase(text: string, textCase: TextCase, locale = 'de'): string {
  if (textCase === 'upper') return text.toLocaleUpperCase(locale);
  if (textCase === 'lower') return text.toLocaleLowerCase(locale);
  return text.length ? text[0].toLocaleUpperCase(locale) + text.slice(1) : text;
}

export function monthName(general: GeneralConfig, month: number, format: MonthFormat): string {
  if (format === 'numeric') return pad2(month + 1);
  if (general.customNames) {
    const name = general.monthNames[month] ?? '';
    return format === 'short' ? name.slice(0, 3) : name;
  }
  return intlMonths(general.locale, format)[month];
}

/** dow: 0 = Sonntag … 6 = Samstag */
export function weekdayName(general: GeneralConfig, dow: number, format: WeekdayFormat): string {
  if (general.customNames) {
    // Eigene Namen sind ab Montag gespeichert und werden unverändert verwendet.
    return general.weekdayNames[(dow + 6) % 7] ?? '';
  }
  switch (format) {
    case 'long':
      return intlWeekdays(general.locale, 'long')[dow];
    case 'short':
      return intlWeekdays(general.locale, 'short')[dow];
    case 'narrow':
      return intlWeekdays(general.locale, 'narrow')[dow];
    case 'two':
    default:
      return Array.from(intlWeekdays(general.locale, 'long')[dow]).slice(0, 2).join('');
  }
}

/** Monatsnamen in der gewählten Sprache – als Startwert für eigene Bezeichnungen. */
export function localeMonthNames(locale: string): string[] {
  return intlMonths(locale, 'long').map((n) => applyCase(n, 'auto', locale));
}

export function localeWeekdayNames(locale: string): string[] {
  const names = intlWeekdays(locale, 'long');
  return [1, 2, 3, 4, 5, 6, 0].map((d) => applyCase(names[d], 'auto', locale));
}
