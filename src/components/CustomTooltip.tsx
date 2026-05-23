import { fmtM } from "../utils";

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
    <div style={{
      background: "#0a0c12",
      border: "1px solid #1e2235",
      borderRadius: 8,
      padding: "12px 16px",
      fontFamily: "'Courier Prime', monospace",
      fontSize: 12,
      minWidth: 220,
    }}>
      <div style={{ color: "#64748b", marginBottom: 10, letterSpacing: 2, fontSize: 11 }}>
        AGE {label}
      </div>
      {[...payload].sort((a, b) => b.value - a.value).map(p => (
        <div
          key={p.dataKey}
          style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4, color: p.color }}
        >
          <span style={{ color: "#94a3b8", fontSize: 11 }}>{p.name.replace(" (NW)", "")}</span>
          <span style={{ fontWeight: 600 }}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
