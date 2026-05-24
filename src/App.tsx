import { useState, useEffect } from "react";
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
import styles from "./App.module.scss";

type Theme = "paper" | "midnight" | "slate";

function getQSP(name: string, fallback: number, min: number, max: number): number {
  const v = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "paper",    label: "Paper"    },
  { id: "midnight", label: "Midnight" },
  { id: "slate",    label: "Slate"    },
];

const THEME_SCENARIO_COLORS: Record<Theme, [string, string, string, string]> = {
  paper:    ["#2e7d52", "#1d5f8a", "#9a6820", "#8f2f2f"],
  midnight: ["#4dbf7c", "#5ba3d8", "#d49540", "#cc5858"],
  slate:    ["#3dbd7a", "#68acf0", "#e0b050", "#e06565"],
};

const THEME_CHART: Record<Theme, { grid: string; axis: string; tick: string; retireRef: string; rothRef: string }> = {
  paper:    { grid: "#eae7e1", axis: "#e0dcd4", tick: "#b0aba4", retireRef: "#a09b95", rothRef: "#a09b95" },
  midnight: { grid: "#302c3e", axis: "#2a2636", tick: "#7a7570", retireRef: "#8a8790", rothRef: "#8a8790" },
  slate:    { grid: "#2d3a52", axis: "#263344", tick: "#6a7890", retireRef: "#7888a0", rothRef: "#7888a0" },
};

export default function FireScenarios() {
  const [activeScenarios, setActiveScenarios] = useState(SCENARIO_DEFS.map(s => s.label));
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);
  const [contribScenario, setContribScenario] = useState(SCENARIO_DEFS[0].label);
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "slate" : "paper"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const isMobile = vw < 600;

  const [currentAge, setCurrentAge] = useState(() => getQSP('age', 30, 18, 55));
  const [currentAgeRaw, setCurrentAgeRaw] = useState(() => String(getQSP('age', 30, 18, 55)));
  const [rent, setRent] = useState(() => getQSP('rent', 1500, 0, 100000));
  const [mortgage, setMortgage] = useState(() => getQSP('mortgage', 3000, 0, 100000));
  const [postCoastInvest, setPostCoastInvest] = useState(() => getQSP('postCoast', 0, 0, 100000));
  const [postCoastRaw, setPostCoastRaw] = useState(() => String(getQSP('postCoast', 0, 0, 100000)));
  const [retireAge, setRetireAge] = useState(() => getQSP('retireAge', 50, 30, 58));
  const [retireAgeRaw, setRetireAgeRaw] = useState(() => String(getQSP('retireAge', 50, 30, 58)));
  const [inflation, setInflation] = useState(() => getQSP('inflation', 4, 0, 10));
  const [inflationRaw, setInflationRaw] = useState(() => String(getQSP('inflation', 4, 0, 10)));
  const [withdrawalRate, setWithdrawalRate] = useState(() => getQSP('withdrawal', 4, 1, 10));
  const [withdrawalRaw, setWithdrawalRaw] = useState(() => String(getQSP('withdrawal', 4, 1, 10)));
  const [startingAssets, setStartingAssets] = useState(() => getQSP('assets', 0, 0, 1e9));
  const [startingAssetsRaw, setStartingAssetsRaw] = useState(() => String(getQSP('assets', 0, 0, 1e9)));

  useEffect(() => {
    const p = new URLSearchParams();
    if (currentAge !== 30)        p.set('age',       String(currentAge));
    if (startingAssets !== 0)     p.set('assets',    String(startingAssets));
    if (rent !== 1500)            p.set('rent',      String(rent));
    if (mortgage !== 3000)        p.set('mortgage',  String(mortgage));
    if (postCoastInvest !== 0)    p.set('postCoast', String(postCoastInvest));
    if (retireAge !== 50)         p.set('retireAge', String(retireAge));
    if (inflation !== 4)          p.set('inflation', String(inflation));
    if (withdrawalRate !== 4)     p.set('withdrawal',String(withdrawalRate));
    const qs = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [currentAge, startingAssets, rent, mortgage, postCoastInvest, retireAge, inflation, withdrawalRate]);

  const mortgagePremium = Math.max(0, mortgage - rent);
  const inflationRate = inflation / 100;
  const withdrawalRateDecimal = withdrawalRate / 100;
  const base = getBase(startingAssets);
  const scenarioColors = THEME_SCENARIO_COLORS[theme];
  const chart = THEME_CHART[theme];

  const activeData: ScenarioResult[] = SCENARIO_DEFS.map((d, i) =>
    runScenario({ ...d, color: scenarioColors[i], currentAge, mortgagePremium, postCoastInvest, rentAmount: rent, retireAge, inflationRate, withdrawalRate: withdrawalRateDecimal, base })
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
    <div className={styles.root}>
      <div className={styles.inner}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerEyebrow}>
              Retirement Scenario Analysis · Age {currentAge} → 60
            </div>
            <h1 className={styles.headerTitle}>
              Four Paths<br />
              <span className={styles.headerSubtitle}>to the same freedom</span>
            </h1>
            <p className={styles.headerDesc}>
              Comparing liquid net worth trajectories across life choices. Bridge phase: {retireAge}–59½ from taxable accounts. Full retirement: 59½+ from Roth.
            </p>
          </div>
          <div className={styles.themePicker}>
            <div className={styles.themePickerLabel}>Theme</div>
            <div className={styles.themeButtons}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={styles.themeBtn}
                  data-active={theme === t.id}
                  onClick={() => setTheme(t.id)}
                >
                  <span className={styles.themeBtnDot} data-theme-id={t.id} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inputs Panel */}
        <div className={styles.inputsPanel}>

          {/* You */}
          <div className={styles.inputSection}>
            <div className={styles.inputSectionLabel}>You</div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Current Age</div>
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
                className={`${styles.input} ${styles.inputMd}`}
              />
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Starting Assets</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
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
                  className={`${styles.input} ${styles.inputXl}`}
                />
              </div>
            </div>
          </div>

          {/* Housing */}
          <div className={styles.inputSection}>
            <div className={styles.inputSectionLabel}>Housing</div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Current Rent / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  defaultValue={rent}
                  onChange={e => { const v = Number(e.target.value); if (v >= 0) setRent(v); }}
                  onBlur={e => setRent(Math.max(0, Number(e.target.value) || 0))}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Est. Mortgage / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  defaultValue={mortgage}
                  onChange={e => { const v = Number(e.target.value); if (v >= 0) setMortgage(v); }}
                  onBlur={e => setMortgage(Math.max(0, Number(e.target.value) || 0))}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
            </div>
            <div className={styles.derivedRow}>
              <span className={styles.derivedLabel}>premium over rent</span>
              <span className={`${styles.derivedAmount}${mortgagePremium > 0 ? ` ${styles.derivedAmountPositive}` : ""}`}>
                +${mortgagePremium.toLocaleString()}/mo
              </span>
            </div>
          </div>

          {/* Goals */}
          <div className={styles.inputSection}>
            <div className={styles.inputSectionLabel}>Goals</div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Target Retire Age</div>
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
                className={`${styles.input} ${styles.inputMd}`}
              />
              <div className={styles.inputHint}>bridge to Roth ends at 59½</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Invest after Coast / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={postCoastRaw}
                  onChange={e => {
                    setPostCoastRaw(e.target.value);
                    setPostCoastInvest(Number(e.target.value) || 0);
                  }}
                  placeholder="0"
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>0 = full coast</div>
            </div>
          </div>

          {/* Assumptions */}
          <div className={styles.inputSection}>
            <div className={styles.inputSectionLabel}>Assumptions</div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Inflation Rate</div>
              <div className={styles.inputRow}>
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
                  className={`${styles.input} ${styles.inputSm}`}
                />
                <span className={styles.inputPrefix}>%</span>
              </div>
              <div className={styles.inputHint}>real return: {Math.max(0, 7 - inflation).toFixed(0)}%</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Withdrawal Rate</div>
              <div className={styles.inputRow}>
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
                  className={`${styles.input} ${styles.inputSm}`}
                />
                <span className={styles.inputPrefix}>%</span>
              </div>
              <div className={styles.inputHint}>FIRE = ${Math.round(100000 / withdrawalRateDecimal / 1000)}k (today)</div>
            </div>
          </div>

        </div>

        {/* Scenario Toggle Buttons */}
        <div className={styles.scenarioBtnRow}>
          {activeData.map(s => {
            const isActive = activeScenarios.includes(s.label);
            return (
              <button
                key={s.label}
                data-scenario={s.label}
                data-active={isActive}
                className={styles.scenarioBtn}
                onClick={() => toggleScenario(s.label)}
                onMouseEnter={() => setHoveredScenario(s.label)}
                onMouseLeave={() => setHoveredScenario(null)}
              >
                <span className={`${styles.scenarioBtnDot} ${isActive ? styles.scenarioBtnDotActive : ""}`} />
                {s.label}
              </button>
            );
          })}
          <button
            data-active={showNetWorth}
            className={styles.toggleBtn}
            onClick={() => setShowNetWorth(!showNetWorth)}
          >
            {showNetWorth ? "▪ Incl. Home Equity" : "▫ Liquid Only"}
          </button>
        </div>

        {/* Main Chart */}
        <div className={styles.chartWrapper}>
          <div className={styles.chartBgOverlay}>
            <div className={styles.chartBgAccum} />
            <div className={styles.chartBgBridge} />
            <div className={styles.chartBgRetire} />
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={mergedData} margin={{ top: 10, right: isMobile ? 8 : 24, left: isMobile ? 0 : 8, bottom: 10 }}>
              <CartesianGrid strokeDasharray="1 3" stroke={chart.grid} />
              <XAxis
                dataKey="age"
                stroke={chart.axis}
                tick={{ fill: chart.tick, fontSize: isMobile ? 10 : 11, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                label={{ value: "Age", position: "insideBottomRight", offset: -8, fill: chart.tick, fontSize: 11 }}
              />
              <YAxis
                stroke={chart.axis}
                tick={{ fill: chart.tick, fontSize: isMobile ? 9 : 11, fontFamily: "'IBM Plex Mono', monospace" }}
                tickLine={false}
                tickFormatter={fmtM}
                width={isMobile ? 46 : 70}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={retireAge} stroke={chart.retireRef} strokeDasharray="3 5" strokeWidth={1} label={{ value: `Retire ${retireAge} →`, fill: chart.retireRef, fontSize: 9, position: "insideTopLeft" }} />
              <ReferenceLine x={60} stroke={chart.rothRef} strokeDasharray="3 5" strokeWidth={1} label={{ value: "Roth 59½ →", fill: chart.rothRef, fontSize: 9, position: "insideTopLeft" }} />
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
                          <text x={cx} y={cy - 14} textAnchor="middle" fill={s.color} fontSize={9} fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
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
        <div className={styles.statGrid}>
          {activeData.map(s => {
            const d50 = atRetire(s);
            const d60 = atRoth(s);
            const isActive = activeScenarios.includes(s.label);
            const fillPct = Math.min(100, (d60?.total ?? 0) / 40);
            return (
              <div
                key={s.label}
                data-scenario={s.label}
                data-active={isActive}
                className={styles.statCard}
                onClick={() => toggleScenario(s.label)}
              >
                <div className={styles.statCardLabel}>{s.label}</div>
                <div className={styles.statRow}>
                  <span className={styles.statKey}>Coast FIRE</span>
                  <span className={styles.statValBold}>
                    {s.coastLabel ?? (s.coastFireAge ? `Age ${s.coastFireAge}` : "50+")}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statKey}>At retire (liquid)</span>
                  <span className={styles.statVal}>{fmtM(d50?.total ?? 0)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statKey}>At 59½ (liquid)</span>
                  <span className={styles.statVal}>{fmtM(d60?.total ?? 0)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statKey}>Retire spend</span>
                  <span className={styles.statVal}>${(s.retireSpend / 1000).toFixed(0)}k/yr</span>
                </div>
                <div className={styles.progressTrack}>
                  {/* CSS custom property — only safe way to set a computed layout value without inline styles */}
                  {/* eslint-disable-next-line react/forbid-dom-props */}
                  <div className={styles.progressFill} style={{ "--fill-width": `${fillPct}%` } as React.CSSProperties} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Contributions Breakdown */}
        <div className={styles.contribSection}>
          <div className={styles.sectionLabel}>Monthly Contributions by Phase</div>
          <div className={styles.contribBtnRow}>
            {activeData.map(s => (
              <button
                key={s.label}
                data-scenario={s.label}
                data-active={contribScenario === s.label}
                className={styles.contribBtn}
                onClick={() => setContribScenario(s.label)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {(() => {
            const s = activeData.find(sc => sc.label === contribScenario);
            if (!s) return null;
            const phases = s.phaseContribs;
            const colTemplate = `160px repeat(${phases.length}, 1fr)`;
            const buckets = [
              { key: "monthlyRoth",     label: "Your Roth 401k",    dotClass: styles.bucketDotEmerald, cellClass: styles.contribCellEmerald },
              { key: "monthlyWifeTrad", label: "Wife's Trad 401k",  dotClass: styles.bucketDotPurple,  cellClass: styles.contribCellPurple },
              { key: "monthlyTaxable",  label: "Taxable Brokerage", dotClass: styles.bucketDotBlue,    cellClass: styles.contribCellBlue },
              { key: "monthlyMetals",   label: "Precious Metals",   dotClass: styles.bucketDotGold,    cellClass: styles.contribCellGold },
            ] as const;
            const costs = [
              { key: "monthlyHouseSave",  label: "House Savings",           dotClass: styles.bucketDotPurple, cellClass: styles.contribCellPurple },
              { key: "monthlyMortgage",   label: "Mortgage",                dotClass: styles.bucketDotPink,   cellClass: styles.contribCellPink },
              { key: "monthlyChildcare",  label: "Kids (Childcare/School)", dotClass: styles.bucketDotOrange, cellClass: styles.contribCellOrange },
            ] as const;
            return (
              // CSS custom property for dynamic phase column count — cascades to all child rows
              // eslint-disable-next-line react/forbid-dom-props
              <div data-scenario={s.label} className={styles.contribTable} style={{ "--col-template": colTemplate } as React.CSSProperties}>
                <div className={styles.contribTableHeader}>
                  <div className={styles.contribHeaderBucket}>Bucket</div>
                  {phases.map((p, i) => (
                    <div key={i} className={styles.contribHeaderPhase}>{p.label}</div>
                  ))}
                </div>
                <div className={styles.contribBody}>
                  <div className={styles.contribSubheader}>Investing</div>
                  {buckets.map(b => (
                    <div key={b.key} className={styles.contribRow}>
                      <div className={styles.contribBucketName}>
                        <span className={`${styles.bucketDot} ${b.dotClass}`} />
                        {b.label}
                      </div>
                      {phases.map((p, i) => {
                        const val = p.snap[b.key];
                        return (
                          <div key={i} className={`${styles.contribCell} ${val === 0 ? styles.contribCellZero : b.cellClass}`}>
                            {val === 0 ? "—" : `$${val.toLocaleString()}`}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className={styles.contribTotalRow}>
                    <div className={styles.contribTotalLabel}>Total Invested/mo</div>
                    {phases.map((p, i) => (
                      <div key={i} className={styles.contribTotalCell}>
                        ${p.snap.totalInvested.toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
                {phases.some(p => p.snap.totalOut > 0) && (
                  <div className={styles.lifeCostsSection}>
                    <div className={styles.contribSubheader}>Life Costs</div>
                    {costs.map(b => {
                      if (!phases.some(p => p.snap[b.key] > 0)) return null;
                      return (
                        <div key={b.key} className={styles.contribRow}>
                          <div className={styles.contribBucketName}>
                            <span className={`${styles.bucketDot} ${b.dotClass}`} />
                            {b.label}
                          </div>
                          {phases.map((p, i) => {
                            const val = p.snap[b.key];
                            return (
                              <div key={i} className={`${styles.contribCell} ${val > 0 ? b.cellClass : styles.contribCellZero}`}>
                                {val > 0 ? `-$${val.toLocaleString()}` : "—"}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    <div className={styles.phaseBarWrapper}>
                      {phases.map((p, i) => {
                        const total = p.snap.totalInvested + p.snap.totalOut + 500;
                        return (
                          <div key={i} className={styles.phaseBarItem}>
                            <div className={styles.phaseBarLabel}>{p.label}</div>
                            <div className={styles.phaseBarTrack}>
                              {/* CSS custom properties for computed bar segment widths */}
                              {/* eslint-disable-next-line react/forbid-dom-props */}
                              <div className={styles.phaseBarInvested} style={{ "--invested-pct": `${(p.snap.totalInvested / total) * 100}%` } as React.CSSProperties} />
                              {/* eslint-disable-next-line react/forbid-dom-props */}
                              <div className={styles.phaseBarCosts} style={{ "--costs-pct": `${(p.snap.totalOut / total) * 100}%` } as React.CSSProperties} />
                            </div>
                            <div className={styles.phaseBarMeta}>
                              <span className={styles.phaseBarMetaInvested}>${p.snap.totalInvested.toLocaleString()} invested</span>
                              {p.snap.totalOut > 0 && <span className={styles.phaseBarMetaCosts}>${p.snap.totalOut.toLocaleString()} costs</span>}
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
        <div className={styles.deltaTable}>
          <div className={styles.deltaTableHeader}>
            Cost of Each Life Choice · vs. No House / No Kids Baseline
          </div>
          <div className={styles.deltaTableBody}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Scenario</th>
                  <th>Liquid @ retire</th>
                  <th>Liquid @ 59½</th>
                  <th>Δ vs Baseline @ 59½</th>
                  <th>Coast Age</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {activeData.map((s, i) => {
                  const d60 = atRoth(s);
                  const baseline60 = atRoth(activeData[0])?.total ?? 0;
                  const delta = (d60?.total ?? 0) - baseline60;
                  const deltaClass = i === 0 ? styles.tdDeltaBaseline : delta < 0 ? styles.tdDeltaNegative : styles.tdDeltaPositive;
                  return (
                    <tr key={s.label} data-scenario={s.label}>
                      <td>
                        <div className={styles.tdScenarioCell}>
                          <span className={styles.tdDot} />
                          <span className={styles.tdScenarioName}>{s.label}</span>
                        </div>
                      </td>
                      <td className={styles.tdMuted}>{fmtM(atRetire(s)?.total ?? 0)}</td>
                      <td className={styles.tdScenarioVal}>{fmtM(d60?.total ?? 0)}</td>
                      <td className={deltaClass}>
                        {i === 0 ? "—" : `${delta < 0 ? "-" : "+"}${fmtM(Math.abs(delta))}`}
                      </td>
                      <td className={styles.tdMuted}>
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
        <div className={styles.insightsGrid}>
          {[
            {
              title: "The House Is Cheap",
              body: "A house costs surprisingly little long-term — home equity partially offsets the drag, and the mortgage replaces rent. The real cost is the 2-year saving period slowing compounding.",
              colorClass: styles.colorBlue,
            },
            {
              title: "Kids Are The Variable",
              body: "Childcare at ~$1,800–$3,600/mo per kid for 5+ years is the biggest disruption. The second kid compounds the impact during the same stretch, nearly doubling the drag.",
              colorClass: styles.colorAmber,
            },
            {
              title: "Bridge Fund Survives",
              body: "Even in the House + 2 Kids scenario, the taxable brokerage at 50 should cover the 9.5-year bridge to Roth access at 59½ — though with less margin for error.",
              colorClass: styles.colorRed,
            },
            {
              title: "Roth Is The Constant",
              body: "Your Roth contributions continue throughout. It compounds untouched until 59½ — the foundation of Phase 2 regardless of which path you take.",
              colorClass: styles.colorGreen,
            },
          ].map(card => (
            <div key={card.title} className={styles.insightCard}>
              <div className={`${styles.insightAccent} ${card.colorClass}`} />
              <div className={`${styles.insightTitle} ${card.colorClass}`}>{card.title}</div>
              <div className={styles.insightBody}>{card.body}</div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          7% growth · 10% down · $450k home · $1,800/mo childcare/kid · Not financial advice
        </div>
      </div>
    </div>
  );
}
