# MonthGrid – Calendar Grid Generator

**Kalendarium-Generator für Fotokalender** · https://monthgrid.verzonex.com

Web-App, die für ein ganzes Jahr **12 Grafiken mit Kalenderzellen** erzeugt: Kopfzeile Montag–Sonntag und
ein Kästchen pro Tag, als **PNG (hochauflösend, transparent)** oder **SVG (Vektor)**. Die Grafiken legst du
anschließend in deinem Layoutprogramm (InDesign, Affinity, Canva, Photoshop …) auf deine Kalenderfotos.

Alles läuft **lokal im Browser** – es wird nichts hochgeladen. Die Oberfläche gibt es auf **Deutsch** (`/`)
und **Englisch** (`/en/`).

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

Ergebnis: `dist-standalone/MonthGrid.html` – eine einzige Datei (ca. 7 MB, alle Schriften enthalten),
die per Doppelklick im Browser läuft und sich auch weitergeben lässt. Die Sprache richtet sich dort nach dem
Browser und lässt sich oben umschalten.

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

- **Schriften dieses PCs**: Mit `npm run dev` liest der lokale Dev-Server die installierten Schriften ein
  (macOS, Windows, Linux). Sie stehen im Schriftwähler unter **„Auf diesem PC installiert“** – in jedem
  Browser und mit Text-als-Pfad für den Druck. Auf der veröffentlichten Website gibt es diesen Weg bewusst
  nicht (der Server soll keine eigenen Schriften ausliefern); dort nutzen Besucher Upload oder
  „Installierte Schriften“ (Chrome/Edge).
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

## Sprachen (Deutsch/Englisch)

- Website: Deutsch unter `/`, Englisch unter `/en/` – jeweils mit eigenem Titel, Beschreibung, Anleitung, FAQ,
  Vorschaubild und gegenseitigen `hreflang`-Verweisen. Der Umschalter **DE | EN** oben wechselt die Seite;
  Einstellungen bleiben erhalten.
- Auf der englischen Seite startet der Kalender mit englischen Monats-/Tagesnamen, ohne „1.“-Punkt und ohne
  deutsche Feiertage. Feiertagsnamen erscheinen auf Englisch, wenn der Kalender auf Englisch steht.
- Texte der Oberfläche: Der deutsche Text steht im Code in `t('…')`, die englische Übersetzung in
  `src/i18n/en.ts`. Der Test `src/i18n/i18n.test.ts` schlägt fehl, wenn eine Übersetzung fehlt.
- Statische Inhalte: `index.html` (Deutsch) und `en/index.html` (Englisch), FAQ in `server/faq.ts`.
- Impressum und Datenschutz gibt es nur auf Deutsch (rechtlich maßgeblich); die englische Seite verlinkt sie.

## Veröffentlichen auf dem eigenen Server (VPS)

Die Website ist rein statisch: `npm run build` erzeugt den Ordner `dist/` (Startseite mit App und
Anleitung, Impressum, Datenschutz, 404-Seite, robots.txt, sitemap.xml, Icons, Vorschaubild).

**1. Einstellungen**

Die Adresse steht in `.env.production` (`SITE_URL=https://monthgrid.verzonex.com`, wird mit eingecheckt).
Die Rybbit-Site-ID trägst du dort ein oder setzt sie beim Deploy als Build-Argument. Außerdem
**`impressum.html` und `datenschutz.html` ausfüllen** – das sind Vorlagen mit Platzhaltern in [eckigen
Klammern] (keine Rechtsberatung). Der Build warnt, solange Platzhalter übrig sind.

Für die Subdomain braucht es einen DNS-Eintrag `monthgrid` (A/AAAA auf die IP des VPS oder CNAME).

**2a. Mit Dokploy**

1. Projekt öffnen → **Create Service → Application**.
2. **Provider: GitHub** (einmalig die Dokploy-GitHub-App verbinden) → Repository `itsmaty/calcellprintgen`,
   Branch `main`, Build Path `/`.
3. **Build Type: Dockerfile** → Dockerfile Path `Dockerfile`, Docker Context Path `.`.
4. Optional **Environment → Build Time Arguments** (eine Zeile pro Wert):
   ```
   RYBBIT_SITE_ID=deine-site-id
   ```
   Bei selbst gehostetem Rybbit zusätzlich `RYBBIT_SCRIPT_URL=https://rybbit.deine-domain/api/script.js`.
   Die Content-Security-Policy erlaubt die Rybbit-Adresse automatisch.
5. **Domains → Add Domain**: Host `monthgrid.verzonex.com`, Path `/`, **Container Port `80`**,
   HTTPS an, Certificate **Let's Encrypt**.
6. **Deploy** klicken. Danach baut Dokploy bei jedem Push auf `main` automatisch neu (Auto Deploy).

**2b. Mit docker compose** – baut die Seite und liefert sie mit nginx aus (Caching, gzip,
Sicherheits-Header inkl. Content-Security-Policy, saubere 404-Antworten):

```bash
docker compose up -d --build
```

Der Container lauscht auf `127.0.0.1:8080`. Für HTTPS davor einen Reverse-Proxy setzen, z. B. Caddy mit
`deploy/Caddyfile.example` (holt Zertifikate automatisch). Werte kommen aus `.env` (Vorlage `.env.example`).

**2c. Ohne Docker** – bauen und per rsync hochladen, ausgeliefert von Caddy oder nginx (Variante B in
`deploy/Caddyfile.example`):

```bash
./deploy/deploy-rsync.sh benutzer@server:/var/www/monthgrid
```

## Statistik mit Rybbit

Rybbit ist cookielos. Im Rybbit-Dashboard (Cloud oder selbst gehostet) eine Website anlegen und die Site-ID
in `.env.production` oder als Build-Argument (Dokploy) eintragen, dann neu bauen. Das Script wird nur im Produktions-Build eingebunden – nicht
beim Entwickeln und nicht in der Einzeldatei. Die Content-Security-Policy im Docker-Image erlaubt die
Rybbit-Domain automatisch.

Zusätzlich zu den Seitenaufrufen sendet die App anonyme Ereignisse (nie Kalenderinhalte oder Termine):

| Ereignis | Eigenschaften |
| --- | --- |
| `export` | `format`, `dpi`, `monate`, `ziel` (zip/folder/files), `form`, `ueberlauf`, `schrift` |
| `export_fehler` | `meldung` (gekürzt) |
| `monat_download` | `format`, `dpi` |
| `vorlage` | `id` |
| `schrift_upload`, `systemschriften`, `schrift_per_name` | Anzahl |
| `vorschau_foto`, `einstellungen_export`, `einstellungen_import`, `zuruecksetzen` | – |

Eigene Besuche ausschließen: in Rybbit unter „IP Exclusions“ oder auf der Datenschutz-Seite den Knopf
„Statistik in diesem Browser deaktivieren“ nutzen (setzt den Local-Storage-Eintrag `disable-rybbit`).

## Google & SEO

Eingebaut sind: Titel und Beschreibung mit Jahreszahl, Canonical-Link, `hreflang` (de/en), Open-Graph-/
Twitter-Vorschau (`public/og-image.png`, `public/og-image-en.png`), strukturierte Daten (WebApplication + FAQ)
je Sprache, sitemap.xml mit beiden Sprachversionen, robots.txt, Web-Manifest und ein Anleitungs-/FAQ-Bereich
unter der App, den Suchmaschinen lesen können. Schwerpunkt-Begriffe: „Kalendarium“ (Deutsch) und
„calendar grid generator“ (Englisch). Die FAQ-Texte stehen in `server/faq.ts`.

Nach dem Livegang:

1. In der [Google Search Console](https://search.google.com/search-console) die Domain bestätigen und
   `https://monthgrid.verzonex.com/sitemap.xml` einreichen; `/` und `/en/` per „URL-Prüfung“ zur Indexierung
   anmelden.
2. Optional dasselbe bei den Bing Webmaster Tools (kann aus der Search Console importieren).
3. Die Jahreszahl im Titel wird beim Build gesetzt (ab Juli automatisch das Folgejahr) – also mindestens
   einmal im Jahr neu bauen, oder `SEO_YEAR` setzen.

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
- `server/localFonts.ts` – Vite-Plugin, das die installierten Schriften des PCs bereitstellt (nur Dev-Server)
- `server/seo.ts`, `server/faq.ts` – Meta-Daten, strukturierte Daten, FAQ, robots.txt, Sitemap, Rybbit
- `index.html`, `en/index.html`, `impressum.html`, `datenschutz.html`, `404.html`, `public/` – Seiten und statische Dateien
- `src/i18n/` – Sprachumschaltung und englische Übersetzung, `src/brand.ts` – Markenname
- `Dockerfile`, `docker-compose.yml`, `deploy/` – Auslieferung mit nginx, Caddy-Vorlage, rsync-Skript
- `src/ui/`, `src/App.tsx` – Oberfläche (React)
- `src/config/` – Einstellungsmodell, Standardwerte, Vorlagen
