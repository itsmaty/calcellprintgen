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
import { t } from '../i18n';

export type Update = <K extends SectionKey>(section: K, patch: Partial<Config[K]>) => void;

const WEEKDAY_FORMATS: Option<WeekdayFormat>[] = [
  { value: 'long', label: t('Montag') },
  { value: 'short', label: t('Mo.') },
  { value: 'two', label: t('Mo') },
  { value: 'narrow', label: t('M') },
];

const CASES: Option<TextCase>[] = [
  { value: 'auto', label: t('Normal') },
  { value: 'upper', label: t('GROSS') },
  { value: 'lower', label: t('klein') },
];

const STROKE_STYLES: Option<StrokeStyle>[] = [
  { value: 'solid', label: t('Linie') },
  { value: 'dashed', label: t('Gestrichelt') },
  { value: 'dotted', label: t('Gepunktet') },
];

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: t('A4 quer (297 × 210)'), w: 297, h: 210 },
  { label: t('A4 hoch (210 × 297)'), w: 210, h: 297 },
  { label: t('A3 quer (420 × 297)'), w: 420, h: 297 },
  { label: t('A3 hoch (297 × 420)'), w: 297, h: 420 },
  { label: t('A5 quer (210 × 148)'), w: 210, h: 148 },
  { label: t('A5 hoch (148 × 210)'), w: 148, h: 210 },
  { label: t('Quadrat 300 × 300'), w: 300, h: 300 },
  { label: t('Quadrat 200 × 200'), w: 200, h: 200 },
  { label: t('US Letter quer (279,4 × 215,9)'), w: 279.4, h: 215.9 },
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
  { value: 'none', label: t('Keine') },
  { value: 'rect', label: t('Rechteck') },
  { value: 'parallelogram', label: t('Schräg') },
  { value: 'circle', label: t('Kreis') },
  { value: 'ellipse', label: t('Ellipse') },
  { value: 'squircle', label: t('Squircle') },
  { value: 'hexagon', label: t('Sechseck') },
];

const CORNERS: { value: CornerStyle; label: string }[] = [
  { value: 'round', label: t('Rund') },
  { value: 'bevel', label: t('Abgeschrägt') },
  { value: 'scoop', label: t('Nach innen') },
  { value: 'notch', label: t('Kerbe') },
];

/** Suchbegriffe je Abschnitt für das Suchfeld. */
const KEYWORDS: Record<string, string> = {
  general: 'kalender jahr sprache wochenbeginn montag sonntag namen monatsnamen bezeichnungen jänner calendar year language week start monday sunday names',
  layout: 'raster größe zellgröße breite höhe abstand rand format a4 a3 wochen zeilen hintergrund transparent grid size cell width height gap margin weeks rows background',
  overflow: 'überlauf überlauftage ausgegraut ausblenden leer nachbarmonat deckkraft overflow dimmed hidden empty adjacent opacity',
  shape: 'form zellform rechteck schräg parallelogramm neigung kreis ellipse squircle sechseck ecken radius abgerundet abgeschrägt shape rectangle slanted skew circle hexagon corners rounded bevel',
  fill: 'füllung farbe rahmen linie stärke gestrichelt gepunktet tabelle raster seiten schatten fill color gradient border stroke dashed dotted table shadow',
  day: 'tageszahl zahl nummer schrift größe farbe position führende null badge kreis day number font size color leading zero',
  weekday: 'wochentag zelle schrift weekday cell font',
  header: 'kopfzeile wochentage überschrift spalten hintergrund header weekdays columns',
  title: 'monatstitel titel monat jahr schrift überschrift month title year',
  highlight: 'wochenende samstag sonntag feiertag hervorhebung rot farbe weekend saturday sunday holiday highlight red',
  holidays: 'feiertage einträge geburtstage region bundesland österreich schweiz gedenktage namen holidays entries birthdays region state austria switzerland',
  lines: 'notizlinien linien notizen note lines notes',
  weeknumbers: 'kalenderwochen kw woche nummer week numbers cw',
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
  const ti = cfg.title;
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
        <input placeholder={t('Einstellung suchen …')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" className="icon-btn" onClick={() => setQuery('')} title={t('Suche leeren')}>
            <IconClose size={13} />
          </button>
        )}
      </div>
      <div className="sidebar-scroll" key={q ? 'search' : 'all'}>
        {!anyVisible && <div className="sidebar-empty">{t('Keine passende Einstellung gefunden.')}</div>}

        {sec(
          'general',
          t('Kalender'),
          <Section id="general" title={t('Kalender')} icon={<IconCalendar />} defaultOpen={!q} badge={<span className="pill">{g.year}</span>}>
            <Row label={t('Jahr')}>
              <NumberField value={g.year} onChange={(v) => update('general', { year: Math.round(v) })} min={1900} max={2200} step={1} slider={false} width={110} />
            </Row>
            <Row label={t('Sprache')}>
              <Select
                value={g.locale}
                options={LOCALES.map((l) => ({ value: l.id, label: t(l.label) }))}
                onChange={(v) => update('general', { locale: v })}
              />
            </Row>
            <Row label={t('Woche beginnt')}>
              <Segmented
                value={g.weekStart}
                onChange={(v) => update('general', { weekStart: v })}
                options={[
                  { value: 1, label: t('Montag') },
                  { value: 0, label: t('Sonntag') },
                  { value: 6, label: t('Samstag') },
                ]}
              />
            </Row>
            <Row label={t('Bezeichnungen')}>
              <Toggle checked={g.customNames} onChange={(v) => update('general', { customNames: v })} label={t('Eigene Monats- und Tagesnamen')} />
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
                    {t('Aus Sprache übernehmen')}
                  </button>
                </div>
                <Hint>{t('Eigene Wochentagsnamen werden unverändert verwendet (das Format „Mo/Mo./M“ gilt dann nicht).')}</Hint>
              </>
            )}
          </Section>,
        )}

        {sec(
          'layout',
          t('Raster & Größe'),
          <Section id="layout" title={t('Raster & Größe')} icon={<IconGrid />} defaultOpen={!q}>
            <Row label={t('Größe festlegen')}>
              <Segmented
                value={L.sizeMode}
                onChange={(v) => update('layout', { sizeMode: v })}
                options={[
                  { value: 'cell', label: t('Zellgröße') },
                  { value: 'total', label: t('Gesamtgröße') },
                ]}
              />
            </Row>
            {L.sizeMode === 'cell' ? (
              <>
                <Row label={t('Zellbreite')}>
                  <NumberField value={L.cellWidth} onChange={(v) => update('layout', { cellWidth: v })} min={2} max={500} sliderMin={8} sliderMax={80} step={0.5} unit="mm" />
                </Row>
                <Row label={t('Zellhöhe')}>
                  <NumberField value={L.cellHeight} onChange={(v) => update('layout', { cellHeight: v })} min={2} max={500} sliderMin={8} sliderMax={80} step={0.5} unit="mm" />
                </Row>
              </>
            ) : (
              <>
                <Row label={t('Format')}>
                  <Select
                    value={SIZE_PRESETS.find((p) => p.w === L.totalWidth && p.h === L.totalHeight)?.label ?? 'custom'}
                    options={[{ value: 'custom', label: t('Eigene Größe') }, ...SIZE_PRESETS.map((p) => ({ value: p.label, label: p.label }))]}
                    onChange={(v) => {
                      const p = SIZE_PRESETS.find((x) => x.label === v);
                      if (p) update('layout', { totalWidth: p.w, totalHeight: p.h });
                    }}
                  />
                </Row>
                <Row label={t('Breite gesamt')}>
                  <NumberField value={L.totalWidth} onChange={(v) => update('layout', { totalWidth: v })} min={20} max={2000} sliderMin={50} sliderMax={600} step={1} unit="mm" />
                </Row>
                <Row label={t('Höhe gesamt')}>
                  <NumberField value={L.totalHeight} onChange={(v) => update('layout', { totalHeight: v })} min={20} max={2000} sliderMin={50} sliderMax={600} step={1} unit="mm" />
                </Row>
              </>
            )}
            <Row label={t('Abstand waagrecht')}>
              <NumberField value={L.gapX} onChange={(v) => update('layout', { gapX: v })} min={0} max={100} sliderMax={12} step={0.25} unit="mm" disabled={gridMode} />
            </Row>
            <Row label={t('Abstand senkrecht')}>
              <NumberField value={L.gapY} onChange={(v) => update('layout', { gapY: v })} min={0} max={100} sliderMax={12} step={0.25} unit="mm" disabled={gridMode} />
            </Row>
            {gridMode && <Hint>{t('Im Tabellenraster liegen die Zellen ohne Abstand direkt aneinander.')}</Hint>}
            <Row label={t('Außenrand')}>
              <NumberField value={L.padding} onChange={(v) => update('layout', { padding: v })} min={0} max={100} sliderMax={20} step={0.5} unit="mm" />
            </Row>
            <Row label={t('Wochen pro Monat')}>
              <Segmented
                value={L.rows}
                onChange={(v) => update('layout', { rows: v })}
                options={[
                  { value: 'auto', label: t('Nach Bedarf (4–6)') },
                  { value: 'six', label: t('Immer 6') },
                ]}
              />
            </Row>
            <Row label={t('Hintergrund')}>
              <div className="inline">
                <Segmented
                  value={out.background}
                  onChange={(v) => update('output', { background: v })}
                  options={[
                    { value: 'transparent', label: t('Transparent') },
                    { value: 'color', label: t('Farbe') },
                  ]}
                />
                {out.background === 'color' && <ColorField value={out.backgroundColor} onChange={(v) => update('output', { backgroundColor: v })} compact />}
              </div>
            </Row>
            {geo && (
              <div className="info-box">
                <div>
                  <span>{t('Bildgröße')}</span>
                  <b>
                    {formatNumber(geo.width, 1)} × {formatNumber(geo.height, 1)} {t('mm')}
                  </b>
                </div>
                <div>
                  <span>{t('Zellgröße')}</span>
                  <b>
                    {formatNumber(geo.cellW, 2)} × {formatNumber(geo.cellH, 2)} {t('mm')}
                  </b>
                </div>
                {L.rows === 'auto' && <div className="info-note">{t('Monate mit 4, 5 oder 6 Wochen werden unterschiedlich hoch.')}</div>}
              </div>
            )}
          </Section>,
        )}

        {sec(
          'overflow',
          t('Überlauftage'),
          <Section id="overflow" title={t('Überlauftage (Nachbarmonate)')} icon={<IconRows />}>
            <Row label={t('Darstellung')}>
              <Segmented
                value={L.overflow}
                onChange={(v) => update('layout', { overflow: v })}
                options={[
                  { value: 'dimmed', label: t('Ausgegraut') },
                  { value: 'empty', label: t('Leere Zelle') },
                  { value: 'hidden', label: t('Ausblenden') },
                ]}
              />
            </Row>
            {L.overflow !== 'hidden' && (
              <>
                <Row label={t('Deckkraft')}>
                  <NumberField value={L.overflowOpacity} onChange={(v) => update('layout', { overflowOpacity: v })} min={0} max={100} step={1} unit="%" />
                </Row>
                <OverrideEditor value={cfg.highlight.overflow} onChange={setHighlight('overflow')} enableLabel={t('Eigene Farben für Überlauftage')} showBadge={badgeOn} />
              </>
            )}
            <Hint>
              {t('„Ausgegraut“ zeigt die Tage der Nachbarmonate abgeschwächt, „Leere Zelle“ nur die Form ohne Zahl, „Ausblenden“ lässt sie ganz weg.')}
            </Hint>
          </Section>,
        )}

        {sec(
          'shape',
          t('Zellform'),
          <Section id="shape" title={t('Zellform & Ecken')} icon={<IconShape />} defaultOpen={!q}>
            <div className="shape-picker">
              {SHAPES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  className={`shape-btn${c.shape === s.value ? ' is-active' : ''}`}
                  onClick={() => update('cell', { shape: s.value })}
                  disabled={gridMode && s.value !== 'rect'}
                  title={s.value === 'parallelogram' ? t('Schräg (Parallelogramm)') : s.label}
                >
                  <ShapeIcon shape={s.value} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            {gridMode && <Hint>{t('Im Tabellenraster sind Zellen immer eckige Rechtecke.')}</Hint>}
            {!gridMode && c.shape !== 'none' && (
              <Row label={t('Größe der Form')}>
                <NumberField value={c.scale} onChange={(v) => update('cell', { scale: v })} min={10} max={100} step={1} unit="%" />
              </Row>
            )}
            {!gridMode && c.shape === 'rect' && (
              <>
                <Row label={t('Ecken')}>
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
                  <Row label={c.cornerStyle === 'round' ? t('Radius') : t('Eckengröße')}>
                    <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={200} sliderMax={20} step={0.25} unit="mm" />
                  </Row>
                )}
                <Row label="">
                  <Toggle
                    checked={c.individualCorners}
                    onChange={(v) =>
                      update('cell', v ? { individualCorners: true, radiusTL: c.radius, radiusTR: c.radius, radiusBR: c.radius, radiusBL: c.radius } : { individualCorners: false })
                    }
                    label={t('Ecken einzeln einstellen')}
                  />
                </Row>
                {c.individualCorners && (
                  <div className="corner-grid">
                    {(
                      [
                        ['radiusTL', t('oben links')],
                        ['radiusTR', t('oben rechts')],
                        ['radiusBL', t('unten links')],
                        ['radiusBR', t('unten rechts')],
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
                <Row label={t('Neigung')} hint={t('positiv = nach rechts geneigt, negativ = nach links')}>
                  <NumberField value={c.skew} onChange={(v) => update('cell', { skew: v })} min={-60} max={60} sliderMin={-40} sliderMax={40} step={1} unit="°" />
                </Row>
                <Row label={t('Eckenradius')}>
                  <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
                <Row label="">
                  <Toggle checked={c.skewText} onChange={(v) => update('cell', { skewText: v })} label={t('Schrift mitneigen')} />
                </Row>
              </>
            )}
            {!gridMode && c.shape === 'squircle' && (
              <Row label={t('Eckigkeit')} hint={t('2 = Ellipse, höhere Werte = eckiger')}>
                <NumberField value={c.squircleN} onChange={(v) => update('cell', { squircleN: v })} min={2} max={20} sliderMax={12} step={0.1} />
              </Row>
            )}
            {!gridMode && c.shape === 'hexagon' && (
              <>
                <Row label={t('Ausrichtung')}>
                  <Segmented
                    value={c.hexOrientation}
                    onChange={(v) => update('cell', { hexOrientation: v })}
                    options={[
                      { value: 'pointy', label: t('Spitze oben') },
                      { value: 'flat', label: t('Flach oben') },
                    ]}
                  />
                </Row>
                <Row label={t('Eckenradius')}>
                  <NumberField value={c.radius} onChange={(v) => update('cell', { radius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
              </>
            )}
          </Section>,
        )}

        {sec(
          'fill',
          t('Füllung & Rahmen'),
          <Section id="fill" title={t('Füllung, Rahmen & Schatten')} icon={<IconPalette />} defaultOpen={!q}>
            <Row label={t('Füllung')}>
              <div className="inline">
                <Toggle checked={c.fillEnabled} onChange={(v) => update('cell', { fillEnabled: v })} label="" />
                <ColorField value={c.fill} onChange={(v) => update('cell', { fill: v, fillEnabled: true })} disabled={!c.fillEnabled} />
              </div>
            </Row>
            {c.fillEnabled && (
              <>
                <Row label={t('Füllart')}>
                  <Segmented
                    value={c.fillMode}
                    onChange={(v) => update('cell', { fillMode: v })}
                    options={[
                      { value: 'solid', label: t('Einfarbig') },
                      { value: 'gradient', label: t('Verlauf') },
                    ]}
                  />
                </Row>
                {c.fillMode === 'gradient' && (
                  <>
                    <Row label={t('Verlauf bis')}>
                      <ColorField value={c.fill2} onChange={(v) => update('cell', { fill2: v })} />
                    </Row>
                    <Row label={t('Richtung')}>
                      <Segmented
                        value={c.gradientDir}
                        onChange={(v) => update('cell', { gradientDir: v })}
                        options={[
                          { value: 'vertical', label: t('↓ Senkrecht') },
                          { value: 'horizontal', label: t('→ Waagrecht') },
                          { value: 'diagonal', label: t('↘ Diagonal') },
                        ]}
                      />
                    </Row>
                  </>
                )}
                <Row label={t('Deckkraft')}>
                  <NumberField value={c.fillOpacity} onChange={(v) => update('cell', { fillOpacity: v })} min={0} max={100} step={1} unit="%" />
                </Row>
              </>
            )}
            <Row label={t('Rahmen')}>
              <div className="inline">
                <Toggle checked={c.strokeEnabled} onChange={(v) => update('cell', { strokeEnabled: v })} label="" />
                <ColorField value={c.stroke} onChange={(v) => update('cell', { stroke: v, strokeEnabled: true })} disabled={!c.strokeEnabled} />
              </div>
            </Row>
            {c.strokeEnabled && (
              <>
                <Row label={t('Linienstärke')}>
                  <NumberField value={c.strokeWidth} onChange={(v) => update('cell', { strokeWidth: v })} min={0.05} max={30} sliderMin={0.1} sliderMax={6} step={0.05} unit="pt" />
                </Row>
                <Row label={t('Linienart')}>
                  <Segmented value={c.strokeStyle} onChange={(v) => update('cell', { strokeStyle: v })} options={STROKE_STYLES} />
                </Row>
                {c.strokeStyle === 'dashed' && (
                  <Row label={t('Strich / Lücke')}>
                    <div className="inline">
                      <NumberField value={c.dashLength} onChange={(v) => update('cell', { dashLength: v })} min={0.1} max={50} step={0.1} unit="mm" slider={false} />
                      <NumberField value={c.dashGap} onChange={(v) => update('cell', { dashGap: v })} min={0.1} max={50} step={0.1} unit="mm" slider={false} />
                    </div>
                  </Row>
                )}
                {c.strokeStyle === 'dotted' && (
                  <Row label={t('Punktabstand')}>
                    <NumberField value={c.dashGap} onChange={(v) => update('cell', { dashGap: v })} min={0.1} max={50} sliderMax={5} step={0.1} unit="mm" />
                  </Row>
                )}
                <Row label={t('Rahmen-Art')}>
                  <Segmented
                    value={c.borderMode}
                    onChange={(v) => update('cell', { borderMode: v })}
                    options={[
                      { value: 'cell', label: t('Je Zelle') },
                      { value: 'grid', label: t('Tabellenraster') },
                    ]}
                  />
                </Row>
                {!gridMode && c.shape === 'rect' && (
                  <Row label={t('Seiten')}>
                    <div className="check-row">
                      <Check checked={c.sideTop} onChange={(v) => update('cell', { sideTop: v })} label={t('Oben')} />
                      <Check checked={c.sideRight} onChange={(v) => update('cell', { sideRight: v })} label={t('Rechts')} />
                      <Check checked={c.sideBottom} onChange={(v) => update('cell', { sideBottom: v })} label={t('Unten')} />
                      <Check checked={c.sideLeft} onChange={(v) => update('cell', { sideLeft: v })} label={t('Links')} />
                    </div>
                  </Row>
                )}
                {gridMode && (
                  <Row label={t('Linien')}>
                    <div className="check-row">
                      <Check checked={c.gridOuter} onChange={(v) => update('cell', { gridOuter: v })} label={t('Außen')} />
                      <Check checked={c.gridInnerH} onChange={(v) => update('cell', { gridInnerH: v })} label={t('Waagrecht')} />
                      <Check checked={c.gridInnerV} onChange={(v) => update('cell', { gridInnerV: v })} label={t('Senkrecht')} />
                    </div>
                  </Row>
                )}
              </>
            )}
            {!gridMode && c.shape !== 'none' && (
              <>
                <SubHeading>{t('Schatten')}</SubHeading>
                <Row label={t('Schatten')}>
                  <div className="inline">
                    <Toggle checked={c.shadowEnabled} onChange={(v) => update('cell', { shadowEnabled: v })} label="" />
                    <ColorField value={c.shadowColor} onChange={(v) => update('cell', { shadowColor: v, shadowEnabled: true })} disabled={!c.shadowEnabled} />
                  </div>
                </Row>
                {c.shadowEnabled && (
                  <>
                    <Row label={t('Versatz X / Y')}>
                      <div className="inline">
                        <NumberField value={c.shadowX} onChange={(v) => update('cell', { shadowX: v })} min={-50} max={50} step={0.1} unit="mm" slider={false} />
                        <NumberField value={c.shadowY} onChange={(v) => update('cell', { shadowY: v })} min={-50} max={50} step={0.1} unit="mm" slider={false} />
                      </div>
                    </Row>
                    <Row label={t('Weichzeichnen')}>
                      <NumberField value={c.shadowBlur} onChange={(v) => update('cell', { shadowBlur: v })} min={0} max={30} sliderMax={6} step={0.1} unit="mm" />
                    </Row>
                    <Row label={t('Deckkraft')}>
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
          t('Tageszahl'),
          <Section id="day" title={t('Tageszahl')} icon={<IconHash />} enabled={dn.show} onEnabledChange={(v) => update('dayNumber', { show: v })} defaultOpen={!q}>
            <Row label={t('Schrift')} stack>
              <FontPicker value={dn.font} onChange={(v) => update('dayNumber', { font: v })} />
            </Row>
            <Row label={t('Größe')}>
              <NumberField value={dn.size} onChange={(v) => update('dayNumber', { size: v })} min={2} max={300} sliderMin={4} sliderMax={60} step={0.5} unit="pt" />
            </Row>
            <Row label={t('Farbe')}>
              <ColorField value={dn.color} onChange={(v) => update('dayNumber', { color: v })} />
            </Row>
            <Row label={t('Laufweite')}>
              <NumberField value={dn.tracking} onChange={(v) => update('dayNumber', { tracking: v })} min={-300} max={1000} sliderMin={-100} sliderMax={400} step={5} unit="‰" />
            </Row>
            <Row label={t('Position')}>
              <div className="inline is-top">
                <AnchorPicker value={dn.anchor} onChange={(v) => update('dayNumber', { anchor: v })} />
                <div className="pad-fields">
                  <label>
                    <span>{t('Abstand seitlich')}</span>
                    <NumberField value={dn.padX} onChange={(v) => update('dayNumber', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                  <label>
                    <span>{t('Abstand oben/unten')}</span>
                    <NumberField value={dn.padY} onChange={(v) => update('dayNumber', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                </div>
              </div>
            </Row>
            <Row label={t('Text davor / danach')} hint={t('z. B. „.“ dahinter ergibt „1.“, „2.“ …')}>
              <div className="inline">
                <TextField value={dn.prefix} onChange={(v) => update('dayNumber', { prefix: v })} placeholder={t('davor')} />
                <TextField value={dn.suffix} onChange={(v) => update('dayNumber', { suffix: v })} placeholder={t('danach')} />
              </div>
            </Row>
            <Row label="">
              <Toggle checked={dn.leadingZero} onChange={(v) => update('dayNumber', { leadingZero: v })} label={t('Führende Null (01, 02 …)')} />
            </Row>
            <SubHeading>{t('Hintergrund der Zahl (Badge)')}</SubHeading>
            <Row label={t('Badge')}>
              <Segmented
                value={dn.badge}
                onChange={(v) => update('dayNumber', { badge: v })}
                options={[
                  { value: 'none', label: t('Keiner') },
                  { value: 'circle', label: t('Kreis') },
                  { value: 'square', label: t('Quadrat') },
                ]}
              />
            </Row>
            {badgeOn && (
              <>
                <Row label={t('Zeigen bei')}>
                  <Segmented
                    value={dn.badgeScope}
                    onChange={(v) => update('dayNumber', { badgeScope: v })}
                    options={[
                      { value: 'all', label: t('Allen Tagen') },
                      { value: 'highlighted', label: t('Nur hervorgehobenen') },
                    ]}
                  />
                </Row>
                <Row label={t('Größe')}>
                  <NumberField value={dn.badgeSize} onChange={(v) => update('dayNumber', { badgeSize: v })} min={1} max={200} sliderMin={2} sliderMax={30} step={0.25} unit="mm" />
                </Row>
                {dn.badge === 'square' && (
                  <Row label={t('Eckenradius')}>
                    <NumberField value={dn.badgeRadius} onChange={(v) => update('dayNumber', { badgeRadius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                  </Row>
                )}
                <Row label={t('Farbe')}>
                  <ColorField value={dn.badgeColor} onChange={(v) => update('dayNumber', { badgeColor: v })} />
                </Row>
                <Hint>{t('Mit Badge sitzt die Zahl mittig im Badge; die Position bestimmt dann, wo das Badge steht.')}</Hint>
              </>
            )}
          </Section>,
        )}

        {sec(
          'weekday',
          t('Wochentag in der Zelle'),
          <Section id="weekday" title={t('Wochentag in der Zelle')} icon={<IconType />} enabled={wd.show} onEnabledChange={(v) => update('weekday', { show: v })}>
            <Row label={t('Format')}>
              <Segmented value={wd.format} onChange={(v) => update('weekday', { format: v })} options={WEEKDAY_FORMATS} />
            </Row>
            <Row label={t('Schreibweise')}>
              <Segmented value={wd.textCase} onChange={(v) => update('weekday', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={wd} onChange={(p) => update('weekday', p)} />
            <Row label={t('Position')}>
              <div className="inline is-top">
                <AnchorPicker value={wd.anchor} onChange={(v) => update('weekday', { anchor: v })} />
                <div className="pad-fields">
                  <label>
                    <span>{t('Abstand seitlich')}</span>
                    <NumberField value={wd.padX} onChange={(v) => update('weekday', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                  <label>
                    <span>{t('Abstand oben/unten')}</span>
                    <NumberField value={wd.padY} onChange={(v) => update('weekday', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                  </label>
                </div>
              </div>
            </Row>
          </Section>,
        )}

        {sec(
          'header',
          t('Kopfzeile'),
          <Section id="header" title={t('Kopfzeile (Wochentage)')} icon={<IconHeading />} enabled={hd.show} onEnabledChange={(v) => update('header', { show: v })}>
            <Row label={t('Format')}>
              <Segmented value={hd.format} onChange={(v) => update('header', { format: v })} options={WEEKDAY_FORMATS} />
            </Row>
            <Row label={t('Schreibweise')}>
              <Segmented value={hd.textCase} onChange={(v) => update('header', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={hd} onChange={(p) => update('header', p)} />
            <Row label={t('Ausrichtung')}>
              <Segmented
                value={hd.align}
                onChange={(v) => update('header', { align: v })}
                options={[
                  { value: 'left', label: t('Links') },
                  { value: 'center', label: t('Mitte') },
                  { value: 'right', label: t('Rechts') },
                ]}
              />
            </Row>
            {hd.align !== 'center' && (
              <Row label={t('Abstand seitlich')}>
                <NumberField value={hd.padX} onChange={(v) => update('header', { padX: v })} min={-50} max={100} sliderMax={10} step={0.1} unit="mm" />
              </Row>
            )}
            <Row label={t('Kästchen')}>
              <Segmented
                value={hd.background}
                onChange={(v) => update('header', { background: v })}
                wrap
                options={[
                  { value: 'cell', label: t('Wie Tageszellen') },
                  { value: 'cells', label: t('Farbfläche je Spalte') },
                  { value: 'bar', label: t('Balken') },
                  { value: 'none', label: t('Keine') },
                ]}
              />
            </Row>
            <Row label="">
              <Toggle checked={hd.matchCell} onChange={(v) => update('header', { matchCell: v })} label={t('Höhe & Abstand wie Tageszellen')} />
            </Row>
            {!hd.matchCell && (
              <>
                <Row label={t('Höhe')}>
                  <NumberField value={hd.height} onChange={(v) => update('header', { height: v })} min={0} max={200} sliderMin={2} sliderMax={30} step={0.25} unit="mm" />
                </Row>
                <Row label={t('Abstand zum Raster')}>
                  <NumberField value={hd.gap} onChange={(v) => update('header', { gap: v })} min={0} max={100} sliderMax={15} step={0.25} unit="mm" />
                </Row>
              </>
            )}
            {(hd.background === 'cells' || hd.background === 'bar') && (
              <>
                <Row label={t('Hintergrundfarbe')}>
                  <ColorField value={hd.bgColor} onChange={(v) => update('header', { bgColor: v })} />
                </Row>
                <Row label={t('Eckenradius')}>
                  <NumberField value={hd.bgRadius} onChange={(v) => update('header', { bgRadius: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
                </Row>
              </>
            )}
            <Row label="">
              <Toggle checked={hd.autoFit} onChange={(v) => update('header', { autoFit: v })} label={t('Zu lange Wochentage verkleinern')} />
            </Row>
            <Row label="">
              <Toggle checked={hd.weekendColors} onChange={(v) => update('header', { weekendColors: v })} label={t('Wochenendfarben übernehmen')} />
            </Row>
          </Section>,
        )}

        {sec(
          'title',
          t('Monatstitel'),
          <Section id="title" title={t('Monatstitel')} icon={<IconType />} enabled={ti.show} onEnabledChange={(v) => update('title', { show: v })}>
            <Row label={t('Format')}>
              <Segmented
                value={ti.format}
                onChange={(v) => update('title', { format: v })}
                options={[
                  { value: 'long', label: t('Januar') },
                  { value: 'short', label: t('Jan.') },
                  { value: 'numeric', label: '01' },
                ]}
              />
            </Row>
            <Row label={t('Schreibweise')}>
              <Segmented value={ti.textCase} onChange={(v) => update('title', { textCase: v })} options={CASES} />
            </Row>
            <TextStyleRows value={ti} onChange={(p) => update('title', p)} sizeMax={120} />
            <Row label={t('Position')}>
              <Segmented
                value={ti.position}
                onChange={(v) => update('title', { position: v })}
                options={[
                  { value: 'top', label: t('Über dem Raster') },
                  { value: 'bottom', label: t('Darunter') },
                ]}
              />
            </Row>
            <Row label={t('Ausrichtung')}>
              <Segmented
                value={ti.align}
                onChange={(v) => update('title', { align: v })}
                options={[
                  { value: 'left', label: t('Links') },
                  { value: 'center', label: t('Mitte') },
                  { value: 'right', label: t('Rechts') },
                ]}
              />
            </Row>
            <Row label={t('Versatz seitlich')}>
              <NumberField value={ti.offsetX} onChange={(v) => update('title', { offsetX: v })} min={-500} max={500} sliderMin={-20} sliderMax={20} step={0.25} unit="mm" />
            </Row>
            <Row label={t('Abstand zum Raster')} hint={t('gemessen von der Schriftlinie')}>
              <NumberField value={ti.gap} onChange={(v) => update('title', { gap: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <SubHeading>{t('Jahreszahl')}</SubHeading>
            <Row label="">
              <Toggle checked={ti.showYear} onChange={(v) => update('title', { showYear: v })} label={t('Jahr hinter dem Monat zeigen')} />
            </Row>
            {ti.showYear && (
              <>
                <Row label={t('Schrift')} stack>
                  <FontPicker value={ti.yearFont} onChange={(v) => update('title', { yearFont: v })} />
                </Row>
                <Row label={t('Größe')}>
                  <NumberField value={ti.yearSize} onChange={(v) => update('title', { yearSize: v })} min={2} max={300} sliderMin={4} sliderMax={120} step={0.5} unit="pt" />
                </Row>
                <Row label={t('Farbe')}>
                  <ColorField value={ti.yearColor} onChange={(v) => update('title', { yearColor: v })} />
                </Row>
                <Row label={t('Trennzeichen')}>
                  <TextField value={ti.yearSeparator} onChange={(v) => update('title', { yearSeparator: v })} placeholder={t('Leerzeichen')} />
                </Row>
              </>
            )}
          </Section>,
        )}

        {sec(
          'highlight',
          t('Wochenende & Feiertage'),
          <Section id="highlight" title={t('Wochenende & Hervorhebungen')} icon={<IconStar />}>
            <SubHeading>{t('Samstag')}</SubHeading>
            <OverrideEditor value={cfg.highlight.saturday} onChange={setHighlight('saturday')} enableLabel={t('Samstage hervorheben')} showBadge={badgeOn} />
            <SubHeading>{t('Sonntag')}</SubHeading>
            <OverrideEditor value={cfg.highlight.sunday} onChange={setHighlight('sunday')} enableLabel={t('Sonntage hervorheben')} showBadge={badgeOn} />
            <SubHeading>{t('Feiertage & markierte Einträge')}</SubHeading>
            <OverrideEditor value={cfg.highlight.holiday} onChange={setHighlight('holiday')} enableLabel={t('Feiertage hervorheben')} showBadge={badgeOn} />
            <Hint>{t('„Beschriftung“ färbt den Wochentag in der Zelle sowie Feiertags- und Eintragsnamen.')}</Hint>
          </Section>,
        )}

        {sec(
          'holidays',
          t('Feiertage & Einträge'),
          <Section id="holidays" title={t('Feiertage & eigene Einträge')} icon={<IconFlag />}>
            <Row label={t('Feiertage')}>
              <Select value={hol.region} options={REGIONS.map((r) => ({ value: r.id, label: t(r.label), group: r.group ? t(r.group) : undefined }))} onChange={(v) => update('holidays', { region: v })} />
            </Row>
            <Row label="">
              <Toggle checked={hol.observances} onChange={(v) => update('holidays', { observances: v })} label={t('Gedenk- und Aktionstage (Muttertag, Zeitumstellung, Heiligabend …)')} />
            </Row>
            <Row label="">
              <Toggle checked={hol.showNames} onChange={(v) => update('holidays', { showNames: v })} label={t('Namen in den Zellen anzeigen')} />
            </Row>
            {hol.showNames && (
              <>
                <TextStyleRows value={hol} onChange={(p) => update('holidays', p)} sizeMax={20} />
                <Row label={t('Schreibweise')}>
                  <Segmented value={hol.textCase} onChange={(v) => update('holidays', { textCase: v })} options={CASES} />
                </Row>
                <Row label={t('Position')}>
                  <div className="inline is-top">
                    <AnchorPicker value={hol.anchor} onChange={(v) => update('holidays', { anchor: v })} />
                    <div className="pad-fields">
                      <label>
                        <span>{t('Abstand seitlich')}</span>
                        <NumberField value={hol.padX} onChange={(v) => update('holidays', { padX: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                      </label>
                      <label>
                        <span>{t('Abstand oben/unten')}</span>
                        <NumberField value={hol.padY} onChange={(v) => update('holidays', { padY: v })} min={-50} max={100} step={0.1} unit="mm" slider={false} />
                      </label>
                    </div>
                  </div>
                </Row>
                <Row label={t('Max. Zeilen')}>
                  <NumberField value={hol.maxLines} onChange={(v) => update('holidays', { maxLines: Math.round(v) })} min={1} max={8} step={1} />
                </Row>
                <Row label={t('Zeilenabstand')}>
                  <NumberField value={hol.lineHeight} onChange={(v) => update('holidays', { lineHeight: v })} min={60} max={250} step={5} unit="%" />
                </Row>
              </>
            )}
            <SubHeading>{t('Eigene Einträge (Geburtstage, Termine …)')}</SubHeading>
            <TextArea
              value={hol.entries}
              onChange={(v) => update('holidays', { entries: v })}
              rows={6}
              placeholder={t('24.12. Heiligabend\n12.05.2027 Geburtstag Anna\n!15.08. Urlaub   (mit ! hervorheben)')}
            />
            {entryErrors.length > 0 && <Hint tone="warn">{t('Nicht erkannte Zeile(n):')} {entryErrors.join(', ')} {t('– Format „TT.MM. Text“ oder „TT.MM.JJJJ Text“.')}</Hint>}
            <Hint>{t('Eine Zeile pro Eintrag: „TT.MM. Text“ (jedes Jahr) oder „TT.MM.JJJJ Text“. Mit „!“ am Anfang wird der Tag wie ein Feiertag hervorgehoben.')}</Hint>
          </Section>,
        )}

        {sec(
          'lines',
          t('Notizlinien'),
          <Section id="lines" title={t('Notizlinien')} icon={<IconLines />} enabled={ln.show} onEnabledChange={(v) => update('lines', { show: v })}>
            <Row label={t('Anzahl')}>
              <NumberField value={ln.count} onChange={(v) => update('lines', { count: Math.round(v) })} min={1} max={30} sliderMax={12} step={1} />
            </Row>
            <Row label={t('Farbe')}>
              <ColorField value={ln.color} onChange={(v) => update('lines', { color: v })} />
            </Row>
            <Row label={t('Linienstärke')}>
              <NumberField value={ln.width} onChange={(v) => update('lines', { width: v })} min={0.05} max={10} sliderMax={3} step={0.05} unit="pt" />
            </Row>
            <Row label={t('Linienart')}>
              <Segmented value={ln.style} onChange={(v) => update('lines', { style: v })} options={STROKE_STYLES} />
            </Row>
            <Row label={t('Erste Linie')} hint={t('Abstand vom oberen Rand der Form')}>
              <NumberField value={ln.top} onChange={(v) => update('lines', { top: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <Row label={t('Letzte Linie')} hint={t('Abstand vom unteren Rand der Form')}>
              <NumberField value={ln.bottom} onChange={(v) => update('lines', { bottom: v })} min={0} max={200} sliderMax={40} step={0.25} unit="mm" />
            </Row>
            <Row label={t('Einzug seitlich')}>
              <NumberField value={ln.inset} onChange={(v) => update('lines', { inset: v })} min={0} max={100} sliderMax={15} step={0.25} unit="mm" />
            </Row>
          </Section>,
        )}

        {sec(
          'weeknumbers',
          t('Kalenderwochen'),
          <Section id="weeknumbers" title={t('Kalenderwochen (KW)')} icon={<IconWeek />} enabled={wn.show} onEnabledChange={(v) => update('weekNumbers', { show: v })}>
            <Row label={t('Seite')}>
              <Segmented
                value={wn.side}
                onChange={(v) => update('weekNumbers', { side: v })}
                options={[
                  { value: 'left', label: t('Links') },
                  { value: 'right', label: t('Rechts') },
                ]}
              />
            </Row>
            <Row label={t('Präfix')}>
              <TextField value={wn.prefix} onChange={(v) => update('weekNumbers', { prefix: v })} placeholder={t('z. B. „KW “')} />
            </Row>
            <TextStyleRows value={wn} onChange={(p) => update('weekNumbers', p)} sizeMax={30} />
            <Row label={t('Spaltenbreite')}>
              <NumberField value={wn.width} onChange={(v) => update('weekNumbers', { width: v })} min={1} max={100} sliderMax={20} step={0.25} unit="mm" />
            </Row>
            <Row label={t('Abstand zum Raster')}>
              <NumberField value={wn.gap} onChange={(v) => update('weekNumbers', { gap: v })} min={0} max={100} sliderMax={10} step={0.25} unit="mm" />
            </Row>
            <Row label={t('Vertikal')}>
              <Segmented
                value={wn.valign}
                onChange={(v) => update('weekNumbers', { valign: v })}
                options={[
                  { value: 'top', label: t('Oben') },
                  { value: 'middle', label: t('Mitte') },
                  { value: 'bottom', label: t('Unten') },
                ]}
              />
            </Row>
            <Hint>{t('KW nach ISO 8601. Bei Wochenbeginn Sonntag zählt der Montag der jeweiligen Zeile.')}</Hint>
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
      <Row label={t('Schrift')} stack>
        <FontPicker value={v.font} onChange={(font) => props.onChange({ font } as Partial<T>)} />
      </Row>
      <Row label={t('Größe')}>
        <NumberField value={v.size} onChange={(size) => props.onChange({ size } as Partial<T>)} min={1} max={400} sliderMin={3} sliderMax={props.sizeMax ?? 40} step={0.25} unit="pt" />
      </Row>
      <Row label={t('Farbe')}>
        <ColorField value={v.color} onChange={(color) => props.onChange({ color } as Partial<T>)} />
      </Row>
      <Row label={t('Laufweite')}>
        <NumberField value={v.tracking} onChange={(tracking) => props.onChange({ tracking } as Partial<T>)} min={-300} max={1000} sliderMin={-100} sliderMax={400} step={5} unit="‰" />
      </Row>
    </>
  );
}
