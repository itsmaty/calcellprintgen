import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FontRef } from '../config/types';
import { CATEGORY_LABELS, fontRegistry, isFontInstalled, type FamilyInfo, type FontCategory } from '../fonts/registry';
import { missingGlyphs } from '../render/text';
import { track } from '../analytics';
import { IconChevron, IconClose, IconSearch, IconTrash, IconUpload } from './icons';
import { t } from '../i18n';

export function useRegistryVersion(): number {
  return useSyncExternalStore(
    (cb) => fontRegistry.subscribe(cb),
    () => fontRegistry.version,
  );
}

function usePreviewFamily(familyId: string): string | undefined {
  const [name, setName] = useState<string | undefined>(() => fontRegistry.previewFamilyOf(familyId));
  useEffect(() => {
    let alive = true;
    setName(fontRegistry.previewFamilyOf(familyId));
    fontRegistry.ensurePreview(familyId).then((n) => {
      if (alive) setName(n);
    });
    return () => {
      alive = false;
    };
  }, [familyId]);
  return name;
}

function cleanName(id: string): string {
  return id.replace(/^(up|sys|loc|css):/, '');
}

const GLYPH_TEST = '0123456789.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß';

export function FontPicker(props: { value: FontRef; onChange: (v: FontRef) => void }) {
  useRegistryVersion();
  const resolved = fontRegistry.resolve(props.value);
  const family = fontRegistry.getFamily(resolved.familyId)!;
  const face = family.faces.find((f) => f.key === resolved.faceKey) ?? family.faces[0];
  const preview = usePreviewFamily(resolved.familyId);
  const [open, setOpen] = useState(false);
  const loaded = fontRegistry.peek(props.value);
  const missing = loaded && loaded.familyId === resolved.familyId ? missingGlyphs(loaded, GLYPH_TEST) : [];

  const pickFamily = (familyId: string) => {
    const fam = fontRegistry.getFamily(familyId);
    if (!fam) return;
    // möglichst gleiches Gewicht/Stil beibehalten
    let best = fam.faces[0];
    let score = Infinity;
    for (const f of fam.faces) {
      const s = Math.abs(f.weight - face.weight) + (f.italic === face.italic ? 0 : 1000);
      if (s < score) {
        best = f;
        score = s;
      }
    }
    props.onChange({ family: familyId, face: best.key });
    setOpen(false);
  };

  return (
    <div className="font-picker">
      <div className="font-picker-main">
        <button type="button" className="font-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span
            className="font-button-name"
            style={{
              fontFamily: preview ? `"${preview}", system-ui` : undefined,
              fontWeight: face.weight,
              fontStyle: face.italic ? 'italic' : undefined,
            }}
          >
            {family.name}
          </span>
          <IconChevron className="font-button-chevron" size={13} />
        </button>
        <select
          className="select font-face-select"
          value={resolved.faceKey}
          onChange={(e) => props.onChange({ family: resolved.familyId, face: e.target.value })}
          title={t('Schnitt')}
        >
          {family.faces.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      {!resolved.exact &&
        (/^(sys|loc):/.test(props.value.family) && resolved.familyId === `css:${cleanName(props.value.family)}` ? (
          <div className="hint">
            {t('Wird per Name genutzt. Für Text als Pfade im Schriftwähler „Installierte Schriften“ laden.')}
          </div>
        ) : (
          <div className="hint is-warn">{t('„{font}“ ist hier nicht verfügbar – stattdessen wird {fallback} verwendet.', { font: cleanName(props.value.family), fallback: family.name })}</div>
        ))}
      {family.source === 'css' && resolved.exact && (
        <div className="hint">{t('Installierte Schrift per Name: im SVG bleibt dieser Text editierbarer Text.')}</div>
      )}
      {missing.length > 0 && (
        <div className="hint is-warn">
          {t('Fehlende Zeichen:')} {missing.slice(0, 16).join(' ')}
          {missing.length > 16 ? ' …' : ''} {t('– werden aus Inter ergänzt.')}
        </div>
      )}
      {open && <FontPopover current={resolved.familyId} onPick={pickFamily} onClose={() => setOpen(false)} />}
    </div>
  );
}

type Filter = 'all' | FontCategory | 'own';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: t('Alle') },
  { id: 'sans', label: t('Serifenlos') },
  { id: 'serif', label: t('Serif') },
  { id: 'display', label: t('Display') },
  { id: 'handwriting', label: t('Handschrift') },
  { id: 'mono', label: t('Mono') },
  { id: 'own', label: t('Auf diesem PC & eigene') },
];

const GROUP_ORDER: { key: string; title: string; match: (f: FamilyInfo) => boolean }[] = [
  { key: 'upload', title: t('Eigene Schriften'), match: (f) => f.source === 'upload' },
  ...(['sans', 'serif', 'display', 'handwriting', 'mono'] as FontCategory[]).map((c) => ({
    key: c,
    title: t(CATEGORY_LABELS[c]),
    match: (f: FamilyInfo) => f.source === 'bundled' && f.category === c,
  })),
  { key: 'local', title: t('Auf diesem PC installiert'), match: (f) => f.source === 'local' },
  { key: 'system', title: t('Installiert (Systemschriften)'), match: (f) => f.source === 'system' },
  { key: 'css', title: t('Per Name (installiert)'), match: (f) => f.source === 'css' },
];

function FontPopover(props: { current: string; onPick: (familyId: string) => void; onClose: () => void }) {
  useRegistryVersion();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [message, setMessage] = useState<{ text: string; warn?: boolean } | null>(null);
  const [nameMode, setNameMode] = useState(false);
  const [cssName, setCssName] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.font-button')) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [props]);

  const q = query.trim().toLowerCase();
  const families = fontRegistry.listFamilies().filter((f) => {
    if (q && !f.name.toLowerCase().includes(q)) return false;
    if (filter === 'all') return true;
    if (filter === 'own') return f.source !== 'bundled';
    return f.source === 'bundled' && f.category === filter;
  });
  const groups = GROUP_ORDER.map((g) => {
    const items = families.filter(g.match);
    if (g.key === 'local' || g.key === 'system') items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { ...g, items };
  }).filter((g) => g.items.length);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const result = await fontRegistry.addFiles([...files]);
    if (result.added.length) track('schrift_upload', { familien: result.added.length });
    setBusy(false);
    if (result.errors.length) setMessage({ text: result.errors.join(' · '), warn: true });
    if (result.added.length) {
      if (!result.errors.length) setMessage({ text: t('{n} Schriftfamilie(n) hinzugefügt.', { n: result.added.length }) });
      props.onPick(result.added[0]);
    }
  };

  const refreshLocal = async () => {
    setBusy(true);
    const n = await fontRegistry.loadLocalServerFonts(true);
    setBusy(false);
    setMessage({ text: t('{n} Schriftfamilien auf diesem PC gefunden.', { n }) });
    setFilter('own');
  };

  const loadSystem = async () => {
    setBusy(true);
    try {
      const n = await fontRegistry.loadSystemFonts();
      track('systemschriften', { familien: n });
      setMessage({ text: t('{n} installierte Schriftfamilien gefunden.', { n }) });
      setFilter('own');
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t('Zugriff auf installierte Schriften nicht möglich.'), warn: true });
    }
    setBusy(false);
  };

  const addByName = () => {
    const name = cssName.trim();
    if (!name) return;
    const installed = isFontInstalled(name);
    const id = fontRegistry.addCssFont(name);
    track('schrift_per_name');
    if (!installed) {
      setMessage({ text: t('„{name}“ scheint nicht installiert zu sein – die Vorschau zeigt dann eine Ersatzschrift.', { name }), warn: true });
    }
    setNameMode(false);
    setCssName('');
    props.onPick(id);
  };

  return (
    <div className="font-popover" ref={ref}>
      <div className="font-popover-search">
        <IconSearch size={15} />
        <input autoFocus placeholder={t('Schrift suchen …')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="icon-btn" onClick={props.onClose} title={t('Schließen')}>
          <IconClose size={14} />
        </button>
      </div>
      <div className="font-popover-filters">
        {FILTERS.map((f) => (
          <button type="button" key={f.id} className={`chip${filter === f.id ? ' is-active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="font-popover-list">
        {groups.length === 0 && <div className="font-empty">{t('Keine Schrift gefunden.')}</div>}
        {groups.map((g) => (
          <div key={g.key} className="font-group">
            <div className="font-group-title">{g.title}</div>
            {g.items.map((f) => (
              <FontItem key={f.id} family={f} active={f.id === props.current} onPick={props.onPick} />
            ))}
          </div>
        ))}
      </div>
      {message && <div className={`font-popover-msg${message.warn ? ' is-warn' : ''}`}>{message.text}</div>}
      {nameMode ? (
        <div className="font-popover-foot">
          <input
            className="text-input"
            autoFocus
            placeholder={t('z. B. Helvetica Neue')}
            value={cssName}
            onChange={(e) => setCssName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addByName()}
          />
          <button type="button" className="btn btn-small btn-primary" onClick={addByName}>
            {t('Übernehmen')}
          </button>
          <button type="button" className="btn btn-small" onClick={() => setNameMode(false)}>
            {t('Abbrechen')}
          </button>
        </div>
      ) : (
        <div className="font-popover-foot">
          <label className={`btn btn-small${busy ? ' is-busy' : ''}`} title={t('TTF, OTF, WOFF oder TTC (auch variable Schriften)')}>
            <IconUpload size={14} /> {t('Schriftdatei …')}
            <input type="file" hidden multiple accept=".ttf,.otf,.woff,.ttc,.otc" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {fontRegistry.localServerAvailable && (
            <button type="button" className="btn btn-small" onClick={refreshLocal} disabled={busy} title={t('Installierte Schriften und Ordner „lokale-schriften“ neu einlesen')}>
              {t('PC-Schriften neu einlesen')}
            </button>
          )}
          {!fontRegistry.localServerAvailable && fontRegistry.systemFontsSupported && !fontRegistry.systemFontsLoaded && (
            <button type="button" className="btn btn-small" onClick={loadSystem} disabled={busy}>
              {t('Installierte Schriften')}
            </button>
          )}
          <button type="button" className="btn btn-small" onClick={() => setNameMode(true)} title={t('Eine auf diesem Rechner installierte Schrift über ihren Namen verwenden')}>
            {t('Per Name …')}
          </button>
        </div>
      )}
    </div>
  );
}

function FontItem(props: { family: FamilyInfo; active: boolean; onPick: (id: string) => void }) {
  const { family } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | undefined>(() =>
    family.source === 'bundled' || family.source === 'upload' ? undefined : family.name,
  );
  useEffect(() => {
    const el = ref.current;
    if (!el || preview) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          fontRegistry.ensurePreview(family.id).then(setPreview);
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [family.id, preview]);
  const removable = family.source === 'upload';
  return (
    <div ref={ref} className={`font-item${props.active ? ' is-active' : ''}`}>
      <button type="button" className="font-item-main" onClick={() => props.onPick(family.id)}>
        <span className="font-item-name" style={{ fontFamily: preview ? `"${preview}", system-ui` : undefined }}>
          {family.name}
        </span>
        <span className="font-item-meta">{family.faces.length === 1 ? t('1 Schnitt') : t('{n} Schnitte', { n: family.faces.length })}</span>
      </button>
      {removable && (
        <button
          type="button"
          className="icon-btn font-item-remove"
          title={t('Schrift entfernen')}
          onClick={() => {
            if (confirm(t('Schrift „{name}“ aus dem Browser entfernen?', { name: family.name }))) fontRegistry.removeFamily(family.id);
          }}
        >
          <IconTrash size={13} />
        </button>
      )}
    </div>
  );
}
