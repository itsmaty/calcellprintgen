import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Config, FontRef } from './config/types';
import { createDefaultConfig, normalizeConfig } from './config/defaults';
import { PRESETS, applyPreset, type Preset } from './config/presets';
import { DEFAULT_FAMILY, fontRegistry } from './fonts/registry';
import type { LoadedFont } from './fonts/loaded';
import { computeGeometry, createYearContext, renderMonth } from './render/month';
import { setGlyphFallback } from './render/text';
import { buildExportFiles, downloadBlob, toBlob } from './export/exporter';
import { Sidebar, type Update } from './ui/Sidebar';
import { Preview, svgDataUrl } from './ui/Preview';
import { ExportDialog } from './ui/ExportDialog';
import { useRegistryVersion } from './ui/FontPicker';
import { useBackdropPhoto } from './ui/backdrop';
import { IconChevron, IconChevronLeft, IconDownload, IconMore, IconRedo, IconSparkles, IconUndo } from './ui/icons';

const STORAGE_KEY = 'calcellprintgen:config:v1';

function loadStoredConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch {
    /* kaputte Daten → Standard */
  }
  return createDefaultConfig();
}

function resolveFont(ref: FontRef): LoadedFont {
  return fontRegistry.peek(ref) ?? fontRegistry.peek({ family: DEFAULT_FAMILY, face: '400' })!;
}

function fontRefsOf(cfg: Config): FontRef[] {
  return [cfg.dayNumber.font, cfg.weekday.font, cfg.header.font, cfg.title.font, cfg.title.yearFont, cfg.weekNumbers.font, cfg.holidays.font];
}

/**
 * Lädt alle Schriften, die die Konfiguration verwendet (Fortschritt kommt über die Registry-Version).
 * Läuft auch erneut, wenn sich die Registry ändert – z. B. wenn eine Schriftfamilie erst später verfügbar wird.
 */
function useEnsureFonts(cfg: Config, registryVersion: number) {
  const refs = fontRefsOf(cfg);
  const key = refs.map((r) => `${r.family}|${r.face}`).join(',');
  useEffect(() => {
    for (const r of refs) fontRegistry.ensure(r).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, registryVersion]);
}

// ---------- Verlauf (Rückgängig / Wiederholen) ----------

interface HistoryState {
  past: Config[];
  present: Config;
  future: Config[];
}

function useHistory(init: () => Config) {
  const [state, setState] = useState<HistoryState>(() => ({ past: [], present: init(), future: [] }));
  const lastChange = useRef(0);
  const set = useCallback((fn: (c: Config) => Config) => {
    const now = Date.now();
    // schnelle Folgeänderungen (z. B. Schieberegler) zu einem Schritt zusammenfassen
    const coalesce = now - lastChange.current < 700;
    lastChange.current = now;
    setState((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      return { past: coalesce && s.past.length ? s.past : [...s.past.slice(-80), s.present], present: next, future: [] };
    });
  }, []);
  const replace = useCallback((next: Config) => {
    lastChange.current = 0;
    setState((s) => ({ past: [...s.past.slice(-80), s.present], present: next, future: [] }));
  }, []);
  const undo = useCallback(() => {
    lastChange.current = 0;
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    lastChange.current = 0;
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);
  return { cfg: state.present, set, replace, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

// ---------- App ----------

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([fontRegistry.init(), fontRegistry.ensure({ family: DEFAULT_FAMILY, face: '400' }), fontRegistry.ensure({ family: DEFAULT_FAMILY, face: '700' })])
      .then(() => {
        // Zeichen, die einer Schrift fehlen, aus Inter im optisch passenden Gewicht ergänzen
        setGlyphFallback((weight) => {
          const ref = { family: DEFAULT_FAMILY, face: String(Math.min(900, Math.max(300, Math.round(weight / 100) * 100))) };
          const exact = fontRegistry.peek(ref);
          if (exact) return exact;
          fontRegistry.ensure(ref).catch(() => undefined); // wird nachgeladen, danach neu gezeichnet
          return fontRegistry.peek({ family: DEFAULT_FAMILY, face: weight >= 600 ? '700' : '400' });
        });
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <div className="splash is-error">Fehler beim Laden: {error}</div>;
  if (!ready)
    return (
      <div className="splash">
        <div className="spinner" /> Lade Schriften …
      </div>
    );
  return <Editor />;
}

function initialMonth(year: number): number {
  const now = new Date();
  return now.getFullYear() === year ? now.getMonth() : 0;
}

function Editor() {
  const { cfg, set, replace, undo, redo, canUndo, canRedo } = useHistory(loadStoredConfig);
  const update: Update = useCallback((section, patch) => set((c) => ({ ...c, [section]: { ...c[section], ...patch } })), [set]);
  const registryVersion = useRegistryVersion();
  useEnsureFonts(cfg, registryVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => createYearContext(cfg, resolveFont), [cfg, registryVersion]);
  const thumbCtx = useDeferredValue(ctx);
  const [month, setMonth] = useState(() => initialMonth(cfg.general.year));
  const geometry = useMemo(() => computeGeometry(ctx, month), [ctx, month]);
  const [exportOpen, setExportOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);

  // Automatisch im Browser speichern
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      } catch {
        /* Speicher voll o. ä. */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [cfg]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Tastenkürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement;
      if (target.closest('input[type="text"], textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 'e') {
        e.preventDefault();
        setExportOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Für automatische Tests im Entwicklungsmodus
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__calcell = {
      getConfig: () => cfg,
      setConfig: (c: unknown) => replace(normalizeConfig(c)),
      ctx,
      renderMonth,
      buildExportFiles,
      fontRegistry,
      presets: PRESETS,
      applyPreset: (id: string) => {
        const p = PRESETS.find((x) => x.id === id);
        if (p) replace(applyPreset(cfg, p));
      },
    };
  }, [cfg, ctx, replace]);

  const downloadCurrent = async (format: 'png' | 'svg') => {
    setDownloading(true);
    try {
      const files = await buildExportFiles(ctx, [month], format, cfg.output.dpi, cfg.output.textAsPaths);
      downloadBlob(toBlob(files[0]), files[0].name);
      setToast({ text: `${files[0].name} gespeichert.` });
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : String(err), warn: true });
    } finally {
      setDownloading(false);
    }
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `calcell-einstellungen-${cfg.general.year}.json`);
  };

  const importSettings = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      replace(normalizeConfig(data));
      setToast({ text: 'Einstellungen geladen.' });
    } catch {
      setToast({ text: 'Die Datei enthält keine gültigen Einstellungen.', warn: true });
    }
  };

  const year = cfg.general.year;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="4" width="28" height="26" rx="5" fill="var(--accent)" />
            <rect x="2" y="4" width="28" height="8" rx="4" fill="var(--accent-2)" />
            <g fill="#fff">
              <rect x="6" y="15" width="5" height="5" rx="1.2" />
              <rect x="13.5" y="15" width="5" height="5" rx="1.2" />
              <rect x="21" y="15" width="5" height="5" rx="1.2" />
              <rect x="6" y="22" width="5" height="5" rx="1.2" />
              <rect x="13.5" y="22" width="5" height="5" rx="1.2" />
            </g>
          </svg>
          <div className="brand-text">
            <b>CalCell PrintGen</b>
            <span>Kalenderzellen für den Druck</span>
          </div>
        </div>
        <div className="year-stepper" title="Jahr">
          <button type="button" className="icon-btn" onClick={() => update('general', { year: year - 1 })} title="Vorjahr">
            <IconChevronLeft size={16} />
          </button>
          <span className="year-value">{year}</span>
          <button type="button" className="icon-btn" onClick={() => update('general', { year: year + 1 })} title="Folgejahr">
            <IconChevron size={16} />
          </button>
        </div>
        <div className="topbar-actions">
          <PresetMenu cfg={cfg} month={month} onApply={(p) => replace(applyPreset(cfg, p))} />
          <div className="btn-group">
            <button type="button" className="icon-btn" onClick={undo} disabled={!canUndo} title="Rückgängig (⌘Z)">
              <IconUndo size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={redo} disabled={!canRedo} title="Wiederholen (⇧⌘Z)">
              <IconRedo size={16} />
            </button>
          </div>
          <MoreMenu
            onExportSettings={exportSettings}
            onImportSettings={importSettings}
            onReset={() => {
              if (confirm('Alle Einstellungen auf den Standard zurücksetzen? (Rückgängig ist möglich)')) {
                replace(createDefaultConfig());
                setToast({ text: 'Auf Standard zurückgesetzt.' });
              }
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => setExportOpen(true)} title="Exportieren (⌘E)">
            <IconDownload size={15} /> Exportieren
          </button>
        </div>
      </header>
      <Sidebar cfg={cfg} update={update} geometry={geometry} />
      <Preview cfg={cfg} ctx={ctx} thumbCtx={thumbCtx} month={month} onMonth={setMonth} onDownload={downloadCurrent} downloading={downloading} />
      {exportOpen && <ExportDialog cfg={cfg} ctx={ctx} update={update} onClose={() => setExportOpen(false)} />}
      {toast && <div className={`toast${toast.warn ? ' is-warn' : ''}`}>{toast.text}</div>}
    </div>
  );
}

// ---------- Menüs ----------

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function PresetMenu(props: { cfg: Config; month: number; onApply: (p: Preset) => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutsideClose(open, close);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className={`btn${open ? ' is-active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <IconSparkles size={15} /> Vorlagen
      </button>
      {open && <PresetList cfg={props.cfg} month={props.month} onApply={(p) => (props.onApply(p), close())} />}
    </div>
  );
}

function PresetList(props: { cfg: Config; month: number; onApply: (p: Preset) => void }) {
  const registryVersion = useRegistryVersion();
  const photo = useBackdropPhoto();
  const configs = useMemo(() => PRESETS.map((p) => applyPreset(props.cfg, p)), [props.cfg]);
  useEffect(() => {
    for (const c of configs) for (const r of fontRefsOf(c)) fontRegistry.ensure(r).catch(() => undefined);
  }, [configs]);
  const previews = useMemo(
    () =>
      configs.map((c) => {
        const ready = fontRefsOf(c).every((r) => fontRegistry.peek(r));
        if (!ready) return null;
        const ctx = createYearContext({ ...c, output: { ...c.output, background: 'transparent' } }, resolveFont);
        return svgDataUrl(renderMonth(ctx, props.month, { textMode: 'path' }).svg);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configs, props.month, registryVersion],
  );
  return (
    <div className="menu preset-menu">
      <div className="menu-title">Vorlage anwenden</div>
      <div className="menu-note">Jahr, Sprache, Feiertage, eigene Einträge und Export bleiben erhalten. Rückgängig mit ⌘Z.</div>
      <div className="preset-grid">
        {PRESETS.map((p, i) => (
          <button type="button" key={p.id} className="preset" onClick={() => props.onApply(p)}>
            <span className="preset-img" style={photo ? { backgroundImage: `url("${photo}")` } : undefined}>
              {previews[i] ? <img src={previews[i]!} alt="" /> : <span className="spinner is-small" />}
            </span>
            <span className="preset-name">{p.name}</span>
            <span className="preset-desc">{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MoreMenu(props: { onExportSettings: () => void; onImportSettings: (f: File) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutsideClose(open, close);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className={`icon-btn${open ? ' is-active' : ''}`} onClick={() => setOpen((o) => !o)} title="Weitere Aktionen">
        <IconMore size={18} />
      </button>
      {open && (
        <div className="menu menu-list">
          <button
            type="button"
            onClick={() => {
              props.onExportSettings();
              close();
            }}
          >
            Einstellungen speichern (.json)
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Einstellungen laden …
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              close();
              props.onReset();
            }}
          >
            Alles zurücksetzen
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onImportSettings(f);
          e.target.value = '';
          close();
        }}
      />
    </div>
  );
}
