import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { localFonts } from './server/localFonts';

// `npm run build`            → dist/ (statische Dateien, z. B. für `npm run preview` oder einen Webserver)
// `npm run build:standalone` → dist-standalone/CalCell-PrintGen.html (eine einzige Datei inkl. Schriften,
//                               läuft per Doppelklick ohne Server)
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    // localFonts: installierte PC-Schriften + Ordner „lokale-schriften/“ (nur Dev-Server und `vite preview`)
    plugins: [react(), localFonts(fileURLToPath(new URL('.', import.meta.url))), ...(standalone ? [viteSingleFile()] : [])],
    // Relative Pfade, damit der Build aus jedem Ordner bzw. von jedem statischen Server läuft.
    base: './',
    build: {
      target: 'es2022',
      outDir: standalone ? 'dist-standalone' : 'dist',
      chunkSizeWarningLimit: standalone ? 20_000 : 1500,
      // In der Einzeldatei werden auch die Schriften als data:-URLs eingebettet.
      assetsInlineLimit: standalone ? 100_000_000 : 4096,
    },
    server: {
      port: 5317,
    },
  };
});
