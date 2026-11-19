import { useMemo, useState, type ReactNode } from 'react';
import type { CellShape, Config, CornerStyle, DayOverride, HighlightConfig, SectionKey, StrokeStyle, TextCase, WeekdayFormat } from '../config/types';
import { LOCALES, localeMonthNames, localeWeekdayNames } from '../calendar/locale';
import { REGIONS, parseEntries } from '../calendar/holidays';
import type { MonthGeometry } from '../render/month';
import {
  AnchorPicker,
  Check,
  ColorField,
  Hint,
  NumberField,
  Row,
  Section,
  Segmented,
  Select,
  SubHeading,
  TextArea,
  TextField,
  Toggle,
  formatNumber,
  type Option,
} from './controls';
import { FontPicker } from './FontPicker';
import { OverrideEditor } from './OverrideEditor';
import {
  IconCalendar,
  IconFlag,
  IconGrid,
  IconHash,
  IconHeading,
  IconLines,
  IconPalette,
  IconRows,
  IconSearch,
  IconShape,
  IconStar,
  IconType,
  IconWeek,
  IconClose,
} from './icons';

export type Update = <K extends SectionKey>(section: K, patch: Partial<Config[K]>) => void;

const WEEKDAY_FORMATS: Option<WeekdayFormat>[] = [
  { value: 'long', label: 'Montag' },
  { value: 'short', label: 'Mo.' },
  { value: 'two', label: 'Mo' },
  { value: 'narrow', label: 'M' },
];

const CASES: Option<TextCase>[] = [
  { value: 'auto', label: 'Normal' },
  { value: 'upper', label: 'GROSS' },
  { value: 'lower', label: 'klein' },
];

const STROKE_STYLES: Option<StrokeStyle>[] = [
  { value: 'solid', label: 'Linie' },
  { value: 'dashed', label: 'Gestrichelt' },
  { value: 'dotted', label: 'Gepunktet' },
];

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'A4 quer (297 × 210)', w: 297, h: 210 },
  { label: 'A4 hoch (210 × 297)', w: 210, h: 297 },
  { label: 'A3 quer (420 × 297)', w: 420, h: 297 },
  { label: 'A3 hoch (297 × 420)', w: 297, h: 420 },
  { label: 'A5 quer (210 × 148)', w: 210, h: 148 },
  { label: 'A5 hoch (148 × 210)', w: 148, h: 210 },
  { label: 'Quadrat 300 × 300', w: 300, h: 300 },
  { label: 'Quadrat 200 × 200', w: 200, h: 200 },
  { label: 'US Letter quer (279,4 × 215,9)', w: 279.4, h: 215.9 },
];

function ShapeIcon({ shape }: { shape: CellShape }) {
  const common = { fill: 'currentColor', fillOpacity: 0.16, stroke: 'currentColor', strokeWidth: 1.6 };
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
      {shape === 'none' && <path d="M5 4h18v14H5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />}
      {shape === 'rect' && <rect x="5" y="3" width="18" height="16" rx="3.5" {...common} />}
      {shape === 'parallelogram' && <path d="M8.5 3h16l-5 16h-16Z" strokeLinejoin="round" {...common} />}
      {shape === 'circle' && <circle cx="14" cy="11" r="8" {...common} />}
      {shape === 'ellipse' && <ellipse cx="14" cy="11" rx="10.5" ry="7.5" {...common} />}
      {shape === 'squircle' && <path d="M14 3c7 0 9 1.6 9 8s-2 8-9 8-9-1.6-9-8 2-8 9-8Z" {...common} />}
      {shape === 'hexagon' && <path d="M14 2.5 21.5 6.8v8.4L14 19.5 6.5 15.2V6.8Z" {...common} />}
    </svg>
  );
}

function CornerIcon({ style }: { style: CornerStyle }) {
  const d = {
    round: 'M4 20V12a8 8 0 0 1 8-8h8',
    bevel: 'M4 20v-8l8-8h8',
    scoop: 'M4 20v-8a8 8 0 0 0 8-8h8',
    notch: 'M4 20v-8h8V4h8',
  }[style];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const SHAPES: { value: CellShape; label: string }[] = [
  { value: 'none', label: 'Keine' },
  { value: 'rect', label: 'Rechteck' },
  { value: 'parallelogram', label: 'Schräg' },
  { value: 'circle', label: 'Kreis' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'squircle', label: 'Squircle' },
  { value: 'hexagon', label: 'Sechseck' },
];

const CORNERS: { value: CornerStyle; label: string }[] = [
  { value: 'round', label: 'Rund' },
  { value: 'bevel', label: 'Abgeschrägt' },
  { value: 'scoop', label: 'Nach innen' },
  { value: 'notch', label: 'Kerbe' },
];

/** Suchbegriffe je Abschnitt für das Suchfeld. */
const KEYWORDS: Record<string, string> = {
  general: 'kalender jahr sprache wochenbeginn montag sonntag namen monatsnamen bezeichnungen jänner',
  layout: 'raster größe zellgröße breite höhe abstand rand format a4 a3 wochen zeilen hintergrund transparent',
  overflow: 'überlauf überlauftage ausgegraut ausblenden leer nachbarmonat deckkraft',
  shape: 'form zellform rechteck schräg parallelogramm neigung kreis ellipse squircle sechseck ecken radius abgerundet abgeschrägt',
  fill: 'füllung farbe rahmen linie stärke gestrichelt gepunktet tabelle raster seiten schatten',
  day: 'tageszahl zahl nummer schrift größe farbe position führende null badge kreis',
  weekday: 'wochentag zelle schrift',
  header: 'kopfzeile wochentage überschrift spalten hintergrund',
  title: 'monatstitel titel monat jahr schrift überschrift',
  highlight: 'wochenende samstag sonntag feiertag hervorhebung rot farbe',
  holidays: 'feiertage einträge geburtstage region bundesland österreich schweiz gedenktage namen',
  lines: 'notizlinien linien notizen',
  weeknumbers: 'kalenderwochen kw woche nummer',
};

export function Sidebar(props: { cfg: Config; update: Update; geometry: MonthGeometry | null }) {
  const { cfg, update } = props;
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = (id: string, title: string) => !q || title.toLowerCase().includes(q) || (KEYWORDS[id] ?? '').includes(q);
  const sec = (id: string, title: string, node: ReactNode) => (visible(id, title) ? node : null);
  const anyVisible = Object.keys(KEYWORDS).some((id) => visible(id, ''));

  const g = cfg.general;
  const L = cfg.layout;
  const c = cfg.cell;
  const dn = cfg.dayNumber;
  const wd = cfg.weekday;
  const hd = cfg.header;
  const t = cfg.title;
  const wn = cfg.weekNumbers;
  const hol = cfg.holidays;
  const ln = cfg.lines;
  const out = cfg.output;
  const setHighlight = (key: keyof HighlightConfig) => (patch: Partial<DayOverride>) =>
    update('highlight', { [key]: { ...cfg.highlight[key], ...patch } } as Partial<HighlightConfig>);

  const entryErrors = useMemo(() => parseEntries(hol.entries, [g.year]).errors, [hol.entries, g.year]);
  const geo = props.geometry;
  const gridMode = c.borderMode === 'grid';
  const badgeOn = dn.badge !== 'none';

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <IconSearch size={15} />
        <input placeholder="Einstellung suchen …" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" className="icon-btn" onClick={() => setQuery('')} title="Suche leeren">
            <IconClose size={13} />
          </button>
        )}
      </div>
      <div className="sidebar-scroll" key={q ? 'search' : 'all'}>
        {!anyVisible && <div className="sidebar-empty">Keine passende Einstellung gefunden.</div>}

        {sec(
          'general',
          'Kalender',
          <Section id="general" title="Kalender" icon={<IconCalendar />} defaultOpen={!q} badge={<span className="pill">{g.year}</span>}>
            <Row label="Jahr">
              <NumberField value={g.year} onChange={(v) => update('general', { year: Math.round(v) })} min={1900} max={2200} step={1} slider={false} width={110} />
            </Row>
            <Row label="Sprache">
              <Select
                value={g.locale}
                options={LOCALES.map((l) => ({ value: l.id, label: l.label }))}
                onChange={(v) => update('general', { locale: v })}
              />
            </Row>
            <Row label="Woche beginnt">
              <Segmented
                value={g.weekStart}
                onChange={(v) => update('general', { weekStart: v })}
                options={[
                  { value: 1, label: 'Montag' },
                  { value: 0, label: 'Sonntag' },
                  { value: 6, label: 'Samstag' },
                ]}
              />
            </Row>
            <Row label="Bezeichnungen">
              <Toggle checked={g.customNames} onChange={(v) => update('general', { customNames: v })} label="Eigene Monats- und Tagesnamen" />
            </Row>
            {g.customNames && (
              <>
                <div className="names-grid">
                  {g.monthNames.map((name, i) => (
                    <input
                      key={i}
                      className="text-input"
                      value={name}
                      onChange={(e) => {
                        const next = [...g.monthNames];
                        next[i] = e.target.value;
                        update('general', { monthNames: next });
                      }}
                    />
                  ))}
                </div>
                <div className="names-grid is-week">
                  {g.weekdayNames.map((name, i) => (
                    <input
                      key={i}
                      className="text-input"
                      value={name}
                      onChange={(e) => {
                        const next = [...g.weekdayNames];
                        next[i] = e.target.value;
                        update('general', { weekdayNames: next });
                      }}
                    />
                  ))}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => update('general', { monthNames: localeMonthNames(g.locale), weekdayNames: localeWeekdayNames(g.locale) })}
                  >
                    Aus Sprache übernehmen
                  </button>
                </div>
                <Hint>Eigene Wochentagsnamen werden unverändert verwendet (das Format „Mo/Mo./M“ gilt dann nicht).</Hint>
              </>
            )}
          </Section>,
        )}

        {sec(
          'layout',
          'Raster & Größe',
          <Section id="layout" title="Raster & Größe" icon={<IconGrid />} defaultOpen={!q}>
            <Row label="Größe festlegen">
              <Segmented
                value={L.sizeMode}
                onChange={(v) => update('layout', { sizeMode: v })}
                options={[
                  { value: 'cell', label: 'Zellgröße' },
                  { value: 'total', label: 'Gesamtgröße' },
                ]}
              />
            </Row>
            {L.sizeMode === 'cell' ? (
              <>
                <Row label="Zellbreite">
                  <NumberField value={L.cellWidth} onChange={(v) => update('layout', { cellWidth: v })} min={2} max={500} sliderMin={8} sliderMax={80} step={0.5} unit="mm" />
                </Row>
                <Row label="Zellhöhe">
                  <NumberField value={L.cellHeight} onChange={(v) => update('layout', { cellHeight: v })} min={2} max={500} sliderMin={8} sliderMax={80} step={0.5} unit="mm" />
                </Row>
              </>
            ) : (
              <>
                <Row label="Format">
                  <Select
                    value={SIZE_PRESETS.find((p) => p.w === L.totalWidth && p.h === L.totalHeight)?.label ?? 'custom'}
                    options={[{ value: 'custom', label: 'Eigene Größe' }, ...SIZE_PRESETS.map((p) => ({ value: p.label, label: p.label }))]}
                    onChange={(v) => {
                      const p = SIZE_PRESETS.find((x) => x.label === v);
                      if (p) update('layout', { totalWidth: p.w, totalHeight: p.h });
                    }}
                  />
                </Row>
                <Row label="Breite gesamt">
                  <NumberField value={L.totalWidth} onChange={(v) => update('layout', { totalWidth: v })} min={20} max={2000} sliderMin={50} sliderMax={600} step={1} unit="mm" />
                </Row>
                <Row label="Höhe gesamt">
                  <NumberField value={L.totalHeight} onChange={(v) => update('layout', { totalHeight: v })} min={20} max={2000} sliderMin={50} sliderMax={600} step={1} unit="mm" />
                </Row>
              </>
            )}
            <Row label="Abstand waagrecht">
              <NumberField value={L.gapX} onChange={(v) => update('layout', { gapX: v })} min={0} max={100} sliderMax={12} step={0.25} unit="mm" disabled={gridMode} />
            </Row>
            <Row label="Abstand senkrecht">
              <NumberField value={L.gapY} onChange={(v) => update('layout', { gapY: v })} min={0} max={100} sliderMax={12} step={0.25} unit="mm" disabled={gridMode} />
            </Row>
            {gridMode && <Hint>Im Tabellenraster liegen die Zellen ohne Abstand direkt aneinander.</Hint>}
            <Row label="Außenrand">
              <NumberField value={L.padding} onChange={(v) => update('layout', { padding: v })} min={0} max={100} sliderMax={20} step={0.5} unit="mm" />
            </Row>
            <Row label="Wochen pro Monat">
              <Segmented
                value={L.rows}
                onChange={(v) => update('layout', { rows: v })}
                options={[
                  { value: 'auto', label: 'Nach Bedarf (4–6)' },
                  { value: 'six', label: 'Immer 6' },
                ]}
              />
            </Row>
            <Row label="Hintergrund">
              <div className="inline">
                <Segmented
                  value={out.background}
                  onChange={(v) => update('output', { background: v })}
                  options={[
                    { value: 'transparent', label: 'Transparent' },
                    { value: 'color', label: 'Farbe' },
                  ]}
                />
                {out.background === 'color' && <ColorField value={out.backgroundColor} onChange={(v) => update('output', { backgroundColor: v })} compact />}
              </div>
            </Row>
            {geo && (
              <div className="info-box">
                <div>
                  <span>Bildgröße</span>
                  <b>
                    {formatNumber(geo.width, 1)} × {formatNumber(geo.height, 1)} mm
                  </b>
                </div>
                <div>
                  <span>Zellgröße</span>
                  <b>
                    {formatNumber(geo.cellW, 2)} × {formatNumber(geo.cellH, 2)} mm
                  </b>
                </div>
                {L.rows === 'auto' && <div className="info-note">Monate mit 4, 5 oder 6 Wochen werden unterschiedlich hoch.</div>}
              </div>
            )}
          </Section>,
        )}

        {sec(
          'overflow',
          'Überlauftage',
          <Section id="overflow" title="Überlauftage (Nachbarmonate)" icon={<IconRows />}>
            <Row label="Darstellung">
              <Segmented
                value={L.overflow}
                onChange={(v) => update('layout', { overflow: v })}
                options={[
                  { value: 'dimmed', label: 'Ausgegraut' },
                  { value: 'empty', label: 'Leere Zelle' },
                  { value: 'hidden', label: 'Ausblenden' },
                ]}
              />
            </Row>
            {L.overflow !== 'hidden' && (
              <>
                <Row label="Deckkraft">
                  <NumberField value={L.overflowOpacity} onChange={(v) => update('layout', { overflowOpacity: v })} min={0} max={100} step={1} unit="%" />
                </Row>
                <OverrideEditor value={cfg.highlight.overflow} onChange={setHighlight('overflow')} enableLabel="Eigene Farben für Überlauftage" showBadge={badgeOn} />
              </>
            )}
            <Hint>
              „Ausgegraut“ zeigt die Tage der Nachbarmonate abgeschwächt, „Leere Zelle“ nur die Form ohne Zahl, „Ausblenden“ lässt sie ganz weg.
            </Hint>
          </Section>,
        )}

        {sec(
          'shape',
          'Zellform',
          <Section id="shape" title="Zellform & Ecken" icon={<IconShape />} defaultOpen={!q}>
            <div className="shape-picker">
              {SHAPES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  className={`shape-btn${c.shape === s.value ? ' is-active' : ''}`}
                  onClick={() => update('cell', { shape: s.value })}
                  disabled={gridMode && s.value !== 'rect'}
                  title={s.value === 'parallelogram' ? 'Schräg (Parallelogramm)' : s.label}
                >
                  <ShapeIcon shape={s.value} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            {gridMode && <Hint>Im Tabellenraster sind Zellen immer eckige Rechtecke.</Hint>}
            {!gridMode && c.shape !== 'none' && (
              <Row label="Größe der Form">
                <NumberField value={c.scale} onChange={(v) => update('cell', { scale: v })} min={10} max={100} step={1} unit="%" />
              </Row>
            )}
            {!gridMode && c.shape === 'rect' && (
              <>
                <Row label="Ecken">
                  <div className="corner-picker">
                    {CORNERS.map((k) => (
                      <button
                        type="button"
                        key={k.value}
                        className={`corner-btn${c.cornerStyle === k.value ? ' is-active' : ''}`}
                        onClick={() => update('cell', { cornerStyle: k.value })}
                        title={k.label}
                      >
                        <CornerIcon style={k.value} />
                        <span>{k.label}</span>
                      </button>
                    ))}
                  </div>
                </Row>
                {!c.individualCorners && (
                  <Row label={c.cornerStyle === 'round' ? 'Radius' : 'Eckengröße'}>
                    <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={200} sliderMax={20} step={0.25} unit="mm" />
                  </Row>
                )}
                <Row label="">
                  <Toggle
                    checked={c.individualCorners}
                    onChange={(v) =>
                      update('cell', v ? { individualCorners: true, radiusTL: c.radius, radiusTR: c.radius, radiusBR: c.radius, radiusBL: c.radius } : { individualCorners: false })
                    }
                    label="Ecken einzeln einstellen"
                  />
                </Row>
                {c.individualCorners && (
                  <div className="corner-grid">
                    {(
                      [
                        ['radiusTL', 'oben links'],
                        ['radiusTR', 'oben rechts'],
                        ['radiusBL', 'unten links'],
                        ['radiusBR', 'unten rechts'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="corner-cell">
                        <span>{label}</span>
                        <NumberField value={c[key]} onChange={(v) => update('cell', { [key]: v })} min={0} max={200} step={0.25} unit="mm" slider={false} />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            {!gridMode && c.shape === 'parallelogram' && (
              <>
                <Row label="Neigung" hint="positiv = nach rechts geneigt, negativ = nach links">
                  <NumberField value={c.skew} onChange={(v) => update('cell', { skew: v })} min={-60} max={60} sliderMin={-40} sliderMax={40} step={1} unit="°" />
                </Row>
                <Row label="Eckenradius">
                  <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
                <Row label="">
                  <Toggle checked={c.skewText} onChange={(v) => update('cell', { skewText: v })} label="Schrift mitneigen" />
                </Row>
              </>
            )}
            {!gridMode && c.shape === 'squircle' && (
              <Row label="Eckigkeit" hint="2 = Ellipse, höhere Werte = eckiger">
                <NumberField value={c.squircleN} onChange={(v) => update('cell', { squircleN: v })} min={2} max={20} sliderMax={12} step={0.1} />
              </Row>
            )}
            {!gridMode && c.shape === 'hexagon' && (
              <>
                <Row label="Ausrichtung">
                  <Segmented
                    value={c.hexOrientation}
                    onChange={(v) => update('cell', { hexOrientation: v })}
                    options={[
                      { value: 'pointy', label: 'Spitze oben' },
                      { value: 'flat', label: 'Flach oben' },
                    ]}
                  />
                </Row>
                <Row label="Eckenradius">
                  <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
              </>
            )}
          </Section>,
        )}

        {sec(
          'fill',
          'Füllung & Rahmen',
          <Section id="fill" title="Füllung, Rahmen & Schatten" icon={<IconPalette />} defaultOpen={!q}>
            <Row label="Füllung">
              <div className="inline">
                <Toggle checked={c.fillEnabled} onChange={(v) => update('cell', { fillEnabled: v })} label="" />
                <ColorField value={c.fill} onChange={(v) => update('cell', { fill: v, fillEnabled: true })} disabled={!c.fillEnabled} />
              </div>
            </Row>
            {c.fillEnabled && (
              <>
                <Row label="Füllart">
                  <Segmented
                    value={c.fillMode}
                    onChange={(v) => update('cell', { fillMode: v })}
                    options={[
                      { value: 'solid', label: 'Einfarbig' },
                      { value: 'gradient', label: 'Verlauf' },
                    ]}
                  />
                </Row>
                {c.fillMode === 'gradient' && (
                  <>
                    <Row label="Verlauf bis">
                      <ColorField value={c.fill2} onChange={(v) => update('cell', { fill2: v })} />
                    </Row>
                    <Row label="Richtung">
                      <Segmented
                        value={c.gradientDir}
                        onChange={(v) => update('cell', { gradientDir: v })}
                        options={[
                          { value: 'vertical', label: '↓ Senkrecht' },
                          { value: 'horizontal', label: '→ Waagrecht' },
                          { value: 'diagonal', label: '↘ Diagonal' },
                        ]}
                      />
                    </Row>
                  </>
                )}
                <Row label="Deckkraft">
                  <NumberField value={c.fillOpacity} onChange={(v) => update('cell', { fillOpacity: v })} min={0} max={100} step={1} unit="%" />
                </Row>
              </>
            )}
            <Row label="Rahmen">
              <div className="inline">
                <Toggle checked={c.strokeEnabled} onChange={(v) => update('cell', { strokeEnabled: v })} label="" />
                <ColorField value={c.stroke} onChange={(v) => update('cell', { stroke: v, strokeEnabled: true })} disabled={!c.strokeEnabled} />
              </div>
            </Row>
            {c.strokeEnabled && (
              <>
                <Row label="Linienstärke">
                  <NumberField value={c.strokeWidth} onChange={(v) => update('cell', { strokeWidth: v })} min={0.05} max={30} sliderMin={0.1} sliderMax={6} step={0.05} unit="pt" />
                </Row>
                <Row label="Linienart">
                  <Segmented value={c.strokeStyle} onChange={(v) => update('cell', { strokeStyle: v })} options={STROKE_STYLES} />
                </Row>
                {c.strokeStyle === 'dashed' && (
                  <Row label="Strich / Lücke">
                    <div className="inline">
                      <NumberField value={c.dashLength} onChange={(v) => update('cell', { dashLength: v })} min={0.1} max={50} step={0.1} unit="mm" slider={false} />
                      <NumberField value={c.dashGap} onChange={(v) => update('cell', { dashGap: v })} min={0.1} max={50} step={0.1} unit="mm" slider={false} />
                    </div>
                  </Row>
                )}
                {c.strokeStyle === 'dotted' && (
                  <Row label="Punktabstand">
                    <NumberField value={c.dashGap} onChange={(v) => update('cell', { dashGap: v })} min={0.1} max={50} sliderMax={5} step={0.1} unit="mm" />
                  </Row>
                )}
                <Row label="Rahmen-Art">
                  <Segmented
                    value={c.borderMode}
                    onChange={(v) => update('cell', { borderMode: v })}
                    options={[
                      { value: 'cell', label: 'Je Zelle' },
                      { value: 'grid', label: 'Tabellenraster' },
                    ]}
                  />
                </Row>
                {!gridMode && c.shape === 'rect' && (
                  <Row label="Seiten">
                    <div className="check-row">
                      <Check checked={c.sideTop} onChange={(v) => update('cell', { sideTop: v })} label="Oben" />
                      <Check checked={c.sideRight} onChange={(v) => update('cell', { sideRight: v })} label="Rechts" />
                      <Check checked={c.sideBottom} onChange={(v) => update('cell', { sideBottom: v })} label="Unten" />
                      <Check checked={c.sideLeft} onChange={(v) => update('cell', { sideLeft: v })} label="Links" />
                    </div>
                  </Row>
                )}
                {gridMode && (
                  <Row label="Linien">
                    <div className="check-row">
                      <Check checked={c.gridOuter} onChange={(v) => update('cell', { gridOuter: v })} label="Außen" />
                      <Check checked={c.gridInnerH} onChange={(v) => update('cell', { gridInnerH: v })} label="Waagrecht" />
                      <Check checked={c.gridInnerV} onChange={(v) => update('cell', { gridInnerV: v })} label="Senkrecht" />
                    </div>
                  </Row>
                )}
              </>
            )}
            {!gridMode && c.shape !== 'none' && (
              <>
                <SubHeading>Schatten</SubHeading>
                <Row label="Schatten">
                  <div className="inline">
                    <Toggle checked={c.shadowEnabled} onChange={(v) => update('cell', { shadowEnabled: v })} label="" />
                    <ColorField value={c.shadowColor} onChange={(v) => update('cell', { shadowColor: v, shadowEnabled: true })} disabled={!c.shadowEnabled} />
                  </div>
                </Row>
                {c.shadowEnabled && (
                  <>
                    <Row label="Versatz X / Y">
                      <div className="inline">
                        <NumberField value={c.shadowX} onChange={(v) => update('cell', { shadowX: v })} min={-50} max={50} step={0.1} unit="mm" slider={false} />
                        <NumberField value={c.shadowY} onChange={(v) => update('cell', { shadowY: v })} min={-50} max={50} step={0.1} unit="mm" slider={false} />
                      </div>
                    </Row>
                    <Row label="Weichzeichnen">
                      <NumberField value={c.shadowBlur} onChange={(v) => update('cell', { shadowBlur: v })} min={0} max={30} sliderMax={6} step={0.1} unit="mm" />
                    </Row>
                    <Row label="Deckkraft">
                      <NumberField value={c.shadowOpacity} onChange={(v) => update('cell', { shadowOpacity: v })} min={0} max={100} step={1} unit="%" />
                    </Row>
                  </>
                )}
              </>
            )}
          </Section>,
        )}

        {sec(
          'day',
          'Tageszahl',
          <Section id="day" title="Tageszahl" icon={<IconHash />} enabled={dn.show} onEnabledChange={(v) => update('dayNumber', { show: v })} defaultOpen={!q}>
            <Row label="Schrift" stack>
              <FontPicker value={dn.font} onChange={(v) => update('dayNumber', { font: v })} />
            </Row>
            <Row label="Größe">
              <NumberField value={dn.size} onChange={(v) => update('dayNumber', { size: v })} min={2} max={300} sliderMin={4} sliderMax={60} step={0.5} unit="pt" />
            </Row>
            <Row label="Farbe">
              <ColorField value={dn.color} onChange={(v) => update('dayNumber', { color: v })} />
            </Row>
            <Row label="Laufweite">
              <NumberField value={dn.tracking} onChange={(v) => update('dayNumber', { tracking: v })} min={-300} max={1000} sliderMin={-100} sliderMax={400} step={5} unit="‰" />
            </Row>
            <Row label="Position">
              <div className="inline is-top">
                <AnchorPicker value={dn.anchor} onChange={(v) => update('dayNumber', { anchor: v })} />
                <div className="pad-fields">
                  <label>
                    <span>Abstand seitlich</span>
                    <NumberField value={dn.padX} onChange={(v) => update('dayNumber', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                  <label>
                    <span>Abstand oben/unten</span>
                    <NumberField value={dn.padY} onChange={(v) => update('dayNumber', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                </div>
              </div>
            </Row>
            <Row label="Text davor / danach" hint="z. B. „.“ dahinter ergibt „1.“, „2.“ …">
              <div className="inline">
                <TextField value={dn.prefix} onChange={(v) => update('dayNumber', { prefix: v })} placeholder="davor" />
                <TextField value={dn.suffix} onChange={(v) => update('dayNumber', { suffix: v })} placeholder="danach" />
              </div>
            </Row>
            <Row label="">
              <Toggle checked={dn.leadingZero} onChange={(v) => update('dayNumber', { leadingZero: v })} label="Führende Null (01, 02 …)" />
            </Row>
            <SubHeading>Hintergrund der Zahl (Badge)</SubHeading>
            <Row label="Badge">
              <Segmented
                value={dn.badge}
                onChange={(v) => update('dayNumber', { badge: v })}
                options={[
                  { value: 'none', label: 'Keiner' },
                  { value: 'circle', label: 'Kreis' },
                  { value: 'square', label: 'Quadrat' },
                ]}
              />
            </Row>
            {badgeOn && (
              <>
                <Row label="Zeigen bei">
                  <Segmented
                    value={dn.badgeScope}
                    onChange={(v) => update('dayNumber', { badgeScope: v })}
                    options={[
                      { value: 'all', label: 'Allen Tagen' },
                      { value: 'highlighted', label: 'Nur hervorgehobenen' },
                    ]}
                  />
                </Row>
                <Row label="Größe">
                  <NumberField value={dn.badgeSize} onChange={(v) => update('dayNumber', { badgeSize: v })} min={1} max={200} sliderMin={2} sliderMax={30} step={0.25} unit="mm" />
                </Row>
                {dn.badge === 'square' && (
                  <Row label="Eckenradius">
                    <NumberField value={dn.badgeRadius} onChange={(v) => update('dayNumber', { badgeRadius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                  </Row>
                )}
                <Row label="Farbe">
                  <ColorField value={dn.badgeColor} onChange={(v) => update('dayNumber', { badgeColor: v })} />
                </Row>
                <Hint>Mit Badge sitzt die Zahl mittig im Badge; die Position bestimmt dann, wo das Badge steht.</Hint>
              </>
            )}
          </Section>,
        )}

        {sec(
          'weekday',
          'Wochentag in der Zelle',
          <Section id="weekday" title="Wochentag in der Zelle" icon={<IconType />} enabled={wd.show} onEnabledChange={(v) => update('weekday', { show: v })}>
            <Row label="Format">
              <Segmented value={wd.format} onChange={(v) => update('weekday', { format: v })} options={WEEKDAY_FORMATS} />
            </Row>
            <Row label="Schreibweise">
              <Segmented value={wd.textCase} onChange={(v) => update('weekday', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={wd} onChange={(p) => update('weekday', p)} />
            <Row label="Position">
              <div className="inline is-top">
                <AnchorPicker value={wd.anchor} onChange={(v) => update('weekday', { anchor: v })} />
                <div className="pad-fields">
                  <label>
                    <span>Abstand seitlich</span>
                    <NumberField value={wd.padX} onChange={(v) => update('weekday', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                  <label>
                    <span>Abstand oben/unten</span>
                    <NumberField value={wd.padY} onChange={(v) => update('weekday', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                </div>
              </div>
            </Row>
          </Section>,
        )}

        {sec(
          'header',
          'Kopfzeile',
          <Section id="header" title="Kopfzeile (Wochentage)" icon={<IconHeading />} enabled={hd.show} onEnabledChange={(v) => update('header', { show: v })}>
            <Row label="Format">
              <Segmented value={hd.format} onChange={(v) => update('header', { format: v })} options={WEEKDAY_FORMATS} />
            </Row>
            <Row label="Schreibweise">
              <Segmented value={hd.textCase} onChange={(v) => update('header', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={hd} onChange={(p) => update('header', p)} />
            <Row label="Ausrichtung">
              <Segmented
                value={hd.align}
                onChange={(v) => update('header', { align: v })}
                options={[
                  { value: 'left', label: 'Links' },
                  { value: 'center', label: 'Mitte' },
                  { value: 'right', label: 'Rechts' },
                ]}
              />
            </Row>
            {hd.align !== 'center' && (
              <Row label="Abstand seitlich">
                <NumberField value={hd.padX} onChange={(v) => update('header', { padX: v })} min={-50} max={100} sliderMax={10} step={0.1} unit="mm" />
              </Row>
            )}
            <Row label="Kästchen">
              <Segmented
                value={hd.background}
                onChange={(v) => update('header', { background: v })}
                wrap
                options={[
                  { value: 'cell', label: 'Wie Tageszellen' },
                  { value: 'cells', label: 'Farbfläche je Spalte' },
                  { value: 'bar', label: 'Balken' },
                  { value: 'none', label: 'Keine' },
                ]}
              />
            </Row>
            <Row label="">
              <Toggle checked={hd.matchCell} onChange={(v) => update('header', { matchCell: v })} label="Höhe & Abstand wie Tageszellen" />
            </Row>
            {!hd.matchCell && (
              <>
                <Row label="Höhe">
                  <NumberField value={hd.height} onChange={(v) => update('header', { height: v })} min={0} max={200} sliderMin={2} sliderMax={30} step={0.25} unit="mm" />
                </Row>
                <Row label="Abstand zum Raster">
                  <NumberField value={hd.gap} onChange={(v) => update('header', { gap: v })} min={0} max={100} sliderMax={15} step={0.25} unit="mm" />
                </Row>
              </>
            )}
            {(hd.background === 'cells' || hd.background === 'bar') && (
              <>
                <Row label="Hintergrundfarbe">
                  <ColorField value={hd.bgColor} onChange={(v) => update('header', { bgColor: v })} />
                </Row>
                <Row label="Eckenradius">
                  <NumberField value={hd.bgRadius} onChange={(v) => update('header', { bgRadius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
              </>
            )}
            <Row label="">
              <Toggle checked={hd.autoFit} onChange={(v) => update('header', { autoFit: v })} label="Zu lange Wochentage verkleinern" />
            </Row>
            <Row label="">
              <Toggle checked={hd.weekendColors} onChange={(v) => update('header', { weekendColors: v })} label="Wochenendfarben übernehmen" />
            </Row>
          </Section>,
        )}

        {sec(
          'title',
          'Monatstitel',
          <Section id="title" title="Monatstitel" icon={<IconType />} enabled={t.show} onEnabledChange={(v) => update('title', { show: v })}>
            <Row label="Format">
              <Segmented
                value={t.format}
                onChange={(v) => update('title', { format: v })}
                options={[
                  { value: 'long', label: 'Januar' },
                  { value: 'short', label: 'Jan.' },
                  { value: 'numeric', label: '01' },
                ]}
              />
            </Row>
            <Row label="Schreibweise">
              <Segmented value={t.textCase} onChange={(v) => update('title', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={t} onChange={(p) => update('title', p)} sizeMax={120} />
            <Row label="Position">
              <Segmented
                value={t.position}
                onChange={(v) => update('title', { position: v })}
                options={[
                  { value: 'top', label: 'Über dem Raster' },
                  { value: 'bottom', label: 'Darunter' },
                ]}
              />
            </Row>
            <Row label="Ausrichtung">
              <Segmented
                value={t.align}
                onChange={(v) => update('title', { align: v })}
                options={[
                  { value: 'left', label: 'Links' },
                  { value: 'center', label: 'Mitte' },
                  { value: 'right', label: 'Rechts' },
                ]}
              />
            </Row>
            <Row label="Versatz seitlich">
              <NumberField value={t.offsetX} onChange={(v) => update('title', { offsetX: v })} min={-500} max={500} sliderMin={-20} sliderMax={20} step={0.25} unit="mm" />
            </Row>
            <Row label="Abstand zum Raster" hint="gemessen von der Schriftlinie">
              <NumberField value={t.gap} onChange={(v) => update('title', { gap: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <SubHeading>Jahreszahl</SubHeading>
            <Row label="">
              <Toggle checked={t.showYear} onChange={(v) => update('title', { showYear: v })} label="Jahr hinter dem Monat zeigen" />
            </Row>
            {t.showYear && (
              <>
                <Row label="Schrift" stack>
                  <FontPicker value={t.yearFont} onChange={(v) => update('title', { yearFont: v })} />
                </Row>
                <Row label="Größe">
                  <NumberField value={t.yearSize} onChange={(v) => update('title', { yearSize: v })} min={2} max={300} sliderMin={4} sliderMax={120} step={0.5} unit="pt" />
                </Row>
                <Row label="Farbe">
                  <ColorField value={t.yearColor} onChange={(v) => update('title', { yearColor: v })} />
                </Row>
                <Row label="Trennzeichen">
                  <TextField value={t.yearSeparator} onChange={(v) => update('title', { yearSeparator: v })} placeholder="Leerzeichen" />
                </Row>
              </>
            )}
          </Section>,
        )}

        {sec(
          'highlight',
          'Wochenende & Feiertage',
          <Section id="highlight" title="Wochenende & Hervorhebungen" icon={<IconStar />}>
            <SubHeading>Samstag</SubHeading>
            <OverrideEditor value={cfg.highlight.saturday} onChange={setHighlight('saturday')} enableLabel="Samstage hervorheben" showBadge={badgeOn} />
            <SubHeading>Sonntag</SubHeading>
            <OverrideEditor value={cfg.highlight.sunday} onChange={setHighlight('sunday')} enableLabel="Sonntage hervorheben" showBadge={badgeOn} />
            <SubHeading>Feiertage & markierte Einträge</SubHeading>
            <OverrideEditor value={cfg.highlight.holiday} onChange={setHighlight('holiday')} enableLabel="Feiertage hervorheben" showBadge={badgeOn} />
            <Hint>„Beschriftung“ färbt den Wochentag in der Zelle sowie Feiertags- und Eintragsnamen.</Hint>
          </Section>,
        )}

        {sec(
          'holidays',
          'Feiertage & Einträge',
          <Section id="holidays" title="Feiertage & eigene Einträge" icon={<IconFlag />}>
            <Row label="Feiertage">
              <Select value={hol.region} options={REGIONS.map((r) => ({ value: r.id, label: r.label, group: r.group || undefined }))} onChange={(v) => update('holidays', { region: v })} />
            </Row>
            <Row label="">
              <Toggle checked={hol.observances} onChange={(v) => update('holidays', { observances: v })} label="Gedenk- und Aktionstage (Muttertag, Zeitumstellung, Heiligabend …)" />
            </Row>
            <Row label="">
              <Toggle checked={hol.showNames} onChange={(v) => update('holidays', { showNames: v })} label="Namen in den Zellen anzeigen" />
            </Row>
            {hol.showNames && (
              <>
                <TextStyleRows value={hol} onChange={(p) => update('holidays', p)} sizeMax={20} />
                <Row label="Schreibweise">
                  <Segmented value={hol.textCase} onChange={(v) => update('holidays', { textCase: v })} options={CASES} />
                </Row>
                <Row label="Position">
                  <div className="inline is-top">
                    <AnchorPicker value={hol.anchor} onChange={(v) => update('holidays', { anchor: v })} />
                    <div className="pad-fields">
                      <label>
                        <span>Abstand seitlich</span>
                        <NumberField value={hol.padX} onChange={(v) => update('holidays', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                      </label>
                      <label>
                        <span>Abstand oben/unten</span>
                        <NumberField value={hol.padY} onChange={(v) => update('holidays', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                      </label>
                    </div>
                  </div>
                </Row>
                <Row label="Max. Zeilen">
                  <NumberField value={hol.maxLines} onChange={(v) => update('holidays', { maxLines: Math.round(v) })} min={1} max={8} step={1} />
                </Row>
                <Row label="Zeilenabstand">
                  <NumberField value={hol.lineHeight} onChange={(v) => update('holidays', { lineHeight: v })} min={60} max={250} step={5} unit="%" />
                </Row>
              </>
            )}
            <SubHeading>Eigene Einträge (Geburtstage, Termine …)</SubHeading>
            <TextArea
              value={hol.entries}
              onChange={(v) => update('holidays', { entries: v })}
              rows={6}
              placeholder={'24.12. Heiligabend\n12.05.2027 Geburtstag Anna\n!15.08. Urlaub   (mit ! hervorheben)'}
            />
            {entryErrors.length > 0 && <Hint tone="warn">Nicht erkannte Zeile(n): {entryErrors.join(', ')} – Format „TT.MM. Text“ oder „TT.MM.JJJJ Text“.</Hint>}
            <Hint>Eine Zeile pro Eintrag: „TT.MM. Text“ (jedes Jahr) oder „TT.MM.JJJJ Text“. Mit „!“ am Anfang wird der Tag wie ein Feiertag hervorgehoben.</Hint>
          </Section>,
        )}

        {sec(
          'lines',
          'Notizlinien',
          <Section id="lines" title="Notizlinien" icon={<IconLines />} enabled={ln.show} onEnabledChange={(v) => update('lines', { show: v })}>
            <Row label="Anzahl">
              <NumberField value={ln.count} onChange={(v) => update('lines', { count: Math.round(v) })} min={1} max={30} sliderMax={12} step={1} />
            </Row>
            <Row label="Farbe">
              <ColorField value={ln.color} onChange={(v) => update('lines', { color: v })} />
            </Row>
            <Row label="Linienstärke">
              <NumberField value={ln.width} onChange={(v) => update('lines', { width: v })} min={0.05} max={10} sliderMax={3} step={0.05} unit="pt" />
            </Row>
            <Row label="Linienart">
              <Segmented value={ln.style} onChange={(v) => update('lines', { style: v })} options={STROKE_STYLES} />
            </Row>
            <Row label="Erste Linie" hint="Abstand vom oberen Rand der Form">
              <NumberField value={ln.top} onChange={(v) => update('lines', { top: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <Row label="Letzte Linie" hint="Abstand vom unteren Rand der Form">
              <NumberField value={ln.bottom} onChange={(v) => update('lines', { bottom: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <Row label="Einzug seitlich">
              <NumberField value={ln.inset} onChange={(v) => update('lines', { inset: v })} min={0} max={100} sliderMax={15} step={0.25} unit="mm" />
            </Row>
          </Section>,
        )}

        {sec(
          'weeknumbers',
          'Kalenderwochen',
          <Section id="weeknumbers" title="Kalenderwochen (KW)" icon={<IconWeek />} enabled={wn.show} onEnabledChange={(v) => update('weekNumbers', { show: v })}>
            <Row label="Seite">
              <Segmented
                value={wn.side}
                onChange={(v) => update('weekNumbers', { side: v })}
                options={[
                  { value: 'left', label: 'Links' },
                  { value: 'right', label: 'Rechts' },
                ]}
              />
            </Row>
            <Row label="Präfix">
              <TextField value={wn.prefix} onChange={(v) => update('weekNumbers', { prefix: v })} placeholder="z. B. „KW “" />
            </Row>
            <TextStyleRows value={wn} onChange={(p) => update('weekNumbers', p)} sizeMax={30} />
            <Row label="Spaltenbreite">
              <NumberField value={wn.width} onChange={(v) => update('weekNumbers', { width: v })} min={1} max={100} sliderMax={20} step={0.25} unit="mm" />
            </Row>
            <Row label="Abstand zum Raster">
              <NumberField value={wn.gap} onChange={(v) => update('weekNumbers', { gap: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
            </Row>
            <Row label="Vertikal">
              <Segmented
                value={wn.valign}
                onChange={(v) => update('weekNumbers', { valign: v })}
                options={[
                  { value: 'top', label: 'Oben' },
                  { value: 'middle', label: 'Mitte' },
                  { value: 'bottom', label: 'Unten' },
                ]}
              />
            </Row>
            <Hint>KW nach ISO 8601. Bei Wochenbeginn Sonntag zählt der Montag der jeweiligen Zeile.</Hint>
          </Section>,
        )}
      </div>
    </aside>
  );
}

/** Gemeinsame Zeilen für Schrift, Größe, Farbe, Laufweite. */
function TextStyleRows<T extends { font: Config['dayNumber']['font']; size: number; color: string; tracking: number }>(props: {
  value: T;
  onChange: (patch: Partial<T>) => void;
  sizeMax?: number;
}) {
  const v = props.value;
  return (
    <>
      <Row label="Schrift" stack>
        <FontPicker value={v.font} onChange={(font) => props.onChange({ font } as Partial<T>)} />
      </Row>
      <Row label="Größe">
        <NumberField value={v.size} onChange={(size) => props.onChange({ size } as Partial<T>)} min={1} max={400} sliderMin={3} sliderMax={props.sizeMax ?? 40} step={0.25} unit="pt" />
      </Row>
      <Row label="Farbe">
        <ColorField value={v.color} onChange={(color) => props.onChange({ color } as Partial<T>)} />
      </Row>
      <Row label="Laufweite">
        <NumberField value={v.tracking} onChange={(tracking) => props.onChange({ tracking } as Partial<T>)} min={-300} max={1000} sliderMin={-100} sliderMax={400} step={5} unit="‰" />
      </Row>
    </>
  );
}
