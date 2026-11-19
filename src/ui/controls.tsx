import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Anchor } from '../config/types';
import { IconChevron } from './icons';

// ---------- Abschnitt (aufklappbar) ----------

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`calcell:section:${id}`);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function Section(props: {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optionaler Schalter im Kopf (Funktion an/aus) */
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(props.id, props.defaultOpen ?? false));
  useEffect(() => {
    try {
      localStorage.setItem(`calcell:section:${props.id}`, open ? '1' : '0');
    } catch {
      /* egal */
    }
  }, [open, props.id]);
  const off = props.enabled === false;
  return (
    <section className={`section${open ? ' is-open' : ''}${off ? ' is-off' : ''}`} data-section={props.id}>
      <div className="section-head">
        <button type="button" className="section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <IconChevron className="section-chevron" size={14} />
          <span className="section-icon">{props.icon}</span>
          <span className="section-title">{props.title}</span>
          {props.badge}
        </button>
        {props.onEnabledChange && (
          <Switch checked={!!props.enabled} onChange={props.onEnabledChange} label={`${props.title} anzeigen`} />
        )}
      </div>
      {open && <div className="section-body">{props.children}</div>}
    </section>
  );
}

export function Row(props: { label: ReactNode; children: ReactNode; hint?: ReactNode; stack?: boolean; search?: string }) {
  return (
    <div className={`row${props.stack ? ' row-stack' : ''}`} data-search={props.search ?? (typeof props.label === 'string' ? props.label : '')}>
      <div className="row-label">{props.label}</div>
      <div className="row-control">
        {props.children}
        {props.hint && <div className="hint">{props.hint}</div>}
      </div>
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <div className="subheading">{children}</div>;
}

export function Hint({ children, tone }: { children: ReactNode; tone?: 'warn' | 'info' }) {
  return <div className={`hint-box${tone === 'warn' ? ' is-warn' : ''}`}>{children}</div>;
}

// ---------- Schalter ----------

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      className={`switch${props.checked ? ' is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        props.onChange(!props.checked);
      }}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`toggle${props.disabled ? ' is-disabled' : ''}`}>
      <Switch checked={props.checked} onChange={props.onChange} disabled={props.disabled} />
      <span onClick={() => !props.disabled && props.onChange(!props.checked)}>{props.label}</span>
    </label>
  );
}

export function Check(props: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

// ---------- Zahl mit Schieberegler ----------

function parseNumber(text: string): number | null {
  const v = Number.parseFloat(text.replace(',', '.').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(v) ? v : null;
}

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3, useGrouping: false });

export function formatNumber(v: number, digits = 2): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, useGrouping: false }).format(v);
}

export function NumberField(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Bereich des Schiebereglers (Eingabefeld erlaubt min/max) */
  sliderMin?: number;
  sliderMax?: number;
  slider?: boolean;
  disabled?: boolean;
  width?: number;
}) {
  const { value, onChange, min = -Infinity, max = Infinity, step = 1, unit, slider = true, disabled } = props;
  const [text, setText] = useState(numberFormat.format(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(numberFormat.format(value));
  }, [value, focused]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (raw: string) => {
    const v = parseNumber(raw);
    if (v === null) {
      setText(numberFormat.format(value));
      return;
    }
    const c = clamp(v);
    if (c !== value) onChange(c);
    setText(numberFormat.format(c));
  };
  const sMin = props.sliderMin ?? (Number.isFinite(min) ? min : 0);
  const sMax = props.sliderMax ?? (Number.isFinite(max) ? max : 100);
  return (
    <div className={`number-field${disabled ? ' is-disabled' : ''}`}>
      {slider && (
        <input
          type="range"
          className="slider"
          min={sMin}
          max={sMax}
          step={step}
          value={Math.min(sMax, Math.max(sMin, value))}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          style={{ '--fill': `${((Math.min(sMax, Math.max(sMin, value)) - sMin) / (sMax - sMin || 1)) * 100}%` } as React.CSSProperties}
        />
      )}
      <div className="number-input" style={props.width ? { width: props.width } : undefined}>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => {
            setFocused(false);
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const factor = e.shiftKey ? 10 : 1;
              const next = clamp(Math.round((value + (e.key === 'ArrowUp' ? step : -step) * factor) * 1000) / 1000);
              onChange(next);
              setText(numberFormat.format(next));
            }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

// ---------- Farbe ----------

function normalizeHex(text: string): string | null {
  let t = text.trim().toLowerCase();
  if (!t.startsWith('#')) t = `#${t}`;
  if (/^#[0-9a-f]{3}$/.test(t)) t = `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return /^#[0-9a-f]{6}$/.test(t) ? t : null;
}

export function ColorField(props: { value: string; onChange: (v: string) => void; disabled?: boolean; compact?: boolean }) {
  const [text, setText] = useState(props.value);
  useEffect(() => setText(props.value), [props.value]);
  return (
    <div className={`color-field${props.disabled ? ' is-disabled' : ''}${props.compact ? ' is-compact' : ''}`}>
      <label className="swatch" style={{ background: props.value }} title="Farbe wählen">
        <input type="color" value={normalizeHex(props.value) ?? '#000000'} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)} />
      </label>
      {!props.compact && (
        <input
          className="hex-input"
          type="text"
          value={text}
          spellCheck={false}
          disabled={props.disabled}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) props.onChange(hex);
          }}
          onBlur={() => setText(props.value)}
        />
      )}
    </div>
  );
}

/** Farbe mit Ein/Aus (z. B. „Füllung“, „Rahmen“). */
export function OptionalColor(props: { on: boolean; color: string; onChange: (on: boolean, color: string) => void; label: ReactNode }) {
  return (
    <div className="optional-color">
      <Check checked={props.on} onChange={(v) => props.onChange(v, props.color)} label={props.label} />
      <ColorField value={props.color} onChange={(c) => props.onChange(true, c)} disabled={!props.on} />
    </div>
  );
}

// ---------- Auswahl ----------

export interface Option<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>(props: { value: T; options: Option<T>[]; onChange: (v: T) => void; small?: boolean; wrap?: boolean }) {
  return (
    <div className={`segmented${props.small ? ' is-small' : ''}${props.wrap ? ' is-wrap' : ''}`} role="radiogroup">
      {props.options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === props.value}
          title={o.title}
          className={o.value === props.value ? 'is-active' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string | number>(props: {
  value: T;
  options: (Option<T> & { group?: string })[];
  onChange: (v: T) => void;
}) {
  const groups = new Map<string, (Option<T> & { group?: string })[]>();
  for (const o of props.options) {
    const g = o.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o);
  }
  const isNumber = typeof props.value === 'number';
  return (
    <select className="select" value={String(props.value)} onChange={(e) => props.onChange((isNumber ? Number(e.target.value) : e.target.value) as T)}>
      {[...groups.entries()].map(([g, opts]) =>
        g ? (
          <optgroup key={g} label={g}>
            {opts.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label as string}
              </option>
            ))}
          </optgroup>
        ) : (
          opts.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label as string}
            </option>
          ))
        ),
      )}
    </select>
  );
}

export function TextField(props: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      className={`text-input${props.mono ? ' is-mono' : ''}`}
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      spellCheck={false}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <textarea
      id={id}
      className="textarea"
      value={props.value}
      rows={props.rows ?? 5}
      placeholder={props.placeholder}
      spellCheck={false}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

// ---------- Position (9er-Raster) ----------

const ANCHORS: Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const ANCHOR_LABELS: Record<Anchor, string> = {
  tl: 'oben links',
  tc: 'oben mittig',
  tr: 'oben rechts',
  ml: 'mittig links',
  mc: 'Mitte',
  mr: 'mittig rechts',
  bl: 'unten links',
  bc: 'unten mittig',
  br: 'unten rechts',
};

export function AnchorPicker(props: { value: Anchor; onChange: (v: Anchor) => void }) {
  return (
    <div className="anchor-picker" role="radiogroup">
      {ANCHORS.map((a) => (
        <button
          type="button"
          key={a}
          role="radio"
          aria-checked={a === props.value}
          title={ANCHOR_LABELS[a]}
          className={a === props.value ? 'is-active' : ''}
          onClick={() => props.onChange(a)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}
