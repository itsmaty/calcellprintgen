# CalCell PrintGen – Kalenderzellen für den Druck

Web-App, die für ein ganzes Jahr **12 Grafiken mit Kalenderzellen** erzeugt: Kopfzeile Montag–Sonntag und
ein Kästchen pro Tag, als **PNG (hochauflösend, transparent)** oder **SVG (Vektor)**. Die Grafiken legst du
anschließend in deinem Layoutprogramm (InDesign, Affinity, Canva, Photoshop …) auf deine Kalenderfotos.

Alles läuft **lokal im Browser** – es wird nichts hochgeladen.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
```

```bash
npm run dev
```

Dann die angezeigte Adresse öffnen (normalerweise http://localhost:5317).

### Als einzelne Datei (ohne Server)

```bash
npm run build:standalone
```

Ergebnis: `dist-standalone/CalCell-PrintGen.html` – eine einzige Datei (ca. 7 MB, alle Schriften enthalten),
die per Doppelklick im Browser läuft und sich auch weitergeben lässt.

## So funktioniert's

1. **Jahr** oben wählen (Standard: nächstes Jahr).
2. Links die Zellen gestalten – oder oben unter **Vorlagen** einen Look wählen und anpassen.
3. **Exportieren**: Format, Auflösung, Monate und Dateinamen wählen → ZIP-Datei, direkt in einen Ordner
   (Chrome/Edge) oder als Einzeldateien.

Alle Einstellungen werden automatisch im Browser gespeichert. Über **⋯** lassen sie sich als JSON-Datei
sichern und wieder laden. Rückgängig/Wiederholen: ⌘Z / ⇧⌘Z (Windows: Strg+Z / Strg+Y).

**Tipp:** Über das Bild-Symbol in der Vorschau-Leiste kannst du ein eigenes Foto als Hintergrund laden, um
zu sehen, wie die Zellen auf deinem Motiv wirken. Das Foto wird nicht exportiert.

## Einstellungen (Auswahl)

| Bereich | Möglichkeiten |
| --- | --- |
| Kalender | Jahr, Sprache (u. a. Deutsch, „Jänner“ für Österreich, Englisch, Französisch …), Wochenbeginn Mo/So/Sa, eigene Monats- und Tagesnamen |
| Raster & Größe | Zellbreite/-höhe **oder** feste Gesamtgröße (A4, A3 …), Abstände, Rand, 4–6 oder immer 6 Wochen, transparenter oder farbiger Hintergrund |
| Überlauftage | Tage der Nachbarmonate **ausgegraut**, als **leere Kästchen** oder **ausgeblendet**; Deckkraft und eigene Farben |
| Zellform | Rechteck, **schräg (Parallelogramm, Neigung in Grad, Schrift optional mitgeneigt)**, Kreis, Ellipse, Squircle, Sechseck oder keine Form; Größe der Form; Ecken rund, abgeschrägt, nach innen gewölbt oder als Kerbe – auch einzeln je Ecke |
| Füllung, Rahmen, Schatten | Farbe oder Verlauf, Deckkraft; Rahmen (Stärke in pt, Linie/gestrichelt/gepunktet, einzelne Seiten) oder gemeinsames Tabellenraster; Schlagschatten mit Versatz, Weichzeichnung, Farbe |
| Tageszahl | Schrift, Schnitt, Größe, Farbe, Laufweite, Position (9 Ankerpunkte) und Abstände, Text davor/danach (z. B. „1.“), führende Null, Badge (Kreis/Quadrat) hinter der Zahl |
| Kopfzeile | Wochentage als „Montag“, „Mo.“, „Mo“ oder „M“; Schreibweise; im gleichen Kästchen-Stil wie die Tageszellen, als Farbfläche, Balken oder ohne Hintergrund; zu lange Namen werden automatisch gemeinsam verkleinert |
| Wochentag in der Zelle | optional zusätzlich in jedem Kästchen |
| Monatstitel | optional über oder unter dem Raster, mit Jahreszahl in eigener Schrift/Farbe |
| Wochenende & Feiertage | eigene Farben für Samstag, Sonntag, Feiertage (Zahl, Füllung, Rahmen, Beschriftung, Badge) |
| Feiertage & Einträge | gesetzliche Feiertage für Deutschland (bundesweit oder je Bundesland), Österreich, Schweiz; optional Gedenktage (Muttertag, Zeitumstellung …); eigene Einträge wie Geburtstage (`24.12. Heiligabend`, `!15.08. Urlaub` zum Hervorheben) |
| Notizlinien, Kalenderwochen | Schreiblinien in den Zellen; KW-Spalte links oder rechts |

## Druck-Hinweise

- **PNG**: 150, 300 oder 600 dpi (frei einstellbar). Die Auflösung wird in die Datei geschrieben, damit
  Layoutprogramme die richtige Größe in mm erkennen. Hintergrund standardmäßig transparent.
- **SVG**: Maße in mm, Text standardmäßig in Pfade umgewandelt (keine Schriften nötig). Ebenen sind benannt
  (`kopfzeile`, `zellen`, `schatten`, …). Optional bleibt Text editierbar – dann muss die Schrift beim Öffnen
  installiert sein.
- **Gleich große Bilder für alle Monate**: „Wochen pro Monat → Immer 6“ wählen. Bei „Nach Bedarf“ sind
  Monate mit 4, 5 oder 6 Wochen unterschiedlich hoch (Breite und Zellgröße bleiben gleich).
- Das Raster sitzt in allen Monaten an derselben Stelle, auch mit Monatstitel.

## Schriften

- **Schriften dieses PCs**: Mit `npm run dev` (oder `npm run preview`) liest der lokale Server die
  installierten Schriften ein (macOS, Windows, Linux). Sie stehen im Schriftwähler unter
  **„Auf diesem PC installiert“** – in jedem Browser und mit Text-als-Pfad für den Druck.
- **Nicht installierte Schriftdateien** einfach in den Ordner `lokale-schriften/` im Projekt legen und im
  Schriftwähler „PC-Schriften neu einlesen“ klicken. Der Ordnerinhalt wird nicht ins Git aufgenommen.
- **53 mitgelieferte Schriften** (Google Fonts, freie Lizenzen, siehe `src/assets/fonts/LICENSES.md`).
- **Eigene Schriftdateien hochladen** (TTF, OTF, WOFF, TTC – auch variable Schriften) über „Schriftdatei …“;
  sie werden im Browser gespeichert. Das funktioniert auch in der Einzeldatei-Version ohne Server.
- **Fehlende Zeichen** (z. B. bei Demo-Schriften ohne Punkt) werden automatisch aus Inter in passender
  Strichstärke ergänzt; der Schriftwähler zeigt an, welche Zeichen fehlen.
- In der Einzeldatei-Version (ohne Server) gibt es stattdessen „Installierte Schriften“ (Chrome/Edge) bzw.
  „Per Name …“ (dann bleibt der Text im SVG editierbarer Text).
- WOFF2 wird nicht unterstützt – bitte als TTF/OTF/WOFF verwenden.

Weitere Schriften mitliefern: Eintrag in `scripts/fetch-fonts.mjs` ergänzen und `npm run fonts` ausführen.

## Entwicklung

```bash
npm test
```

```bash
npm run build
```

- `src/calendar/` – Monatsraster, Kalenderwochen, Feiertage, Monats-/Tagesnamen
- `src/render/` – Formen, Text als Pfade (opentype.js), SVG-Erzeugung pro Monat
- `src/export/` – PNG-Rasterung mit DPI, ZIP, Speichern in Ordner
- `src/fonts/` – Schriftverwaltung (mitgeliefert, Upload, installiert)
- `server/localFonts.ts` – Vite-Plugin, das die installierten Schriften des PCs bereitstellt (nur localhost)
- `src/ui/`, `src/App.tsx` – Oberfläche (React)
- `src/config/` – Einstellungsmodell, Standardwerte, Vorlagen
