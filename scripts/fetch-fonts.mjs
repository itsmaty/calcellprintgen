#!/usr/bin/env node
// Lädt die mitgelieferten Schriften (Latin-Subset, WOFF) von Fontsource herunter
// und schreibt den Katalog nach src/fonts/catalog.json.
//
// Aufruf: npm run fonts
// Schriften hinzufügen: Eintrag in FONTS ergänzen und Skript erneut ausführen.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'src/assets/fonts');
const catalogFile = join(root, 'src/fonts/catalog.json');

// category: sans | serif | display | handwriting | mono
const FONTS = [
  // Serifenlos
  { id: 'inter', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { id: 'roboto', category: 'sans', weights: [300, 400, 500, 700, 900], italic: [400] },
  { id: 'open-sans', category: 'sans', weights: [300, 400, 600, 700, 800] },
  { id: 'montserrat', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], italic: [400, 700] },
  { id: 'poppins', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { id: 'lato', category: 'sans', weights: [300, 400, 700, 900], italic: [400] },
  { id: 'raleway', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { id: 'nunito', category: 'sans', weights: [300, 400, 600, 700, 800, 900] },
  { id: 'work-sans', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { id: 'dm-sans', category: 'sans', weights: [300, 400, 500, 700] },
  { id: 'source-sans-3', category: 'sans', weights: [300, 400, 600, 700] },
  { id: 'ibm-plex-sans', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { id: 'josefin-sans', category: 'sans', weights: [300, 400, 600, 700] },
  { id: 'quicksand', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { id: 'outfit', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { id: 'space-grotesk', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { id: 'manrope', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { id: 'oswald', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { id: 'barlow-condensed', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { id: 'comfortaa', category: 'sans', weights: [300, 400, 500, 600, 700] },
  // Serif
  { id: 'playfair-display', category: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: [400, 700] },
  { id: 'lora', category: 'serif', weights: [400, 500, 600, 700], italic: [400] },
  { id: 'merriweather', category: 'serif', weights: [300, 400, 700, 900], italic: [400] },
  { id: 'eb-garamond', category: 'serif', weights: [400, 500, 600, 700, 800], italic: [400] },
  { id: 'cormorant-garamond', category: 'serif', weights: [300, 400, 500, 600, 700], italic: [400] },
  { id: 'libre-baskerville', category: 'serif', weights: [400, 700], italic: [400] },
  { id: 'bodoni-moda', category: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: [400] },
  { id: 'fraunces', category: 'serif', weights: [300, 400, 600, 700, 900], italic: [400] },
  { id: 'dm-serif-display', category: 'serif', weights: [400], italic: [400] },
  { id: 'roboto-slab', category: 'serif', weights: [300, 400, 500, 700, 900] },
  { id: 'abril-fatface', category: 'serif', weights: [400] },
  // Display
  { id: 'bebas-neue', category: 'display', weights: [400] },
  { id: 'anton', category: 'display', weights: [400] },
  { id: 'staatliches', category: 'display', weights: [400] },
  { id: 'archivo-black', category: 'display', weights: [400] },
  { id: 'alfa-slab-one', category: 'display', weights: [400] },
  { id: 'righteous', category: 'display', weights: [400] },
  { id: 'lobster', category: 'display', weights: [400] },
  { id: 'fredoka', category: 'display', weights: [300, 400, 500, 600, 700] },
  { id: 'syne', category: 'display', weights: [400, 500, 600, 700, 800] },
  // Handschrift
  { id: 'caveat', category: 'handwriting', weights: [400, 500, 600, 700] },
  { id: 'dancing-script', category: 'handwriting', weights: [400, 500, 600, 700] },
  { id: 'pacifico', category: 'handwriting', weights: [400] },
  { id: 'amatic-sc', category: 'handwriting', weights: [400, 700] },
  { id: 'permanent-marker', category: 'handwriting', weights: [400] },
  { id: 'shadows-into-light', category: 'handwriting', weights: [400] },
  { id: 'great-vibes', category: 'handwriting', weights: [400] },
  { id: 'satisfy', category: 'handwriting', weights: [400] },
  { id: 'patrick-hand', category: 'handwriting', weights: [400] },
  // Monospace
  { id: 'jetbrains-mono', category: 'mono', weights: [300, 400, 500, 700] },
  { id: 'space-mono', category: 'mono', weights: [400, 700] },
  { id: 'ibm-plex-mono', category: 'mono', weights: [300, 400, 500, 700] },
  { id: 'courier-prime', category: 'mono', weights: [400, 700] },
];

const SUBSET = 'latin';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, target) {
  if (await exists(target)) return 'cached';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  return `${(buf.length / 1024).toFixed(0)} KB`;
}

const catalog = [];
const licenses = [];
for (const spec of FONTS) {
  const meta = await getJson(`https://api.fontsource.org/v1/fonts/${spec.id}`);
  const variants = [];
  const wanted = [
    ...spec.weights.map((w) => [w, 'normal']),
    ...(spec.italic ?? []).map((w) => [w, 'italic']),
  ];
  for (const [weight, style] of wanted) {
    const entry = meta.variants?.[String(weight)]?.[style]?.[SUBSET];
    if (!entry?.url?.woff) {
      console.warn(`  ! ${meta.family} ${weight} ${style} nicht verfügbar – übersprungen`);
      continue;
    }
    const rel = `${spec.id}/${weight}-${style}.woff`;
    const status = await download(entry.url.woff, join(fontDir, rel));
    console.log(`  ${meta.family} ${weight} ${style}: ${status}`);
    variants.push({ weight, style, file: rel });
  }
  catalog.push({ id: spec.id, family: meta.family, category: spec.category, variants });
  licenses.push(`| ${meta.family} | ${meta.license} | https://fonts.google.com/specimen/${meta.family.replace(/ /g, '+')} |`);
}

await mkdir(dirname(catalogFile), { recursive: true });
await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
await writeFile(
  join(fontDir, 'LICENSES.md'),
  [
    '# Mitgelieferte Schriften',
    '',
    `Alle Schriften stammen von Google Fonts (über Fontsource, Subset „${SUBSET}“, Format WOFF).`,
    'Sie stehen unter freien Lizenzen (SIL Open Font License 1.1 bzw. Apache 2.0) und dürfen',
    'auch kommerziell und im Druck verwendet werden.',
    '',
    '| Schrift | Lizenz | Quelle |',
    '| --- | --- | --- |',
    ...licenses,
    '',
  ].join('\n'),
);
console.log(`\n${catalog.length} Schriftfamilien, ${catalog.reduce((n, f) => n + f.variants.length, 0)} Schnitte → ${catalogFile}`);
