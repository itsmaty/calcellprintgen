// Vite-Plugin für SEO und Analytics:
// - ersetzt %YEAR%, %BUILD_YEAR% und %SITE_URL% in allen HTML-Seiten
// - entfernt Tags, die eine absolute Adresse brauchen, wenn SITE_URL fehlt
// - fügt FAQ (<!--FAQ-->), strukturierte Daten (<!--JSONLD-->) und Rybbit (<!--ANALYTICS-->) ein,
//   jeweils in der Sprache der Seite (<html lang="de"> bzw. "en")
// - erzeugt robots.txt und sitemap.xml (mit beiden Sprachversionen)

import type { Plugin } from 'vite';
import { FAQ_DE, FAQ_EN, type FaqEntry } from './faq.ts';

export interface SeoOptions {
  /** Öffentliche Adresse ohne abschließenden Schrägstrich, z. B. https://monthgrid.verzonex.com */
  siteUrl: string;
  /** Jahr, für das die Seite wirbt (Titel, Beschreibung) */
  year: number;
  /** Rybbit-Script-Adresse, z. B. https://app.rybbit.io/api/script.js */
  rybbitScriptUrl: string;
  rybbitSiteId: string;
  /** Analytics nur im echten Produktions-Build einbinden */
  analytics: boolean;
  /** robots.txt/sitemap.xml erzeugen (nicht für die Einzeldatei) */
  emitCrawlerFiles: boolean;
  /** SVG-Quelltext des Favicons: wird eingebettet, Links auf weitere Icons/Manifest entfallen */
  inlineFavicon?: string;
}

type Lang = 'de' | 'en';

/** Pfade der Sprachversionen (für hreflang, Sitemap, strukturierte Daten) */
const PAGES: Record<Lang, string> = { de: '/', en: '/en/' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function faqHtml(faq: FaqEntry[]): string {
  return faq
    .map((f) => `        <details class="faq-item">\n          <summary>${escapeHtml(f.q)}</summary>\n          <p>${escapeHtml(f.a)}</p>\n        </details>`)
    .join('\n');
}

function jsonLd(lang: Lang, siteUrl: string, year: number): string {
  const de = lang === 'de';
  const app: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: de ? 'MonthGrid – Kalendarium-Generator für Fotokalender' : 'MonthGrid – Calendar Grid Generator',
    alternateName: 'MonthGrid',
    description: de
      ? `Kostenloser Online-Generator für Kalendarien und Kalenderzellen ${year}: Form, Farben, Schriften und Feiertage einstellen und alle 12 Monate als transparente PNG (300 dpi) oder SVG herunterladen.`
      : `Free online calendar grid generator for ${year}: set shapes, colors, fonts and holidays and download all 12 months as transparent PNG (300 dpi) or SVG.`,
    applicationCategory: 'DesignApplication',
    operatingSystem: de ? 'Alle (läuft im Browser)' : 'Any (runs in the browser)',
    browserRequirements: de ? 'Benötigt JavaScript und einen aktuellen Browser' : 'Requires JavaScript and a modern browser',
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    featureList: de
      ? [
          'Kalendarium für alle 12 Monate als PNG oder SVG',
          'Transparenter Hintergrund, 150 bis 600 dpi',
          'Formen: Rechteck, schräg, Kreis, Ellipse, Squircle, Sechseck',
          'Feiertage für Deutschland, Österreich und die Schweiz',
          'Über 50 Schriften und eigene Schriftdateien',
          'Kalenderwochen, Notizlinien, eigene Termine',
        ]
      : [
          'Calendar grid for all 12 months as PNG or SVG',
          'Transparent background, 150 to 600 dpi',
          'Shapes: rectangle, slanted, circle, ellipse, squircle, hexagon',
          'Holidays for Germany, Austria and Switzerland',
          'More than 50 fonts plus your own font files',
          'Week numbers, note lines, custom dates',
        ],
  };
  if (siteUrl) {
    app.url = `${siteUrl}${PAGES[lang]}`;
    app.image = `${siteUrl}/${de ? 'og-image.png' : 'og-image-en.png'}`;
    app.screenshot = app.image;
  }
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: (de ? FAQ_DE : FAQ_EN).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  // „</“ maskieren, damit der Inhalt das <script>-Element nicht beenden kann
  const json = JSON.stringify([app, faq], null, 2).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">\n${json}\n    </script>`;
}

function analyticsTag(opts: SeoOptions): string {
  if (!opts.analytics || !opts.rybbitScriptUrl || !opts.rybbitSiteId) return '';
  const sep = opts.rybbitScriptUrl.includes('?') ? '&' : '?';
  const src = `${opts.rybbitScriptUrl}${sep}siteId=${encodeURIComponent(opts.rybbitSiteId)}`;
  return `<script src="${escapeHtml(src)}" defer></script>`;
}

export function seo(options: SeoOptions): Plugin {
  const siteUrl = options.siteUrl.trim().replace(/\/+$/, '');
  let warned = false;
  return {
    name: 'monthgrid-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const lang: Lang = /<html[^>]*\blang="en/i.test(html) ? 'en' : 'de';
        let out = html.replace(/%YEAR%/g, String(options.year)).replace(/%BUILD_YEAR%/g, String(new Date().getFullYear()));
        if (siteUrl) {
          out = out.replace(/%SITE_URL%/g, siteUrl);
        } else {
          // ohne bekannte Adresse: Canonical, hreflang, og:url, og:image … weglassen statt falsch zu befüllen
          out = out.replace(/^[ \t]*<(?:link|meta)\b[^>]*%SITE_URL%[^>]*>[ \t]*\r?\n/gm, '');
          if (!warned && ctx.server === undefined) {
            warned = true;
            console.warn('\n[monthgrid-seo] SITE_URL ist nicht gesetzt – Canonical, hreflang, Open-Graph-Bild und Sitemap fehlen im Build.\n');
          }
        }
        out = out.replace('<!--FAQ-->', faqHtml(lang === 'de' ? FAQ_DE : FAQ_EN));
        out = out.replace('<!--JSONLD-->', jsonLd(lang, siteUrl, options.year));
        out = out.replace('<!--ANALYTICS-->', analyticsTag(options));
        if (options.inlineFavicon) {
          const dataUri = `data:image/svg+xml,${encodeURIComponent(options.inlineFavicon.trim())}`;
          out = out
            .replace(/^[ \t]*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>[ \t]*\r?\n/gm, '')
            .replace(/^[ \t]*<link rel="alternate" hreflang[^>]*>[ \t]*\r?\n/gm, '')
            .replace('</title>', `</title>\n    <link rel="icon" href="${dataUri}" type="image/svg+xml" />`);
        }
        if (/impressum\.html$/.test(ctx.filename) && ctx.server === undefined && /\[(Vorname|Straße|PLZ|E-Mail)/.test(out)) {
          console.warn('\n[monthgrid-seo] Hinweis: impressum.html enthält noch Platzhalter in [eckigen Klammern].\n');
        }
        return out;
      },
    },
    generateBundle() {
      if (!options.emitCrawlerFiles) return;
      const robots = ['User-agent: *', 'Allow: /', ...(siteUrl ? ['', `Sitemap: ${siteUrl}/sitemap.xml`] : []), ''].join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      if (siteUrl) {
        const today = new Date().toISOString().slice(0, 10);
        const alternates = (Object.keys(PAGES) as Lang[])
          .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${siteUrl}${PAGES[l]}"/>`)
          .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${PAGES.en}"/>`)
          .join('\n');
        const urls = (Object.keys(PAGES) as Lang[]).map((l) =>
          ['  <url>', `    <loc>${siteUrl}${PAGES[l]}</loc>`, alternates, `    <lastmod>${today}</lastmod>`, '    <changefreq>monthly</changefreq>', `    <priority>${l === 'de' ? '1.0' : '0.9'}</priority>`, '  </url>'].join('\n'),
        );
        const sitemap = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...urls,
          '</urlset>',
          '',
        ].join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
      }
    },
  };
}
