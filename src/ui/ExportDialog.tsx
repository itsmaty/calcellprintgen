import { useEffect, useMemo, useState } from 'react';
import type { Config } from '../config/types';
import { computeGeometry, type YearContext } from '../render/month';
import {
  buildExportFiles,
  canSaveToFolder,
  fileBaseName,
  pickFolder,
  saveAsZip,
  saveIndividually,
  saveToFolder,
  type ExportProgress,
} from '../export/exporter';
import { checkCanvasSize, pixelSize } from '../export/png';
import type { Update } from './Sidebar';
import { Hint, NumberField, Segmented, TextField, Toggle } from './controls';
import { track } from '../analytics';
import { fontRegistry } from '../fonts/registry';
import { IconArchive, IconCheck, IconClose, IconFiles, IconFolder, IconWarning } from './icons';
import { lang, t, UI_MONTHS } from '../i18n';

type Target = 'zip' | 'folder' | 'files';

function readTarget(): Target {
  try {
    const v = localStorage.getItem('calcell:exportTarget');
    if (v === 'folder' && canSaveToFolder()) return 'folder';
    if (v === 'files') return 'files';
  } catch {
    /* egal */
  }
  return 'zip';
}

export function ExportDialog(props: { cfg: Config; ctx: YearContext; update: Update; onClose: () => void }) {
  const { cfg, ctx, update } = props;
  const o = cfg.output;
  const [target, setTarget] = useState<Target>(readTarget);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('calcell:exportTarget', target);
    } catch {
      /* egal */
    }
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'running') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, props]);

  const months = o.months.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  const largest = useMemo(() => {
    let w = 0;
    let h = 0;
    for (let m = 0; m < 12; m++) {
      const g = computeGeometry(ctx, m);
      w = Math.max(w, g.width);
      h = Math.max(h, g.height);
    }
    return pixelSize(w, h, o.dpi);
  }, [ctx, o.dpi]);
  const sizeProblem = o.format !== 'svg' ? checkCanvasSize(largest.width, largest.height) : null;
  const fileCount = months.length * (o.format === 'both' ? 2 : 1);
  const firstName = months.length ? fileBaseName(cfg, months[0]) : fileBaseName(cfg, 0);
  const usesSystemText = Object.values(ctx.fonts).some((font) => !font.ot);

  const run = async () => {
    setMessage('');
    let dir: Awaited<ReturnType<typeof pickFolder>> | null = null;
    if (target === 'folder') {
      try {
        dir = await pickFolder(); // muss direkt nach dem Klick passieren
      } catch {
        return; // abgebrochen
      }
    }
    setPhase('running');
    try {
      const files = await buildExportFiles(ctx, months, o.format, o.dpi, o.textAsPaths, setProgress);
      if (target === 'zip') {
        const zipName = `${t('Kalender')}_${cfg.general.year}.zip`;
        saveAsZip(files, zipName);
        setMessage(t('{n} Dateien in „{zip}“ gespeichert (Download-Ordner).', { n: files.length, zip: zipName }));
      } else if (target === 'folder' && dir) {
        await saveToFolder(dir, files);
        setMessage(t('{n} Dateien im Ordner „{dir}“ gespeichert.', { n: files.length, dir: dir.name }));
      } else {
        await saveIndividually(files);
        setMessage(t('{n} Dateien heruntergeladen.', { n: files.length }));
      }
      setPhase('done');
      // anonym: nur Format, Umfang und grobe Gestaltung – keine Inhalte
      const family = fontRegistry.getFamily(ctx.fonts.day.familyId);
      track('export', {
        format: o.format,
        dpi: o.format === 'svg' ? 0 : o.dpi,
        monate: months.length,
        ziel: target,
        form: cfg.cell.shape,
        ueberlauf: cfg.layout.overflow,
        schrift: family?.source === 'bundled' ? family.id : (family?.source ?? 'unbekannt'),
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(text);
      setPhase('error');
      track('export_fehler', { meldung: text.slice(0, 120) });
    }
  };

  const setMonth = (m: number, on: boolean) => {
    const next = [...o.months];
    next[m] = on;
    update('output', { months: next });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && phase !== 'running' && props.onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">{t('Exportieren')}</h2>
          <button type="button" className="icon-btn" onClick={props.onClose} disabled={phase === 'running'} title={t('Schließen')}>
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="field">
              <div className="field-label">{t('Format')}</div>
              <Segmented
                value={o.format}
                onChange={(v) => update('output', { format: v })}
                options={[
                  { value: 'png', label: t('PNG') },
                  { value: 'svg', label: t('SVG') },
                  { value: 'both', label: t('PNG + SVG') },
                ]}
              />
            </div>
            {o.format !== 'svg' && (
              <div className="field">
                <div className="field-label">{t('Auflösung (PNG)')}</div>
                <div className="inline">
                  <Segmented
                    value={[150, 300, 600].includes(o.dpi) ? o.dpi : 0}
                    onChange={(v) => v && update('output', { dpi: v })}
                    options={[
                      { value: 150, label: '150' },
                      { value: 300, label: '300' },
                      { value: 600, label: '600' },
                    ]}
                  />
                  <NumberField value={o.dpi} onChange={(v) => update('output', { dpi: Math.round(v) })} min={36} max={2400} step={1} unit="dpi" slider={false} width={110} />
                </div>
                <div className="field-note">
                  {t('Größtes Bild: {w} × {h} px · Hintergrund {bg}', { w: largest.width, h: largest.height, bg: o.background === 'transparent' ? t('transparent') : t('farbig') })}
                </div>
              </div>
            )}
            {o.format !== 'png' && (
              <div className="field">
                <div className="field-label">{t('SVG')}</div>
                <Toggle checked={o.textAsPaths} onChange={(v) => update('output', { textAsPaths: v })} label={t('Text in Pfade umwandeln (empfohlen für Druck)')} />
                {!o.textAsPaths && <div className="field-note">{t('Editierbarer Text: Die Schriften müssen beim Öffnen installiert sein.')}</div>}
              </div>
            )}
          </div>

          <div className="field">
            <div className="field-label">
              {t('Monate')}
              <span className="field-actions">
                <button type="button" className="link-btn" onClick={() => update('output', { months: Array(12).fill(true) })}>
                  {t('alle')}
                </button>
                <button type="button" className="link-btn" onClick={() => update('output', { months: Array(12).fill(false) })}>
                  {t('keine')}
                </button>
              </span>
            </div>
            <div className="month-chips">
              {UI_MONTHS.map((name, m) => (
                <button type="button" key={m} className={`chip${o.months[m] ? ' is-active' : ''}`} onClick={() => setMonth(m, !o.months[m])}>
                  {o.months[m] && <IconCheck size={12} />} {name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label">{t('Dateiname')}</div>
            <TextField value={o.fileName} onChange={(v) => update('output', { fileName: v })} mono />
            <div className="field-note">
              {t('Platzhalter:')}{' '}
              {(lang === 'en' ? ['{year}', '{mm}', '{m}', '{month}', '{MONTH}', '{short}'] : ['{jahr}', '{mm}', '{m}', '{monat}', '{MONAT}', '{kurz}']).map((tok) => (
                <code key={tok}>{tok} </code>
              ))}{' '}
              {t('→ z. B.')} <b>{firstName}.{o.format === 'svg' ? 'svg' : 'png'}</b>
            </div>
          </div>

          <div className="field">
            <div className="field-label">{t('Speichern als')}</div>
            <div className="target-options">
              <button type="button" className={`target${target === 'zip' ? ' is-active' : ''}`} onClick={() => setTarget('zip')}>
                <IconArchive size={18} />
                <span>
                  <b>{t('ZIP-Datei')}</b>
                  <small>{t('alle Dateien in einem Download')}</small>
                </span>
              </button>
              {canSaveToFolder() && (
                <button type="button" className={`target${target === 'folder' ? ' is-active' : ''}`} onClick={() => setTarget('folder')}>
                  <IconFolder size={18} />
                  <span>
                    <b>{t('In Ordner speichern')}</b>
                    <small>{t('Ordner wählen, Dateien landen direkt dort')}</small>
                  </span>
                </button>
              )}
              <button type="button" className={`target${target === 'files' ? ' is-active' : ''}`} onClick={() => setTarget('files')}>
                <IconFiles size={18} />
                <span>
                  <b>{t('Einzelne Downloads')}</b>
                  <small>{t('Browser fragt evtl. nach Erlaubnis')}</small>
                </span>
              </button>
            </div>
          </div>

          {sizeProblem && (
            <Hint tone="warn">
              <IconWarning size={14} /> {sizeProblem}
            </Hint>
          )}
          {usesSystemText && o.format !== 'png' && o.textAsPaths && (
            <Hint>{t('Eine Schrift ist nur per Name eingebunden – ihr Text bleibt im SVG als Text (nicht als Pfad).')}</Hint>
          )}

          {phase !== 'idle' && (
            <div className={`export-status is-${phase}`}>
              {phase === 'running' && progress && (
                <>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                  <div className="export-status-text">
                    {t('Erzeuge')} {progress.label} … ({progress.done}/{progress.total})
                  </div>
                </>
              )}
              {phase === 'done' && (
                <div className="export-status-text">
                  <IconCheck size={15} /> {message}
                </div>
              )}
              {phase === 'error' && (
                <div className="export-status-text">
                  <IconWarning size={15} /> {message}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <span className="modal-foot-info">
            {fileCount === 1 ? t('1 Datei') : t('{n} Dateien', { n: fileCount })} · {cfg.general.year}
          </span>
          <button type="button" className="btn" onClick={props.onClose} disabled={phase === 'running'}>
            {phase === 'done' ? t('Schließen') : t('Abbrechen')}
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={phase === 'running' || months.length === 0 || !!sizeProblem}>
            {phase === 'running' ? t('Exportiere …') : fileCount === 1 ? t('1 Datei exportieren') : t('{n} Dateien exportieren', { n: fileCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
