// Anonyme Nutzungsereignisse für Rybbit (https://rybbit.com).
// Das Script wird nur im Produktions-Build eingebunden (siehe server/seo.ts). Ohne Script – in der
// Entwicklung, in der Einzeldatei oder nach Widerspruch – passiert hier nichts.
// Keine Kalenderinhalte, Termine oder Dateinamen senden – nur Einstellungen wie Format oder dpi.

type EventProps = Record<string, string | number>;

declare global {
  interface Window {
    rybbit?: { event: (name: string, properties?: EventProps) => void };
  }
}

export function track(name: string, props?: EventProps): void {
  try {
    window.rybbit?.event(name, props);
  } catch {
    /* Statistik darf die App nie stören */
  }
}
