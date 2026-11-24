// Häufige Fragen – erscheinen sichtbar auf der Startseite und als strukturierte Daten (FAQPage).
// Hier ändern, beides wird beim Build aus diesen Listen erzeugt.

export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQ_DE: FaqEntry[] = [
  {
    q: 'Was ist ein Kalendarium?',
    a: 'Das Kalendarium ist der Datumsteil eines Kalenders – das Raster aus Wochentagen und Tageszahlen. Bei Fotokalendern liegt es meist als eigene Grafik auf oder unter dem Foto.',
  },
  {
    q: 'Ist MonthGrid kostenlos?',
    a: 'Ja. Du kannst ohne Anmeldung beliebig viele Kalendarien gestalten und als PNG oder SVG herunterladen.',
  },
  {
    q: 'Werden meine Daten oder Fotos hochgeladen?',
    a: 'Nein. Alles wird direkt in deinem Browser berechnet. Einstellungen, eigene Schriften und Vorschaufotos bleiben auf deinem Gerät.',
  },
  {
    q: 'Welche Auflösung brauche ich für den Druck?',
    a: 'Für den Druck reichen meist 300 dpi, wählbar sind auch 150 oder 600 dpi. Die Auflösung steht in der PNG-Datei, damit Layoutprogramme die richtige Größe in Millimetern übernehmen. SVG-Dateien lassen sich ohne Qualitätsverlust beliebig skalieren.',
  },
  {
    q: 'Kann ich die Grafiken in Canva, InDesign oder Affinity verwenden?',
    a: 'Ja. Die PNG-Dateien haben einen transparenten Hintergrund und lassen sich direkt auf dein Foto legen. SVG-Dateien kannst du in Vektorprogrammen weiterbearbeiten.',
  },
  {
    q: 'Wie werden alle 12 Monate gleich groß?',
    a: 'Stelle unter „Raster & Größe“ die Wochen pro Monat auf „Immer 6“. Dann haben alle Monatsgrafiken exakt dieselben Maße.',
  },
  {
    q: 'Kann ich Feiertage und eigene Termine eintragen?',
    a: 'Ja. Gesetzliche Feiertage für Deutschland (bundesweit oder je Bundesland), Österreich und die Schweiz lassen sich hervorheben und beschriften. Eigene Termine wie Geburtstage trägst du einfach als Liste ein.',
  },
  {
    q: 'Kann ich eigene Schriften verwenden?',
    a: 'Ja. Neben über 50 mitgelieferten Schriften kannst du eigene Schriftdateien (TTF, OTF, WOFF) laden. In Chrome und Edge lassen sich auch die auf deinem Computer installierten Schriften nutzen.',
  },
];

export const FAQ_EN: FaqEntry[] = [
  {
    q: 'What is a calendar grid?',
    a: 'The calendar grid is the date part of a calendar – the layout of weekdays and day numbers. For photo calendars it is usually a separate graphic placed on or below the photo.',
  },
  {
    q: 'Is MonthGrid free?',
    a: 'Yes. You can design as many calendar grids as you like without signing up and download them as PNG or SVG.',
  },
  {
    q: 'Are my data or photos uploaded?',
    a: 'No. Everything is computed right in your browser. Settings, your own fonts and preview photos stay on your device.',
  },
  {
    q: 'What resolution do I need for printing?',
    a: '300 dpi is usually enough for print; 150 and 600 dpi are available too. The resolution is stored in the PNG file so layout programs pick up the right size in millimeters. SVG files scale to any size without losing quality.',
  },
  {
    q: 'Can I use the graphics in Canva, InDesign or Affinity?',
    a: 'Yes. The PNG files have a transparent background and can be placed directly on your photo. SVG files can be edited further in vector programs.',
  },
  {
    q: 'How do I make all 12 months the same size?',
    a: 'Under “Grid & size”, set the weeks per month to “Always 6”. Then every month graphic has exactly the same dimensions.',
  },
  {
    q: 'Can I add holidays and my own dates?',
    a: 'Yes. Public holidays for Germany (nationwide or per state), Austria and Switzerland can be highlighted and labeled. Add your own dates such as birthdays as a simple list.',
  },
  {
    q: 'Can I use my own fonts?',
    a: 'Yes. Besides more than 50 included fonts you can load your own font files (TTF, OTF, WOFF). In Chrome and Edge you can also use the fonts installed on your computer.',
  },
];
