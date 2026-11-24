// Zweisprachige Oberfläche (Deutsch/Englisch).
// Die deutschen Texte stehen direkt im Code und dienen als Schlüssel; en.ts liefert die Übersetzung.
// Die Sprache steht pro Seitenaufruf fest – ein Wechsel lädt die Seite neu.

import { EN } from './en';

export type Lang = 'de' | 'en';

const STORAGE_KEY = 'monthgrid:lang';

function detect(): Lang {
  if (typeof document === 'undefined') return 'de';
  const pageLang: Lang = document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'de';
  // Website: die Adresse bestimmt die Sprache (/ = Deutsch, /en/ = Englisch)
  if (import.meta.env.MODE !== 'standalone') return pageLang;
  // Einzeldatei: gespeicherte Wahl, sonst Browsersprache
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    /* kein Speicher */
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const lang: Lang = detect();

/** Für Intl-Formatierungen der Oberfläche (Zahlen, Monatsnamen). */
export const uiLocale = lang === 'en' ? 'en-US' : 'de-DE';

const warned = new Set<string>();

/** Übersetzt einen deutschen Text; {name}-Platzhalter werden ersetzt. */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = text;
  if (lang === 'en') {
    const tr = EN[text];
    if (tr !== undefined) out = tr;
    else if (import.meta.env.DEV && !warned.has(text)) {
      warned.add(text);
      console.warn('[i18n] Übersetzung fehlt:', text);
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all));
  return out;
}

/** Zur anderen Sprache wechseln (Website: andere Adresse, Einzeldatei: neu laden). */
export function switchLang(target: Lang): void {
  if (target === lang) return;
  if (import.meta.env.MODE === 'standalone' || location.protocol === 'file:') {
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {
      /* egal */
    }
    location.reload();
    return;
  }
  location.href = target === 'en' ? '/en/' : '/';
}

/** Monatsnamen in der Sprache der Oberfläche (für Reiter und Miniaturen). */
export const UI_MONTHS: string[] = Array.from({ length: 12 }, (_, m) => {
  const name = new Intl.DateTimeFormat(uiLocale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2027, m, 15));
  return name.charAt(0).toLocaleUpperCase(uiLocale) + name.slice(1);
});
