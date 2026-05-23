import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getBase } from "./engine/getBase";
import { runScenario } from "./engine/runScenario";
import { SCENARIO_DEFS } from "./scenarios";
import { CustomTooltip } from "./components/CustomTooltip";
import { fmtM } from "./utils";
import type { ScenarioResult } from "./types";

export default function FireScenarios() {
  const [activeScenarios, setActiveScenarios] = useState(SCENARIO_DEFS.map(s => s.label));
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);
  const [contribScenario, setContribScenario] = useState(SCENARIO_DEFS[0].label);

  const [currentAge, setCurrentAge] = useState(30);
  const [currentAgeRaw, setCurrentAgeRaw] = useState("30");
  const [rent, setRent] = useState(1500);
  const [mortgage, setMortgage] = useState(3000);
  const [postCoastInvest, setPostCoastInvest] = useState(0);
  const [postCoastRaw, setPostCoastRaw] = useState("0");
  const [retireAge, setRetireAge] = useState(50);
  const [retireAgeRaw, setRetireAgeRaw] = useState("50");
  const [inflation, setInflation] = useState(4);
  const [inflationRaw, setInflationRaw] = useState("4");
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [withdrawalRaw, setWithdrawalRaw] = useState("4");
  const [startingAssets, setStartingAssets] = useState(0);
  const [startingAssetsRaw, setStartingAssetsRaw] = useState("0");

  const mortgagePremium = Math.max(0, mortgage - rent);
  const inflationRate = inflation / 100;
  const withdrawalRateDecimal = withdrawalRate / 100;
  const base = getBase(startingAssets);

  const activeData: ScenarioResult[] = SCENARIO_DEFS.map(d =>
    runScenario({ ...d, currentAge, mortgagePremium, postCoastInvest, rentAmount: rent, retireAge, inflationRate, withdrawalRate: withdrawalRateDecimal, base })
  );

  const mergedData = activeData[0].data.map((_, i) => {
    const row: Record<string, number> = { age: activeData[0].data[i].age };
    activeData.forEach(s => {
      row[s.label] = s.data[i].total;
      row[`${s.label}_nw`] = s.data[i].netWorth;
    });
    return row;
  });

  const toggleScenario = (label: string) => {
    setActiveScenarios(prev =>
      prev.includes(label)
        ? prev.length > 1 ? prev.filter(l => l !== label) : prev
        : [...prev, label]
    );
  };

  const atRetire = (s: ScenarioResult) => s.data.find(d => d.age === retireAge);
  const atRoth   = (s: ScenarioResult) => s.data.find(d => d.age === 60);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07090f",
      color: "#e2e8f0",
      fontFamily: "'Courier Prime', monospace",
      padding: "36px 20px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Playfair+Display:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .scenario-btn { transition: all 0.2s ease; }
        .scenario-btn:hover { transform: translateY(-1px); }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 48, borderBottom: "1px solid #1e2235", paddingBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>
            Retirement Scenario Analysis · Age {currentAge} → 60
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1.05,
            color: "#f1f5f9",
          }}>
            Four Paths<br />
            <span style={{ color: "#334155", fontWeight: 400, fontStyle: "italic" }}>to the same freedom</span>
          </h1>
          <p style={{ marginTop: 16, fontSize: 13, color: "#475569", maxWidth: 520, lineHeight: 1.7 }}>
            Comparing liquid net worth trajectories across life choices. Bridge phase: {retireAge}–59½ from taxable accounts. Full retirement: 59½+ from Roth.
          </p>
        </div>

        {/* Inputs Panel */}
        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32,
          background: "#0a0c12", border: "1px solid #1e2235", borderRadius: 10, padding: "18px 24px",
          alignItems: "flex-end",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 2, textTransform: "uppercase" }}>Current Age</div>
            <input
              type="number"
              value={currentAgeRaw}
              min={18} max={55}
              onChange={e => {
                setCurrentAgeRaw(e.target.value);
                const v = Number(e.target.value);
                if (v >= 18 && v <= 55) setCurrentAge(v);
              }}
              onBlur={e => {
                const v = Math.min(55, Math.max(18, Number(e.target.value) || 30));
                setCurrentAge(v);
                setCurrentAgeRaw(String(v));
              }}
              style={{
                background: "#0f1117", border: "1px solid #4ade8040", borderRadius: 4,
                color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                padding: "6px 10px", width: 70, outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 2, textTransform: "uppercase" }}>Starting Assets</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>$</span>
              <input
                type="number"
                value={startingAssetsRaw}
                onChange={e => {
                  setStartingAssetsRaw(e.target.value);
                  const v = Number(e.target.value);
                  if (v >= 0) setStartingAssets(v);
                }}
                onBlur={e => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  setStartingAssets(v);
                  setStartingAssetsRaw(String(v));
                }}
                style={{
                  background: "#0f1117", border: "1px solid #4ade8040", borderRadius: 4,
                  color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                  padding: "6px 10px", width: 110, outline: "none",
                }}
              />
            </div>
          </div>
          <div style={{ width: 1, background: "#1e2235", alignSelf: "stretch" }} />
          {(
            [
              { label: "Current Rent/mo", value: rent, setter: setRent, color: "#a78bfa", prefix: "$", width: 100 },
              { label: "Est. Mortgage/mo", value: mortgage, setter: setMortgage, color: "#f472b6", prefix: "$", width: 100 },
            ] as const
          ).map(({ label, value, setter, color, prefix, width }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>{prefix}</span>
                <input
                  type="number"
                  defaultValue={value}
                  onChange={e => { const v = Number(e.target.value); if (v >= 0) setter(v); }}
                  onBlur={e => setter(Math.max(0, Number(e.target.value) || 0))}
                  style={{
                    background: "#0f1117", border: `1px solid ${color}40`, borderRadius: 4,
                    color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                    padding: "6px 10px", width, outline: "none",
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ width: 1, background: "#1e2235", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#F59E0B", letterSpacing: 2, textTransform: "uppercase" }}>Retire Age</div>
            <input
              type="number"
              value={retireAgeRaw}
              min={30} max={58}
              onChange={e => {
                setRetireAgeRaw(e.target.value);
                const v = Number(e.target.value);
                if (v >= 30 && v <= 58) setRetireAge(v);
              }}
              onBlur={e => {
                const v = Math.min(58, Math.max(30, Number(e.target.value) || 50));
                setRetireAge(v);
                setRetireAgeRaw(String(v));
              }}
              style={{
                background: "#0f1117", border: "1px solid #F59E0B40", borderRadius: 4,
                color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                padding: "6px 10px", width: 70, outline: "none",
              }}
            />
            <div style={{ fontSize: 10, color: "#334155" }}>bridge ends 59½</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#f87171", letterSpacing: 2, textTransform: "uppercase" }}>Inflation %</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                value={inflationRaw}
                onChange={e => {
                  setInflationRaw(e.target.value);
                  const v = Number(e.target.value);
                  if (v >= 0 && v <= 10) setInflation(v);
                }}
                onBlur={e => {
                  const v = Math.min(10, Math.max(0, Number(e.target.value) || 0));
                  setInflation(v);
                  setInflationRaw(String(v));
                }}
                style={{
                  background: "#0f1117", border: "1px solid #f8717140", borderRadius: 4,
                  color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                  padding: "6px 10px", width: 60, outline: "none",
                }}
              />
              <span style={{ fontSize: 13, color: "#475569" }}>%</span>
            </div>
            <div style={{ fontSize: 10, color: "#334155" }}>
              real return: {Math.max(0, 7 - inflation).toFixed(0)}%
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#60A5FA", letterSpacing: 2, textTransform: "uppercase" }}>Withdrawal %</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                value={withdrawalRaw}
                onChange={e => {
                  setWithdrawalRaw(e.target.value);
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 10) setWithdrawalRate(v);
                }}
                onBlur={e => {
                  const v = Math.min(10, Math.max(1, Number(e.target.value) || 4));
                  setWithdrawalRate(v);
                  setWithdrawalRaw(String(v));
                }}
                style={{
                  background: "#0f1117", border: "1px solid #60A5FA40", borderRadius: 4,
                  color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                  padding: "6px 10px", width: 60, outline: "none",
                }}
              />
              <span style={{ fontSize: 13, color: "#475569" }}>%</span>
            </div>
            <div style={{ fontSize: 10, color: "#334155" }}>
              FIRE = ${Math.round(100000 / withdrawalRateDecimal / 1000)}k (today)
            </div>
          </div>
          <div style={{ width: 1, background: "#1e2235", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 2, textTransform: "uppercase" }}>
              Invest After Coast FIRE/mo
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>$</span>
              <input
                type="number"
                value={postCoastRaw}
                onChange={e => {
                  setPostCoastRaw(e.target.value);
                  setPostCoastInvest(Number(e.target.value) || 0);
                }}
                placeholder="0"
                style={{
                  background: "#0f1117", border: "1px solid #4ade8040", borderRadius: 4,
                  color: "#e2e8f0", fontFamily: "'Courier Prime', monospace", fontSize: 13,
                  padding: "6px 10px", width: 100, outline: "none",
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "#334155" }}>
              0 = full coast · any amount = partial
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>MORTGAGE PREMIUM</div>
            <div style={{ fontSize: 20, color: mortgagePremium > 0 ? "#f472b6" : "#334155", fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>
              ${mortgagePremium.toLocaleString()}/mo
            </div>
            <div style={{ fontSize: 10, color: "#334155" }}>vs rent</div>
          </div>
        </div>

        {/* Scenario Toggle Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
          {activeData.map(s => (
            <button
              key={s.label}
              className="scenario-btn"
              onClick={() => toggleScenario(s.label)}
              onMouseEnter={() => setHoveredScenario(s.label)}
              onMouseLeave={() => setHoveredScenario(null)}
              style={{
                padding: "8px 18px",
                borderRadius: 4,
                border: `1px solid ${activeScenarios.includes(s.label) ? s.color : "#1e2235"}`,
                background: activeScenarios.includes(s.label) ? `${s.color}15` : "transparent",
                color: activeScenarios.includes(s.label) ? s.color : "#475569",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                fontFamily: "'Courier Prime', monospace",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: activeScenarios.includes(s.label) ? s.color : "#1e2235",
                display: "inline-block",
              }} />
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setShowNetWorth(!showNetWorth)}
            style={{
              marginLeft: "auto",
              padding: "8px 18px",
              borderRadius: 4,
              border: `1px solid ${showNetWorth ? "#a78bfa" : "#1e2235"}`,
              background: showNetWorth ? "#a78bfa15" : "transparent",
              color: showNetWorth ? "#a78bfa" : "#475569",
              fontSize: 11,
              letterSpacing: 1,
              cursor: "pointer",
              fontFamily: "'Courier Prime', monospace",
            }}
          >
            {showNetWorth ? "▪ Incl. Home Equity" : "▫ Liquid Only"}
          </button>
        </div>

        {/* Main Chart */}
        <div style={{
          background: "#0a0c12",
          border: "1px solid #1e2235",
          borderRadius: 12,
          padding: "28px 12px 20px",
          marginBottom: 32,
          position: "relative",
        }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 12, overflow: "hidden", pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "0%", width: "27%", background: "rgba(255,255,255,0.01)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "27%", width: "11%", background: "rgba(245,158,11,0.03)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "38%", width: "62%", background: "rgba(110,231,183,0.02)" }} />
          </div>

          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={mergedData} margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111420" />
              <XAxis
                dataKey="age"
                stroke="#1e2235"
                tick={{ fill: "#475569", fontSize: 11, fontFamily: "'Courier Prime', monospace" }}
                tickLine={false}
                label={{ value: "Age", position: "insideBottomRight", offset: -8, fill: "#475569", fontSize: 11 }}
              />
              <YAxis
                stroke="#1e2235"
                tick={{ fill: "#475569", fontSize: 11, fontFamily: "'Courier Prime', monospace" }}
                tickLine={false}
                tickFormatter={fmtM}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={retireAge} stroke="#F59E0B" strokeDasharray="3 5" strokeWidth={1} label={{ value: `Retire ${retireAge} →`, fill: "#F59E0B", fontSize: 9, position: "insideTopLeft" }} />
              <ReferenceLine x={60} stroke="#4ade80" strokeDasharray="3 5" strokeWidth={1} label={{ value: "Roth 59½ →", fill: "#4ade80", fontSize: 9, position: "insideTopLeft" }} />
              {activeData.map(s => {
                if (!activeScenarios.includes(s.label)) return null;
                const yearsToRetire = Math.max(0, retireAge - currentAge);
                const futureSpend = s.retireSpend * Math.pow(1 + inflationRate, yearsToRetire);
                const fireNum = Math.round(futureSpend / withdrawalRateDecimal / 1000);
                return (
                  <ReferenceLine
                    key={`fire-${s.label}`}
                    y={fireNum}
                    stroke={s.color}
                    strokeDasharray="6 3"
                    strokeWidth={1}
                    strokeOpacity={0.4}
                    label={{
                      value: `FIRE ${fmtM(fireNum)}${inflationRate > 0 ? " (infl.)" : ""}`,
                      fill: s.color,
                      fontSize: 8,
                      position: "insideTopRight",
                      opacity: 0.7,
                    }}
                  />
                );
              })}
              {activeData.map(s => {
                if (!activeScenarios.includes(s.label)) return null;
                const key = showNetWorth ? `${s.label}_nw` : s.label;
                const coastAge = s.coastFireAge;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={s.label + (showNetWorth ? " (NW)" : "")}
                    stroke={s.color}
                    strokeWidth={hoveredScenario === s.label ? 3 : 2}
                    strokeOpacity={hoveredScenario && hoveredScenario !== s.label ? 0.2 : 1}
                    activeDot={{ r: 5, fill: s.color }}
                    dot={(props: { cx: number; cy: number; payload: { age: number } }) => {
                      const { cx, cy, payload } = props;
                      if (payload.age !== coastAge) return <g key={`empty-${s.label}-${payload.age}`} />;
                      return (
                        <g key={`coast-${s.label}`}>
                          <circle cx={cx} cy={cy} r={7} fill={s.color} fillOpacity={0.2} stroke={s.color} strokeWidth={2} />
                          <circle cx={cx} cy={cy} r={3} fill={s.color} />
                          <text x={cx} y={cy - 14} textAnchor="middle" fill={s.color} fontSize={9} fontFamily="'Courier Prime', monospace" letterSpacing={1}>
                            {s.coastLabel ?? `COAST ${coastAge}`}
                          </text>
                        </g>
                      );
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stat Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 40 }}>
          {activeData.map(s => {
            const d50 = atRetire(s);
            const d60 = atRoth(s);
            const isActive = activeScenarios.includes(s.label);
            return (
              <div
                key={s.label}
                onClick={() => toggleScenario(s.label)}
                style={{
                  background: "#0a0c12",
                  border: `1px solid ${isActive ? s.color + "40" : "#1e2235"}`,
                  borderLeft: `3px solid ${isActive ? s.color : "#1e2235"}`,
                  borderRadius: 8,
                  padding: "18px 20px",
                  cursor: "pointer",
                  opacity: isActive ? 1 : 0.4,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 10, color: s.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                  {s.label}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>Coast FIRE</span>
                  <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>
                    {s.coastLabel ?? (s.coastFireAge ? `Age ${s.coastFireAge}` : "50+")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>At retire (liquid)</span>
                  <span style={{ fontSize: 13, color: "#e2e8f0" }}>{fmtM(d50?.total ?? 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>At 59½ (liquid)</span>
                  <span style={{ fontSize: 13, color: "#e2e8f0" }}>{fmtM(d60?.total ?? 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>Retire spend</span>
                  <span style={{ fontSize: 13, color: "#e2e8f0" }}>${(s.retireSpend / 1000).toFixed(0)}k/yr</span>
                </div>
                <div style={{ marginTop: 12, height: 3, background: "#1e2235", borderRadius: 2 }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (d60?.total ?? 0) / 40)}%`,
                    background: s.color,
                    borderRadius: 2,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Contributions Breakdown */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#475569", textTransform: "uppercase", marginBottom: 16 }}>Monthly Contributions by Phase</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {activeData.map(s => (
              <button key={s.label} onClick={() => setContribScenario(s.label)} style={{
                padding: "7px 16px", borderRadius: 4,
                border: `1px solid ${contribScenario === s.label ? s.color : "#1e2235"}`,
                background: contribScenario === s.label ? `${s.color}18` : "transparent",
                color: contribScenario === s.label ? s.color : "#475569",
                fontSize: 11, letterSpacing: 1, cursor: "pointer", fontFamily: "'Courier Prime', monospace", transition: "all 0.15s",
              }}>{s.label}</button>
            ))}
          </div>
          {(() => {
            const s = activeData.find(sc => sc.label === contribScenario);
            if (!s) return null;
            const phases = s.phaseContribs;
            const buckets = [
              { key: "monthlyRoth",     label: "Your Roth 401k",      color: "#6EE7B7" },
              { key: "monthlyWifeTrad", label: "Wife's Trad 401k",    color: "#a78bfa" },
              { key: "monthlyTaxable",  label: "Taxable Brokerage",   color: "#60A5FA" },
              { key: "monthlyMetals",   label: "Precious Metals",     color: "#D97706" },
            ] as const;
            const costs = [
              { key: "monthlyHouseSave",  label: "House Savings",           color: "#a78bfa" },
              { key: "monthlyMortgage",   label: "Mortgage",                color: "#f472b6" },
              { key: "monthlyChildcare",  label: "Kids (Childcare/School)", color: "#fb923c" },
            ] as const;
            const colTemplate = `160px repeat(${phases.length}, 1fr)`;
            return (
              <div style={{ background: "#0a0c12", border: `1px solid ${s.color}30`, borderRadius: 10, overflow: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: colTemplate, borderBottom: "1px solid #1e2235", padding: "0 20px", minWidth: 500 }}>
                  <div style={{ padding: "14px 0", fontSize: 10, color: "#334155", letterSpacing: 2, textTransform: "uppercase" }}>Bucket</div>
                  {phases.map((p, i) => (
                    <div key={i} style={{ padding: "12px 6px", fontSize: 10, color: s.color, letterSpacing: 1, textAlign: "right", lineHeight: 1.5 }}>{p.label}</div>
                  ))}
                </div>
                <div style={{ padding: "8px 0", minWidth: 500 }}>
                  <div style={{ padding: "6px 20px", fontSize: 9, letterSpacing: 3, color: "#334155", textTransform: "uppercase" }}>Investing</div>
                  {buckets.map(b => (
                    <div key={b.key} style={{ display: "grid", gridTemplateColumns: colTemplate, padding: "5px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.color, display: "inline-block", flexShrink: 0 }} />
                        {b.label}
                      </div>
                      {phases.map((p, i) => {
                        const val = p.snap[b.key];
                        return (
                          <div key={i} style={{ textAlign: "right", fontSize: 13, color: val === 0 ? "#2a2d3a" : b.color, fontWeight: val > 0 ? 600 : 400, padding: "0 6px" }}>
                            {val === 0 ? "—" : `$${val.toLocaleString()}`}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: colTemplate, padding: "10px 20px", borderTop: "1px solid #111420", marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>Total Invested/mo</div>
                    {phases.map((p, i) => (
                      <div key={i} style={{ textAlign: "right", fontSize: 13, color: "#e2e8f0", fontWeight: 700, padding: "0 6px" }}>
                        ${p.snap.totalInvested.toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
                {phases.some(p => p.snap.totalOut > 0) && (
                  <div style={{ padding: "8px 0", borderTop: "1px solid #111420", minWidth: 500 }}>
                    <div style={{ padding: "6px 20px", fontSize: 9, letterSpacing: 3, color: "#334155", textTransform: "uppercase" }}>Life Costs</div>
                    {costs.map(b => {
                      if (!phases.some(p => p.snap[b.key] > 0)) return null;
                      return (
                        <div key={b.key} style={{ display: "grid", gridTemplateColumns: colTemplate, padding: "5px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.color, display: "inline-block", flexShrink: 0 }} />
                            {b.label}
                          </div>
                          {phases.map((p, i) => {
                            const val = p.snap[b.key];
                            return (
                              <div key={i} style={{ textAlign: "right", fontSize: 13, color: val > 0 ? b.color : "#2a2d3a", padding: "0 6px" }}>
                                {val > 0 ? `-$${val.toLocaleString()}` : "—"}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    <div style={{ padding: "12px 20px 8px" }}>
                      {phases.map((p, i) => {
                        const total = p.snap.totalInvested + p.snap.totalOut + 500;
                        return (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{p.label}</div>
                            <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "#111420" }}>
                              <div style={{ width: `${(p.snap.totalInvested / total) * 100}%`, background: s.color }} />
                              <div style={{ width: `${(p.snap.totalOut / total) * 100}%`, background: "#f87171" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10 }}>
                              <span style={{ color: s.color }}>${p.snap.totalInvested.toLocaleString()} invested</span>
                              {p.snap.totalOut > 0 && <span style={{ color: "#f87171" }}>${p.snap.totalOut.toLocaleString()} costs</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Delta Table */}
        <div style={{
          background: "#0a0c12",
          border: "1px solid #1e2235",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 32,
        }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e2235", fontSize: 10, letterSpacing: 3, color: "#475569", textTransform: "uppercase" }}>
            Cost of Each Life Choice · vs. No House / No Kids Baseline
          </div>
          <div style={{ padding: "20px 24px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#475569", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
                  <th style={{ textAlign: "left", paddingBottom: 12, fontWeight: 400 }}>Scenario</th>
                  <th style={{ textAlign: "right", paddingBottom: 12, fontWeight: 400 }}>Liquid @ retire</th>
                  <th style={{ textAlign: "right", paddingBottom: 12, fontWeight: 400 }}>Liquid @ 59½</th>
                  <th style={{ textAlign: "right", paddingBottom: 12, fontWeight: 400 }}>Δ vs Baseline @ 59½</th>
                  <th style={{ textAlign: "right", paddingBottom: 12, fontWeight: 400 }}>Coast Age</th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((s, i) => {
                  const d60 = atRoth(s);
                  const baseline60 = atRoth(activeData[0])?.total ?? 0;
                  const delta = (d60?.total ?? 0) - baseline60;
                  return (
                    <tr key={s.label} style={{ borderTop: "1px solid #111420" }}>
                      <td style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: "#c4cfe0" }}>{s.label}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "#94a3b8" }}>{fmtM(atRetire(s)?.total ?? 0)}</td>
                      <td style={{ textAlign: "right", color: s.color, fontWeight: 700 }}>{fmtM(d60?.total ?? 0)}</td>
                      <td style={{ textAlign: "right", color: i === 0 ? "#475569" : delta < 0 ? "#f87171" : "#4ade80" }}>
                        {i === 0 ? "—" : `${delta < 0 ? "-" : "+"}${fmtM(Math.abs(delta))}`}
                      </td>
                      <td style={{ textAlign: "right", color: "#94a3b8" }}>
                        {s.coastLabel ?? (s.coastFireAge ? `Age ${s.coastFireAge}` : "50+")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {[
            {
              icon: "◈",
              title: "The House Is Cheap",
              body: "A house costs surprisingly little long-term — home equity partially offsets the drag, and the mortgage replaces rent. The real cost is the 2-year saving period slowing compounding.",
              color: "#60A5FA",
            },
            {
              icon: "◉",
              title: "Kids Are The Variable",
              body: "Childcare at ~$1,800–$3,600/mo per kid for 5+ years is the biggest disruption. The second kid compounds the impact during the same stretch, nearly doubling the drag.",
              color: "#F59E0B",
            },
            {
              icon: "◎",
              title: "Bridge Fund Survives",
              body: "Even in the House + 2 Kids scenario, the taxable brokerage at 50 should cover the 9.5-year bridge to Roth access at 59½ — though with less margin for error.",
              color: "#f87171",
            },
            {
              icon: "◇",
              title: "Roth Is The Constant",
              body: "Your Roth contributions continue throughout. It compounds untouched until 59½ — the foundation of Phase 2 regardless of which path you take.",
              color: "#4ade80",
            },
          ].map(card => (
            <div key={card.title} style={{
              background: "#0a0c12",
              border: "1px solid #1e2235",
              borderRadius: 8,
              padding: "18px 20px",
            }}>
              <div style={{ fontSize: 18, color: card.color, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 12, color: card.color, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>{card.body}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#1e2235", textAlign: "center", letterSpacing: 1 }}>
          7% growth · 10% down · $450k home · $1,800/mo childcare/kid · Not financial advice
        </div>
      </div>
    </div>
  );
}
