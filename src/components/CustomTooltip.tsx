import { fmtM } from "../utils";
import styles from "./CustomTooltip.module.scss";

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipAge}>AGE {label}</div>
      {[...payload].sort((a, b) => b.value - a.value).map(p => (
        <div
          key={p.dataKey}
          data-scenario={p.name.replace(" (NW)", "")}
          className={styles.tooltipRow}
        >
          <span className={styles.tooltipName}>{p.name.replace(" (NW)", "")}</span>
          <span className={styles.tooltipValue}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
