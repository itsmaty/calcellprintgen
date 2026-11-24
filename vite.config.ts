import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localFonts } from './server/localFonts.ts';
import { seo } from './server/seo.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Kalender werden fürs nächste Jahr gestaltet – ab Juli wirbt die Seite mit dem Folgejahr. */
function campaignYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

// `npm run build`            → dist/ (für den Server: nginx, Caddy, Docker …)
// `npm run build:standalone` → dist-standalone/MonthGrid.html (eine einzige Datei inkl. Schriften,
//                               läuft per Doppelklick ohne Server)
//
// Einstellungen für den Build kommen aus .env.production / .env bzw. Umgebungsvariablen (siehe .env.example):
//   SITE_URL, RYBBIT_SCRIPT_URL, RYBBIT_SITE_ID, SEO_YEAR
export default defineConfig(({ command, mode }) => {
  const standalone = mode === 'standalone';
  // Leere Build-Argumente (z. B. aus Docker/Dokploy) sollen Werte aus .env.production nicht überschreiben
  for (const key of ['SITE_URL', 'RYBBIT_SCRIPT_URL', 'RYBBIT_SITE_ID', 'SEO_YEAR']) {
    if (process.env[key] !== undefined && process.env[key]!.trim() === '') delete process.env[key];
  }
  const env = loadEnv(mode, root, '');
  return {
    plugins: [
      react(),
      // installierte PC-Schriften + Ordner „lokale-schriften/“ – nur im Dev-Server
      localFonts(root),
      seo({
        siteUrl: env.SITE_URL ?? '',
        year: Number(env.SEO_YEAR) || campaignYear(),
        rybbitScriptUrl: env.RYBBIT_SCRIPT_URL ?? '',
        rybbitSiteId: env.RYBBIT_SITE_ID ?? '',
        analytics: command === 'build' && !standalone,
        emitCrawlerFiles: !standalone,
        // Einzeldatei: Favicon direkt einbetten, Verweise auf weitere Dateien entfernen
        inlineFavicon: standalone ? readFileSync(`${root}public/favicon.svg`, 'utf8') : undefined,
      }),
      ...(standalone ? [viteSingleFile()] : []),
    ],
    // Server: absolute Pfade (auch die 404-Seite funktioniert unter jeder Adresse).
    // Einzeldatei: relative Pfade, damit sie per Doppelklick läuft.
    base: standalone ? './' : '/',
    // Icons, Vorschaubild usw. braucht nur die Website, nicht die Einzeldatei
    publicDir: standalone ? false : 'public',
    build: {
      target: 'es2022',
      outDir: standalone ? 'dist-standalone' : 'dist',
      chunkSizeWarningLimit: standalone ? 20_000 : 1500,
      // In der Einzeldatei werden auch die Schriften als data:-URLs eingebettet.
      assetsInlineLimit: standalone ? 100_000_000 : 4096,
      rollupOptions: standalone
        ? undefined
        : {
            input: {
              main: `${root}index.html`,
              en: `${root}en/index.html`,
              impressum: `${root}impressum.html`,
              datenschutz: `${root}datenschutz.html`,
              notfound: `${root}404.html`,
            },
          },
    },
    server: {
      port: 5317,
    },
  };
});
