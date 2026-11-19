import { useEffect, useMemo, useState } from 'react';
import type { Config } from '../config/types';
import { DEFAULT_MONTH_NAMES } from '../config/defaults';
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
import { IconArchive, IconCheck, IconClose, IconFiles, IconFolder, IconWarning } from './icons';

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
        const zipName = `Kalender_${cfg.general.year}.zip`;
        saveAsZip(files, zipName);
        setMessage(`${files.length} Dateien in „${zipName}“ gespeichert (Download-Ordner).`);
      } else if (target === 'folder' && dir) {
        await saveToFolder(dir, files);
        setMessage(`${files.length} Dateien im Ordner „${dir.name}“ gespeichert.`);
      } else {
        await saveIndividually(files);
        setMessage(`${files.length} Dateien heruntergeladen.`);
      }
      setPhase('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
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
          <h2 id="export-title">Exportieren</h2>
          <button type="button" className="icon-btn" onClick={props.onClose} disabled={phase === 'running'} title="Schließen">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="field">
              <div className="field-label">Format</div>
              <Segmented
                value={o.format}
                onChange={(v) => update('output', { format: v })}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'svg', label: 'SVG' },
                  { value: 'both', label: 'PNG + SVG' },
                ]}
              />
            </div>
            {o.format !== 'svg' && (
              <div className="field">
                <div className="field-label">Auflösung (PNG)</div>
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
                  Größtes Bild: {largest.width} × {largest.height} px · Hintergrund {o.background === 'transparent' ? 'transparent' : 'farbig'}
                </div>
              </div>
            )}
            {o.format !== 'png' && (
              <div className="field">
                <div className="field-label">SVG</div>
                <Toggle checked={o.textAsPaths} onChange={(v) => update('output', { textAsPaths: v })} label="Text in Pfade umwandeln (empfohlen für Druck)" />
                {!o.textAsPaths && <div className="field-note">Editierbarer Text: Die Schriften müssen beim Öffnen installiert sein.</div>}
              </div>
            )}
          </div>

          <div className="field">
            <div className="field-label">
              Monate
              <span className="field-actions">
                <button type="button" className="link-btn" onClick={() => update('output', { months: Array(12).fill(true) })}>
                  alle
                </button>
                <button type="button" className="link-btn" onClick={() => update('output', { months: Array(12).fill(false) })}>
                  keine
                </button>
              </span>
            </div>
            <div className="month-chips">
              {DEFAULT_MONTH_NAMES.map((name, m) => (
                <button type="button" key={m} className={`chip${o.months[m] ? ' is-active' : ''}`} onClick={() => setMonth(m, !o.months[m])}>
                  {o.months[m] && <IconCheck size={12} />} {name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label">Dateiname</div>
            <TextField value={o.fileName} onChange={(v) => update('output', { fileName: v })} mono />
            <div className="field-note">
              Platzhalter: <code>{'{jahr}'}</code> <code>{'{mm}'}</code> <code>{'{m}'}</code> <code>{'{monat}'}</code> <code>{'{MONAT}'}</code> <code>{'{kurz}'}</code> → z. B. <b>{firstName}.{o.format === 'svg' ? 'svg' : 'png'}</b>
            </div>
          </div>

          <div className="field">
            <div className="field-label">Speichern als</div>
            <div className="target-options">
              <button type="button" className={`target${target === 'zip' ? ' is-active' : ''}`} onClick={() => setTarget('zip')}>
                <IconArchive size={18} />
                <span>
                  <b>ZIP-Datei</b>
                  <small>alle Dateien in einem Download</small>
                </span>
              </button>
              {canSaveToFolder() && (
                <button type="button" className={`target${target === 'folder' ? ' is-active' : ''}`} onClick={() => setTarget('folder')}>
                  <IconFolder size={18} />
                  <span>
                    <b>In Ordner speichern</b>
                    <small>Ordner wählen, Dateien landen direkt dort</small>
                  </span>
                </button>
              )}
              <button type="button" className={`target${target === 'files' ? ' is-active' : ''}`} onClick={() => setTarget('files')}>
                <IconFiles size={18} />
                <span>
                  <b>Einzelne Downloads</b>
                  <small>Browser fragt evtl. nach Erlaubnis</small>
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
            <Hint>Eine Schrift ist nur per Name eingebunden – ihr Text bleibt im SVG als Text (nicht als Pfad).</Hint>
          )}

          {phase !== 'idle' && (
            <div className={`export-status is-${phase}`}>
              {phase === 'running' && progress && (
                <>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                  <div className="export-status-text">
                    Erzeuge {progress.label} … ({progress.done}/{progress.total})
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
            {fileCount} {fileCount === 1 ? 'Datei' : 'Dateien'} · {cfg.general.year}
          </span>
          <button type="button" className="btn" onClick={props.onClose} disabled={phase === 'running'}>
            {phase === 'done' ? 'Schließen' : 'Abbrechen'}
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={phase === 'running' || months.length === 0 || !!sizeProblem}>
            {phase === 'running' ? 'Exportiere …' : `${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'} exportieren`}
          </button>
        </div>
      </div>
    </div>
  );
}
