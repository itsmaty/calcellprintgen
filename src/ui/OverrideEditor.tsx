import type { DayOverride } from '../config/types';
import { OptionalColor, Toggle } from './controls';

/** Farb-Überschreibungen für eine Tagesart. */
export function OverrideEditor(props: {
  value: DayOverride;
  onChange: (patch: Partial<DayOverride>) => void;
  enableLabel?: string;
  /** Badge-Farbe nur zeigen, wenn Badges aktiv sind */
  showBadge?: boolean;
}) {
  const v = props.value;
  return (
    <div className="override">
      {props.enableLabel && <Toggle checked={v.enabled} onChange={(on) => props.onChange({ enabled: on })} label={props.enableLabel} />}
      <div className={`override-grid${v.enabled ? '' : ' is-off'}`}>
        <OptionalColor label="Zahl" on={v.numberOn} color={v.number} onChange={(on, c) => props.onChange({ numberOn: on, number: c })} />
        <OptionalColor label="Füllung" on={v.fillOn} color={v.fill} onChange={(on, c) => props.onChange({ fillOn: on, fill: c })} />
        <OptionalColor label="Rahmen" on={v.strokeOn} color={v.stroke} onChange={(on, c) => props.onChange({ strokeOn: on, stroke: c })} />
        <OptionalColor
          label="Beschriftung"
          on={v.labelOn}
          color={v.label}
          onChange={(on, c) => props.onChange({ labelOn: on, label: c })}
        />
        {props.showBadge && (
          <OptionalColor label="Badge" on={v.badgeOn} color={v.badge} onChange={(on, c) => props.onChange({ badgeOn: on, badge: c })} />
        )}
      </div>
    </div>
  );
}
