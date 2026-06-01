import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import { runScenario } from "./engine/runScenario";
import { SCENARIO_DEFS } from "./scenarios";
import { CustomTooltip } from "./components/CustomTooltip";
import { fmtM } from "./utils";
import type { Bucket, ScenarioResult } from "./types";
import styles from "./App.module.scss";

type Theme = "paper" | "midnight" | "slate";

function getQSP(name: string, fallback: number, min: number, max: number): number {
  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

// Compact format: array-of-arrays [label, balance, monthlyContrib, annualReturn, "r"|"t"]
// base64url-encoded so no percent-encoding is needed in the URL.
function encodeBuckets(buckets: Bucket[]): string {
  const compact = buckets.map(b => [
    b.label, b.balance, b.monthlyContrib, b.annualReturn,
    b.taxType === "roth" ? "r" : "t",
  ]);
  return btoa(JSON.stringify(compact)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getBucketsQSP(fallback: Bucket[]): Bucket[] {
  const raw = new URLSearchParams(window.location.search).get('buckets');
  if (raw === null) return fallback;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const arr = JSON.parse(atob(b64)) as unknown[];
    if (!Array.isArray(arr) || arr.length === 0) return fallback;
    return arr.map((row, idx) => {
      const a = row as unknown[];
      return {
        id: `b${idx}`,
        label: String(a[0] ?? "Bucket"),
        balance: Math.max(0, Number(a[1]) || 0),
        monthlyContrib: Math.max(0, Number(a[2]) || 0),
        annualReturn: Math.min(50, Math.max(0, Number(a[3]) || 7)),
        taxType: (a[4] === "r" ? "roth" : "taxable") as "roth" | "taxable",
      };
    });
  } catch {
    return fallback;
  }
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

const THEME_CHART: Record<Theme, { grid: string; axis: string; tick: string; retireRef: string; rothRef: string; honey: string; sage: string }> = {
  paper:    { grid: "#eae7e1", axis: "#e0dcd4", tick: "#b0aba4", retireRef: "#a09b95", rothRef: "#a09b95", honey: "#9a6820", sage: "#2e7d52" },
  midnight: { grid: "#302c3e", axis: "#2a2636", tick: "#7a7570", retireRef: "#8a8790", rothRef: "#8a8790", honey: "#d49540", sage: "#4dbf7c" },
  slate:    { grid: "#2d3a52", axis: "#263344", tick: "#6a7890", retireRef: "#7888a0", rothRef: "#7888a0", honey: "#e0b050", sage: "#3dbd7a" },
};

const BUCKET_DOT_CLASSES = [
  styles.bucketDotEmerald,
  styles.bucketDotBlue,
  styles.bucketDotGold,
  styles.bucketDotPurple,
  styles.bucketDotPink,
  styles.bucketDotOrange,
];

const BUCKET_CELL_CLASSES = [
  styles.contribCellEmerald,
  styles.contribCellBlue,
  styles.contribCellGold,
  styles.contribCellPurple,
  styles.contribCellPink,
  styles.contribCellOrange,
];

const THEME_BG: Record<Theme, string> = { paper: "#f8f6f1", midnight: "#17151c", slate: "#1b2130" };

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "roth",      label: "Roth 401k",     balance: 0, monthlyContrib: 2041, annualReturn: 7,   taxType: "roth"     },
  { id: "trad",      label: "Trad 401k",     balance: 0, monthlyContrib: 0,    annualReturn: 7,   taxType: "taxable"  },
  { id: "market",    label: "Market",         balance: 0, monthlyContrib: 0,    annualReturn: 7,   taxType: "taxable"  },
  { id: "metals",    label: "Metals",         balance: 0, monthlyContrib: 0,    annualReturn: 5,   taxType: "taxable"  },
  { id: "emergency", label: "Emergency Fund", balance: 0, monthlyContrib: 0,    annualReturn: 4.5, taxType: "taxable"  },
];

export default function FireScenarios() {
  const [activeScenarios, setActiveScenarios] = useState(SCENARIO_DEFS.map(s => s.label));
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);
  const [contribScenario, setContribScenario] = useState(SCENARIO_DEFS[0].label);
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "slate" : "paper"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_BG[theme]);
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

  const [buckets, setBuckets] = useState<Bucket[]>(() => getBucketsQSP(DEFAULT_BUCKETS));
  const [retireTaxRate, setRetireTaxRate] = useState(() => getQSP('taxRate', 22, 0, 50));
  const [retireTaxRaw, setRetireTaxRaw] = useState(() => String(getQSP('taxRate', 22, 0, 50)));
  const [childcareCost, setChildcareCost] = useState(() => getQSP('childcare', 1800, 0, 10000));
  const [childcareCostRaw, setChildcareCostRaw] = useState(() => String(getQSP('childcare', 1800, 0, 10000)));
  const [kidCostSchool, setKidCostSchool] = useState(() => getQSP('school', 1100, 0, 10000));
  const [kidCostSchoolRaw, setKidCostSchoolRaw] = useState(() => String(getQSP('school', 1100, 0, 10000)));
  const [retireSpend, setRetireSpend] = useState(() => getQSP('retireSpend', 100000, 0, 1000000));
  const [retireSpendRaw, setRetireSpendRaw] = useState(() => String(getQSP('retireSpend', 100000, 0, 1000000)));
  const [collegeCost, setCollegeCost] = useState(() => getQSP('college', 40000, 0, 500000));
  const [collegeCostRaw, setCollegeCostRaw] = useState(() => String(getQSP('college', 40000, 0, 500000)));
  const [propTaxIns, setPropTaxIns] = useState(() => getQSP('propTax', 600, 0, 100000));
  const [propTaxInsRaw, setPropTaxInsRaw] = useState(() => String(getQSP('propTax', 600, 0, 100000)));

  useEffect(() => {
    const p = new URLSearchParams();
    if (currentAge !== 30)        p.set('age',         String(currentAge));
    if (rent !== 1500)            p.set('rent',        String(rent));
    if (mortgage !== 3000)        p.set('mortgage',    String(mortgage));
    if (postCoastInvest !== 0)    p.set('postCoast',   String(postCoastInvest));
    if (retireAge !== 50)         p.set('retireAge',   String(retireAge));
    if (inflation !== 4)          p.set('inflation',   String(inflation));
    if (withdrawalRate !== 4)     p.set('withdrawal',  String(withdrawalRate));
    if (retireTaxRate !== 22)     p.set('taxRate',     String(retireTaxRate));
    if (childcareCost !== 1800)   p.set('childcare',   String(childcareCost));
    if (kidCostSchool !== 1100)   p.set('school',      String(kidCostSchool));
    if (retireSpend !== 100000)   p.set('retireSpend', String(retireSpend));
    if (collegeCost !== 40000)    p.set('college',     String(collegeCost));
    if (propTaxIns !== 600)       p.set('propTax',     String(propTaxIns));
    if (JSON.stringify(buckets) !== JSON.stringify(DEFAULT_BUCKETS)) p.set('buckets', encodeBuckets(buckets));
    const qs = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [currentAge, rent, mortgage, postCoastInvest, retireAge, inflation, withdrawalRate, retireTaxRate, childcareCost, kidCostSchool, retireSpend, collegeCost, propTaxIns, buckets]);

  const mortgagePremium = Math.max(0, mortgage - rent);
  const inflationRate = inflation / 100;
  const withdrawalRateDecimal = withdrawalRate / 100;
  const scenarioColors = THEME_SCENARIO_COLORS[theme];
  const chart = THEME_CHART[theme];

  const totalContrib = buckets.reduce((s, b) => s + b.monthlyContrib, 0);
  const avgBucketReturn = totalContrib > 0
    ? buckets.reduce((s, b) => s + b.annualReturn * (b.monthlyContrib / totalContrib), 0)
    : (buckets[0]?.annualReturn ?? 7);

  const activeData: ScenarioResult[] = SCENARIO_DEFS.map((d, i) =>
    runScenario({ ...d, color: scenarioColors[i], buckets, currentAge, mortgagePremium, postCoastInvest, rentAmount: rent, retireAge, inflationRate, withdrawalRate: withdrawalRateDecimal, childcareCost, kidCostSchool, retireTaxRate, collegeCostPerKid: collegeCost, propTaxIns, retireSpend })
  );

  const mergedData = activeData[0].data.map((_, i) => {
    const row: Record<string, number> = { age: activeData[0].data[i].age };
    activeData.forEach(s => { row[s.label] = s.data[i].total; });
    return row;
  });

  const fireLineNum = Math.round(retireSpend / withdrawalRateDecimal / 1000);

  const toggleScenario = (label: string) => {
    setActiveScenarios(prev =>
      prev.includes(label)
        ? prev.length > 1 ? prev.filter(l => l !== label) : prev
        : [...prev, label]
    );
  };

  const updateBucket = (id: string, patch: Partial<Bucket>) =>
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));

  const deleteBucket = (id: string) =>
    setBuckets(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev);

  const draggedBucketId = useRef<string | null>(null);
  const [dragOverBucketId, setDragOverBucketId] = useState<string | null>(null);
  const touchDragRef = useRef<{ id: string; started: boolean; startY: number } | null>(null);
  const [touchDraggingId, setTouchDraggingId] = useState<string | null>(null);

  const reorderBuckets = (fromId: string, toId: string) => {
    setBuckets(prev => {
      const from = prev.findIndex(b => b.id === fromId);
      const to = prev.findIndex(b => b.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const addBucket = () =>
    setBuckets(prev => [...prev, {
      id: `b${Date.now()}`,
      label: "New Bucket",
      balance: 0,
      monthlyContrib: 0,
      annualReturn: 7,
      taxType: "taxable" as const,
    }]);

  const atRetire = (s: ScenarioResult) => s.data.find(d => d.age === retireAge);
  const atRoth   = (s: ScenarioResult) => s.data.find(d => d.age === 60);

  return (
    <div className={styles.root}>
      <div className={styles.inner}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerEyebrow}>
              Retirement Scenario Analysis · Age {currentAge} → {retireAge}
            </div>
            <h1 className={styles.headerTitle}>
              Four Paths <span className={styles.headerSubtitle}>to the same freedom</span>
            </h1>
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

        {/* Info Panel */}
        <div className={styles.infoPanel}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTerm}>FIRE</div>
            <div className={styles.infoCardTitle}>Financial Independence, Retire Early</div>
            <div className={styles.infoCardBody}>
              Your FIRE number is <strong>annual spending ÷ withdrawal rate</strong>. At 4% withdrawal, you need 25× your yearly expenses. Once your portfolio hits that number, withdrawals are covered by investment returns indefinitely — you no longer need to work.
            </div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTerm}>Coast FIRE</div>
            <div className={styles.infoCardTitle}>Stop Contributing, Let It Grow</div>
            <div className={styles.infoCardBody}>
              The earliest age your portfolio can grow to your FIRE number <em>on its own</em> — with no further contributions — by your target retire age. After this point you only need income to cover living expenses, not to invest.
            </div>
          </div>
        </div>

        {/* Inputs + Buckets Card */}
        <div className={styles.inputsCard}>
        <div className={styles.inputsPanel}>

          {/* Housing */}
          <div className={styles.inputSection}>
            <div className={styles.inputSectionLabel}>Housing</div>
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
                onFocus={e => e.target.select()}
                className={`${styles.input} ${styles.inputMd}`}
              />
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Current Rent / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  defaultValue={rent}
                  onChange={e => { const v = Number(e.target.value); if (v >= 0) setRent(v); }}
                  onBlur={e => setRent(Math.max(0, Number(e.target.value) || 0))}
                  onFocus={e => e.target.select()}
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
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Prop Tax + Ins / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={propTaxInsRaw}
                  onChange={e => {
                    setPropTaxInsRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0) setPropTaxIns(v);
                  }}
                  onBlur={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setPropTaxIns(v);
                    setPropTaxInsRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>after mortgage paid off</div>
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
                onFocus={e => e.target.select()}
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
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>0 = full coast</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Retire Spend / yr</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={retireSpendRaw}
                  onChange={e => {
                    setRetireSpendRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0) setRetireSpend(v);
                  }}
                  onBlur={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setRetireSpend(v);
                    setRetireSpendRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>annual spending in retirement</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>College / Kid</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={collegeCostRaw}
                  onChange={e => {
                    setCollegeCostRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0) setCollegeCost(v);
                  }}
                  onBlur={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setCollegeCost(v);
                    setCollegeCostRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>one-time at age 18</div>
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
                    if (e.target.value !== '' && v >= 0 && v <= 10) setInflation(v);
                  }}
                  onBlur={e => {
                    const v = Math.min(10, Math.max(0, Number(e.target.value) || 0));
                    setInflation(v);
                    setInflationRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputSm}`}
                />
                <span className={styles.inputPrefix}>%</span>
              </div>
              <div className={styles.inputHint}>avg real: {Math.max(0, avgBucketReturn - inflation).toFixed(1)}%</div>
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
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputSm}`}
                />
                <span className={styles.inputPrefix}>%</span>
              </div>
              <div className={styles.inputHint}>FIRE = ${Math.round(retireSpend / withdrawalRateDecimal / 1000)}k (today)</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Trad. Tax Rate</div>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  value={retireTaxRaw}
                  onChange={e => {
                    setRetireTaxRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0 && v <= 50) setRetireTaxRate(v);
                  }}
                  onBlur={e => {
                    const v = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                    setRetireTaxRate(v);
                    setRetireTaxRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputSm}`}
                />
                <span className={styles.inputPrefix}>%</span>
              </div>
              <div className={styles.inputHint}>applied to Traditional accounts</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>Childcare / Kid / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={childcareCostRaw}
                  onChange={e => {
                    setChildcareCostRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0) setChildcareCost(v);
                  }}
                  onBlur={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setChildcareCost(v);
                    setChildcareCostRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>ages 0–5 per kid</div>
            </div>
            <div className={styles.inputGroup}>
              <div className={styles.inputLabel}>School-Age / Kid / mo</div>
              <div className={styles.inputRow}>
                <span className={styles.inputPrefix}>$</span>
                <input
                  type="number"
                  value={kidCostSchoolRaw}
                  onChange={e => {
                    setKidCostSchoolRaw(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value !== '' && v >= 0) setKidCostSchool(v);
                  }}
                  onBlur={e => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setKidCostSchool(v);
                    setKidCostSchoolRaw(String(v));
                  }}
                  onFocus={e => e.target.select()}
                  className={`${styles.input} ${styles.inputLg}`}
                />
              </div>
              <div className={styles.inputHint}>ages 6–17 per kid</div>
            </div>
          </div>

        </div>

        {/* Bucket Editor */}
        <div className={styles.bucketsSection}>

          <div className={styles.bucketsSectionHeader}>
            <div className={styles.sectionLabel}>Investment Buckets</div>
          </div>
          <div className={styles.bucketHint}>
            Life costs (mortgage, childcare) reduce the last bucket's contribution first.
          </div>
          <div className={styles.bucketList}>
            {buckets.map(bucket => (
              <div
                key={bucket.id}
                data-bucket-id={bucket.id}
                className={`${styles.bucketRow}${dragOverBucketId === bucket.id ? ` ${styles.bucketRowDragOver}` : ''}${touchDraggingId === bucket.id ? ` ${styles.bucketRowTouchDragging}` : ''}`}
                onDragOver={e => { e.preventDefault(); if (draggedBucketId.current !== bucket.id) setDragOverBucketId(bucket.id); }}
                onDrop={e => { e.preventDefault(); if (draggedBucketId.current && draggedBucketId.current !== bucket.id) reorderBuckets(draggedBucketId.current, bucket.id); setDragOverBucketId(null); }}
                onDragLeave={() => setDragOverBucketId(null)}
              >
                <div
                  className={styles.bucketDragHandle}
                  draggable
                  onDragStart={e => { draggedBucketId.current = bucket.id; e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { draggedBucketId.current = null; setDragOverBucketId(null); }}
                  onTouchStart={e => { touchDragRef.current = { id: bucket.id, started: false, startY: e.touches[0].clientY }; }}
                  onTouchMove={e => {
                    if (!touchDragRef.current) return;
                    const dy = Math.abs(e.touches[0].clientY - touchDragRef.current.startY);
                    if (!touchDragRef.current.started) {
                      if (dy < 4) return;
                      touchDragRef.current.started = true;
                      setTouchDraggingId(touchDragRef.current.id);
                      draggedBucketId.current = touchDragRef.current.id;
                    }
                    const touch = e.touches[0];
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    const row = el?.closest('[data-bucket-id]');
                    const targetId = row?.getAttribute('data-bucket-id') ?? null;
                    setDragOverBucketId(targetId !== touchDragRef.current.id ? targetId : null);
                  }}
                  onTouchEnd={() => {
                    if (touchDragRef.current?.started && dragOverBucketId) {
                      reorderBuckets(touchDragRef.current.id, dragOverBucketId);
                    }
                    touchDragRef.current = null;
                    draggedBucketId.current = null;
                    setTouchDraggingId(null);
                    setDragOverBucketId(null);
                  }}
                >⠿</div>
                <div className={styles.bucketLabelField}>
                  <div className={styles.bucketFieldLabel}>Name</div>
                  <input
                    type="text"
                    value={bucket.label}
                    onChange={e => updateBucket(bucket.id, { label: e.target.value })}
                    className={styles.bucketLabelInput}
                  />
                  <div className={styles.bucketTaxPills}>
                    {(["roth", "taxable"] as const).map(t => (
                      <button
                        key={t}
                        className={`${styles.bucketTaxPill} ${bucket.taxType === t ? styles.bucketTaxPillActive : ""}`}
                        onClick={() => updateBucket(bucket.id, { taxType: t })}
                      >
                        {t === "roth" ? "Roth" : "Taxable"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.bucketNumGroup}>
                  <div className={styles.bucketField}>
                    <div className={styles.bucketFieldLabel}>Balance</div>
                    <div className={styles.bucketFieldRow}>
                      <span className={styles.bucketPrefix}>$</span>
                      <input
                        type="number"
                        defaultValue={bucket.balance}
                        min={0}
                        onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && v >= 0) updateBucket(bucket.id, { balance: v }); }}
                        onBlur={e => updateBucket(bucket.id, { balance: Math.max(0, Number(e.target.value) || 0) })}
                        onFocus={e => e.target.select()}
                        className={`${styles.bucketInput} ${styles.bucketInputLg}`}
                      />
                    </div>
                  </div>
                  <div className={styles.bucketField}>
                    <div className={styles.bucketFieldLabel}>Monthly</div>
                    <div className={styles.bucketFieldRow}>
                      <span className={styles.bucketPrefix}>$</span>
                      <input
                        type="number"
                        defaultValue={bucket.monthlyContrib}
                        min={0}
                        onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && v >= 0) updateBucket(bucket.id, { monthlyContrib: v }); }}
                        onBlur={e => updateBucket(bucket.id, { monthlyContrib: Math.max(0, Number(e.target.value) || 0) })}
                        onFocus={e => e.target.select()}
                        className={`${styles.bucketInput} ${styles.bucketInputLg}`}
                      />
                    </div>
                  </div>
                  <div className={styles.bucketField}>
                    <div className={styles.bucketFieldLabel}>Return</div>
                    <div className={styles.bucketFieldRow}>
                      <input
                        type="number"
                        defaultValue={bucket.annualReturn}
                        min={0}
                        max={50}
                        step={0.5}
                        onChange={e => { const v = Number(e.target.value); if (e.target.value !== '' && v >= 0 && v <= 50) updateBucket(bucket.id, { annualReturn: v }); }}
                        onBlur={e => updateBucket(bucket.id, { annualReturn: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}
                        onFocus={e => e.target.select()}
                        className={`${styles.bucketInput} ${styles.bucketInputMd}`}
                      />
                      <span className={styles.bucketPrefix}>%</span>
                    </div>
                  </div>
                </div>
                <div className={styles.bucketDeleteField}>
                  <button
                    className={styles.bucketDeleteBtn}
                    onClick={() => deleteBucket(bucket.id)}
                    disabled={buckets.length <= 1}
                    aria-label={`Delete ${bucket.label} bucket`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.bucketAddBtn} onClick={addBucket}>
            + Add Bucket
          </button>
        </div>
        </div>{/* end inputsCard */}

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
        </div>

        {/* Main Chart */}
        <div className={styles.chartWrapper}>
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
                domain={[0, (dataMax: number) => Math.max(dataMax, fireLineNum * 1.08)]}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceArea x1={retireAge} x2={60} fill={chart.honey} fillOpacity={0.07} />
              <ReferenceArea x1={60} x2={100} fill={chart.sage} fillOpacity={0.06} />
              <ReferenceLine x={retireAge} stroke={chart.retireRef} strokeDasharray="3 5" strokeWidth={1} label={{ value: `Retire ${retireAge} →`, fill: chart.retireRef, fontSize: 9, position: "insideTopLeft" }} />
              <ReferenceLine x={60} stroke={chart.rothRef} strokeDasharray="3 5" strokeWidth={1} label={{ value: "Roth 59½ →", fill: chart.rothRef, fontSize: 9, position: "insideTopLeft" }} />
              <ReferenceLine
                y={fireLineNum}
                stroke={chart.retireRef}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value: `FIRE ${fmtM(fireLineNum)} (today $)`,
                  fill: chart.retireRef,
                  fontSize: 9,
                  position: "insideTopRight",
                }}
              />
              {activeData.map(s => {
                if (!activeScenarios.includes(s.label)) return null;
                const coastAge = s.coastFireAge;
                return (
                  <Line
                    key={s.label}
                    type="monotone"
                    dataKey={s.label}
                    name={s.label}
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
                  {/* CSS custom property for computed layout value */}
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
            const colTemplate = isMobile
              ? `90px repeat(${phases.length}, 1fr)`
              : `160px repeat(${phases.length}, 1fr)`;
            const phaseBuckets = phases[0]?.snap.bucketContribs ?? [];
            const lifeCosts = [
              { key: "monthlyMortgage" as const,   label: "Mortgage",                dotClass: styles.bucketDotPink,   cellClass: styles.contribCellPink },
              { key: "monthlyChildcare" as const,  label: "Kids (Childcare/School)", dotClass: styles.bucketDotOrange, cellClass: styles.contribCellOrange },
            ] as const;
            return (
              // CSS custom property for dynamic phase column count
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
                  {phaseBuckets.map((pb, bIdx) => {
                    const dotClass = BUCKET_DOT_CLASSES[bIdx % BUCKET_DOT_CLASSES.length];
                    const cellClass = BUCKET_CELL_CLASSES[bIdx % BUCKET_CELL_CLASSES.length];
                    return (
                      <div key={pb.id} className={styles.contribRow}>
                        <div className={styles.contribBucketName}>
                          <span className={`${styles.bucketDot} ${dotClass}`} />
                          {pb.label}
                        </div>
                        {phases.map((p, i) => {
                          const bc = p.snap.bucketContribs.find(b => b.id === pb.id);
                          const val = bc?.amount ?? 0;
                          return (
                            <div key={i} className={`${styles.contribCell} ${val === 0 ? styles.contribCellZero : cellClass}`}>
                              {val === 0 ? "—" : `$${val.toLocaleString()}`}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
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
                    {lifeCosts.map(cost => {
                      if (!phases.some(p => p.snap[cost.key] > 0)) return null;
                      return (
                        <div key={cost.key} className={styles.contribRow}>
                          <div className={styles.contribBucketName}>
                            <span className={`${styles.bucketDot} ${cost.dotClass}`} />
                            {cost.label}
                          </div>
                          {phases.map((p, i) => {
                            const val = p.snap[cost.key];
                            return (
                              <div key={i} className={`${styles.contribCell} ${val > 0 ? cost.cellClass : styles.contribCellZero}`}>
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
          7% growth · 10% down · $450k home · ${childcareCost.toLocaleString()}/mo childcare/kid · Not financial advice
        </div>
      </div>
    </div>
  );
}
