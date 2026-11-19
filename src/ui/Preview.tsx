import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Config } from '../config/types';
import { renderMonth, type RenderedMonth, type YearContext } from '../render/month';
import { pixelSize } from '../export/png';
import { DEFAULT_MONTH_NAMES } from '../config/defaults';
import { formatNumber } from './controls';
import { clearBackdropPhoto, setBackdropPhoto, useBackdropPhoto } from './backdrop';
import { IconChevron, IconChevronLeft, IconClose, IconDownload, IconFit, IconImage, IconMinus, IconPlus } from './icons';

const MM_TO_PX = 96 / 25.4;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
type Backdrop = 'checker' | 'white' | 'dark' | 'photo';

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function readBackdrop(): Backdrop {
  try {
    const v = localStorage.getItem('calcell:backdrop');
    return v === 'white' || v === 'dark' || v === 'photo' ? v : 'checker';
  } catch {
    return 'checker';
  }
}

function backdropStyle(backdrop: Backdrop, photo: string | null): CSSProperties | undefined {
  if (backdrop !== 'photo' || !photo) return undefined;
  return { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

export function Preview(props: {
  cfg: Config;
  ctx: YearContext;
  thumbCtx: YearContext;
  month: number;
  onMonth: (m: number) => void;
  onDownload: (format: 'png' | 'svg') => void;
  downloading: boolean;
}) {
  const { cfg, ctx, month } = props;
  const current = useMemo(() => renderMonth(ctx, month, { textMode: 'path' }), [ctx, month]);
  const src = useMemo(() => svgDataUrl(current.svg), [current.svg]);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [backdropChoice, setBackdrop] = useState<Backdrop>(readBackdrop);
  const photo = useBackdropPhoto();
  const backdrop: Backdrop = backdropChoice === 'photo' && !photo ? 'checker' : backdropChoice;
  const photoInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });

  useEffect(() => {
    try {
      localStorage.setItem('calcell:backdrop', backdropChoice);
    } catch {
      /* egal */
    }
  }, [backdropChoice]);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const naturalW = current.width * MM_TO_PX;
  const naturalH = current.height * MM_TO_PX;
  const fitScale = Math.max(0.05, Math.min((box.w - 64) / naturalW, (box.h - 64) / naturalH));
  const scale = zoom === 'fit' ? fitScale : zoom;
  const px = pixelSize(current.width, current.height, cfg.output.dpi);

  const stepZoom = (dir: 1 | -1) => {
    const cur = scale;
    const next = dir > 0 ? ZOOMS.find((z) => z > cur + 0.001) : [...ZOOMS].reverse().find((z) => z < cur - 0.001);
    setZoom(next ?? (dir > 0 ? ZOOMS[ZOOMS.length - 1] : ZOOMS[0]));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') props.onMonth((month + 11) % 12);
      if (e.key === 'ArrowRight') props.onMonth((month + 1) % 12);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [month, props]);

  const choosePhoto = () => photoInput.current?.click();

  return (
    <main className="stage">
      <div className="stage-toolbar">
        <div className="month-tabs">
          <button type="button" className="icon-btn" onClick={() => props.onMonth((month + 11) % 12)} title="Vorheriger Monat (←)">
            <IconChevronLeft size={16} />
          </button>
          {DEFAULT_MONTH_NAMES.map((name, m) => (
            <button type="button" key={m} className={`month-tab${m === month ? ' is-active' : ''}`} onClick={() => props.onMonth(m)}>
              {name.slice(0, 3)}
            </button>
          ))}
          <button type="button" className="icon-btn" onClick={() => props.onMonth((month + 1) % 12)} title="Nächster Monat (→)">
            <IconChevron size={16} />
          </button>
        </div>
        <div className="stage-tools">
          <div className="zoom">
            <button type="button" className={`icon-btn${zoom === 'fit' ? ' is-active' : ''}`} onClick={() => setZoom('fit')} title="Einpassen">
              <IconFit size={15} />
            </button>
            <button type="button" className="icon-btn" onClick={() => stepZoom(-1)} title="Verkleinern">
              <IconMinus size={15} />
            </button>
            <button type="button" className="zoom-value" onClick={() => setZoom(1)} title="100 % = echte Druckgröße am Bildschirm">
              {Math.round(scale * 100)} %
            </button>
            <button type="button" className="icon-btn" onClick={() => stepZoom(1)} title="Vergrößern">
              <IconPlus size={15} />
            </button>
          </div>
          <div className="backdrop-switch" title="Hintergrund der Vorschau (wird nicht exportiert)">
            {(['checker', 'white', 'dark'] as Backdrop[]).map((b) => (
              <button
                type="button"
                key={b}
                className={`backdrop-btn is-${b}${backdrop === b ? ' is-active' : ''}`}
                onClick={() => setBackdrop(b)}
                title={{ checker: 'Transparenz zeigen', white: 'Weißes Papier', dark: 'Dunkel', photo: '' }[b]}
              />
            ))}
            <button
              type="button"
              className={`backdrop-btn is-photo${backdrop === 'photo' ? ' is-active' : ''}`}
              style={photo ? { backgroundImage: `url("${photo}")` } : undefined}
              onClick={() => (photo ? setBackdrop('photo') : choosePhoto())}
              title={photo ? 'Eigenes Foto als Hintergrund' : 'Eigenes Foto als Hintergrund laden …'}
            >
              {!photo && <IconImage size={13} />}
            </button>
            {backdrop === 'photo' && (
              <>
                <button type="button" className="link-btn" onClick={choosePhoto}>
                  Foto ändern
                </button>
                <button
                  type="button"
                  className="icon-btn is-tiny"
                  title="Foto entfernen"
                  onClick={() => {
                    clearBackdropPhoto();
                    setBackdrop('checker');
                  }}
                >
                  <IconClose size={12} />
                </button>
              </>
            )}
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setBackdropPhoto(f);
                  setBackdrop('photo');
                }
                e.target.value = '';
              }}
            />
          </div>
          <div className="download-current">
            <button type="button" className="btn btn-small" onClick={() => props.onDownload('png')} disabled={props.downloading} title="Diesen Monat als PNG speichern">
              <IconDownload size={14} /> PNG
            </button>
            <button type="button" className="btn btn-small" onClick={() => props.onDownload('svg')} disabled={props.downloading} title="Diesen Monat als SVG speichern">
              <IconDownload size={14} /> SVG
            </button>
          </div>
        </div>
      </div>
      <div className="stage-canvas" ref={canvasRef}>
        <div className="stage-scroll">
          <div className={`paper is-${backdrop}`} style={{ width: naturalW * scale, height: naturalH * scale, ...backdropStyle(backdrop, photo) }}>
            <img src={src} alt={`Vorschau ${DEFAULT_MONTH_NAMES[month]} ${cfg.general.year}`} draggable={false} />
          </div>
        </div>
        <div className="stage-info">
          <b>
            {DEFAULT_MONTH_NAMES[month]} {cfg.general.year}
          </b>
          <span>
            {formatNumber(current.width, 1)} × {formatNumber(current.height, 1)} mm
          </span>
          <span>
            PNG {px.width} × {px.height} px · {cfg.output.dpi} dpi
          </span>
          <span>
            {current.geometry.rows} Wochen · Zelle {formatNumber(current.geometry.cellW, 1)} × {formatNumber(current.geometry.cellH, 1)} mm
          </span>
        </div>
      </div>
      <Thumbnails ctx={props.thumbCtx} month={month} onMonth={props.onMonth} backdrop={backdrop} photo={photo} />
    </main>
  );
}

const Thumbnails = memo(function Thumbnails(props: {
  ctx: YearContext;
  month: number;
  onMonth: (m: number) => void;
  backdrop: Backdrop;
  photo: string | null;
}) {
  const thumbs: RenderedMonth[] = useMemo(() => Array.from({ length: 12 }, (_, m) => renderMonth(props.ctx, m, { textMode: 'path' })), [props.ctx]);
  const urls = useMemo(() => thumbs.map((t) => svgDataUrl(t.svg)), [thumbs]);
  const style = backdropStyle(props.backdrop, props.photo);
  return (
    <div className="thumbs">
      {thumbs.map((_, m) => (
        <button type="button" key={m} className={`thumb${m === props.month ? ' is-active' : ''}`} onClick={() => props.onMonth(m)}>
          <span className={`thumb-img is-${props.backdrop}`} style={style}>
            <img src={urls[m]} alt="" draggable={false} />
          </span>
          <span className="thumb-label">{DEFAULT_MONTH_NAMES[m]}</span>
        </button>
      ))}
    </div>
  );
});
