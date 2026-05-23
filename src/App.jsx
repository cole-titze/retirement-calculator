import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Constants ───────────────────────────────────────────────
const GROWTH = 0.07;
const METALS_GROWTH = 0.05;
const SGOV_GROWTH = 0.045;

// Portfolio allocation weights (must sum to 100); getBase() scales these
// proportionally to whatever the user enters as starting assets.
// Adjust weights to match your actual allocation.
const BASE_DEFAULT = {
  yourRoth: 40,
  wifeTraditional: 0,
  taxable: 25,
  company: 18,
  metals: 4,
  sgov: 13,
};
const BASE_DEFAULT_TOTAL = Object.values(BASE_DEFAULT).reduce((a, b) => a + b, 0);

function getBase(totalAssets) {
  const scale = totalAssets / BASE_DEFAULT_TOTAL;
  return {
    yourRoth: Math.round(BASE_DEFAULT.yourRoth * scale),
    wifeTraditional: Math.round(BASE_DEFAULT.wifeTraditional * scale),
    taxable: Math.round(BASE_DEFAULT.taxable * scale),
    company: Math.round(BASE_DEFAULT.company * scale),
    metals: Math.round(BASE_DEFAULT.metals * scale),
    sgov: Math.round(BASE_DEFAULT.sgov * scale),
  };
}

// Monthly contribution amounts per bucket.
// yourRoth defaults to the 2025 IRS Roth 401k max; set others to match your situation.
const MONTHLY_BASE = {
  yourRoth: 1958,
  wifeTraditional: 0,
  taxable: 0,
  metals: 0,
};

// House params
const HOME_PRICE = 450000;
const DOWN_PAYMENT = 45000;   // 10%
const CLOSING = 9000;
const MORTGAGE_MONTHLY = 3000;
const HOME_APPRECIATION = 0.03;
const PROP_TAX_INS = 600;     // /mo

// Kids params
const CHILDCARE_PER_KID = 1800;  // /mo per kid ages 0-5
const KID_COST_SCHOOL = 1100;    // /mo per kid ages 6-17
const COLLEGE_PER_KID = 25000;   // lump sum at age 18 per kid

// Retirement spending
const RETIRE_SPEND_BASE = 100000;
const RETIRE_SPEND_HOUSE = 100000;
const RETIRE_SPEND_KIDS = 100000;

// ─── Scenario Engine ────────────────────────────────────────
function runScenario({ hasHouse, numKids, label, color, retireSpend, currentAge = 30, mortgagePremium = 1500, postCoastInvest = 0, rentAmount = 1500, retireAge = 50, inflationRate = 0, withdrawalRate = 0.04, base = BASE_DEFAULT }) {
  const houseBuyAge = 28;
  const kid1BirthAge = hasHouse ? 30 : 29;
  const kid2BirthAge = kid1BirthAge + 2;
  const rothAge = 59.5;
  const bridgeYears = Math.max(0, rothAge - retireAge);
  const growth = Math.max(0, GROWTH - inflationRate); // real return rate

  function getMonthlyInvestable(age, coasting = false) {
    let roth = MONTHLY_BASE.yourRoth;
    let wifeTrad = MONTHLY_BASE.wifeTraditional;
    let taxable = MONTHLY_BASE.taxable;
    let metals = MONTHLY_BASE.metals;

    if (coasting) {
      const total = postCoastInvest;
      roth = Math.min(MONTHLY_BASE.yourRoth, total);
      wifeTrad = Math.min(MONTHLY_BASE.wifeTraditional, Math.max(0, total - roth));
      metals = Math.min(MONTHLY_BASE.metals, Math.max(0, total - roth - wifeTrad));
      taxable = Math.max(0, total - roth - wifeTrad - metals);
      return { roth, wifeTrad, taxable, metals };
    }

    if (hasHouse && age < houseBuyAge) {
      taxable -= 3000;
    }
    if (hasHouse && age >= houseBuyAge) {
      const mortgagePaidOff = houseBuyAge + 30;
      if (age < mortgagePaidOff) {
        taxable -= mortgagePremium;
      } else {
        taxable -= Math.max(-3000, PROP_TAX_INS - rentAmount);
      }
    }

    if (numKids >= 1) {
      const k1Age = age - kid1BirthAge;
      if (k1Age >= 0 && k1Age <= 5) taxable -= CHILDCARE_PER_KID;
      else if (k1Age > 5 && k1Age <= 17) taxable -= KID_COST_SCHOOL;
    }

    if (numKids >= 2) {
      const k2Age = age - kid2BirthAge;
      if (k2Age >= 0 && k2Age <= 5) taxable -= CHILDCARE_PER_KID;
      else if (k2Age > 5 && k2Age <= 17) taxable -= KID_COST_SCHOOL;
    }

    taxable = Math.max(0, taxable);
    return { roth, wifeTrad, taxable, metals };
  }

  // ── First pass: find coast FIRE to month precision ──
  let coastFireAge = null;
  let coastFireMonth = null;
  {
    const MONTHLY_GROWTH = Math.pow(1 + growth, 1/12);
    const MONTHLY_GROWTH_METALS = Math.pow(1 + METALS_GROWTH, 1/12);
    let r = base.yourRoth, w = base.wifeTraditional, t = base.taxable;
    let c = base.company, m = base.metals, s = base.sgov;
    let hv = 0;

    const fireNum = retireSpend / withdrawalRate;

    outer: for (let age = currentAge; age <= retireAge; age++) {
      for (let mo = 0; mo < 12; mo++) {
        const fracAge = age + mo / 12;

        r *= MONTHLY_GROWTH; w *= MONTHLY_GROWTH; t *= MONTHLY_GROWTH;
        c *= age < 35 ? 1.0 : Math.pow(1.04, 1/12);
        m *= MONTHLY_GROWTH_METALS;
        if (hv > 0) hv *= Math.pow(1 + HOME_APPRECIATION, 1/12);

        if (hasHouse && age === houseBuyAge && mo === 0) {
          const tn = DOWN_PAYMENT + CLOSING;
          s >= tn ? (s -= tn) : (t -= tn - s, s = 0);
          hv = HOME_PRICE;
        }

        if (mo === 0) {
          if (numKids >= 1 && age - kid1BirthAge === 18) t -= COLLEGE_PER_KID;
          if (numKids >= 2 && age - kid2BirthAge === 18) t -= COLLEGE_PER_KID;
        }

        const yearsLeft = Math.max(0, retireAge - fracAge);
        const totalNow = r + w * 0.8 + t + c + m + s;
        const projected = totalNow * Math.pow(1 + growth, yearsLeft);

        if (!coastFireAge && projected >= fireNum) {
          coastFireAge = age;
          coastFireMonth = mo;
          break outer;
        }

        const contrib = getMonthlyInvestable(fracAge);
        r += contrib.roth; w += contrib.wifeTrad;
        t += contrib.taxable; m += contrib.metals;
      }
    }
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const coastLabel = coastFireAge !== null
    ? `COAST ${MONTHS[coastFireMonth ?? 0]} ${coastFireAge}`
    : null;

  // ── Second pass: full simulation ──
  let yourRoth = base.yourRoth, wifeTrad = base.wifeTraditional;
  let taxable = base.taxable, company = base.company;
  let metals = base.metals, sgov = base.sgov;
  let homeEquity = 0, homeValue = 0;
  const data = [];

  for (let age = currentAge; age <= 70; age++) {
    const isAccumulating = age < retireAge;
    const isBridge = age >= retireAge && age < 60;
    const isRetired = age >= 60;
    const isCoasting = coastFireAge !== null && age >= coastFireAge && isAccumulating;

    yourRoth *= (1 + growth); wifeTrad *= (1 + growth);
    taxable *= (1 + growth); company *= age < 35 ? 1.0 : 1.04;
    metals *= (1 + METALS_GROWTH);
    if (homeValue > 0) homeValue *= (1 + HOME_APPRECIATION);

    if (isAccumulating) {
      if (hasHouse && age === houseBuyAge) {
        const totalNeeded = DOWN_PAYMENT + CLOSING;
        sgov >= totalNeeded ? (sgov -= totalNeeded) : (taxable -= totalNeeded - sgov, sgov = 0);
        homeValue = HOME_PRICE; homeEquity = DOWN_PAYMENT;
      }

      if (!isCoasting || postCoastInvest > 0) {
        const contrib = getMonthlyInvestable(age, isCoasting);
        yourRoth += contrib.roth * 12;
        wifeTrad += contrib.wifeTrad * 12;
        taxable += contrib.taxable * 12;
        metals += contrib.metals * 12;
      }

      if (numKids >= 1 && age - kid1BirthAge === 18) taxable -= COLLEGE_PER_KID;
      if (numKids >= 2 && age - kid2BirthAge === 18) taxable -= COLLEGE_PER_KID;

      if (hasHouse && age >= houseBuyAge) {
        homeEquity = Math.min(homeEquity + 500 * 12, homeValue);
      }
    }

    if (isBridge) {
      taxable >= retireSpend
        ? (taxable -= retireSpend)
        : (company = Math.max(0, company - (retireSpend - taxable)), taxable = 0);
    }

    if (isRetired) {
      const totalRetire = yourRoth + wifeTrad;
      const rothShare = totalRetire > 0 ? yourRoth / totalRetire : 0.6;
      yourRoth = Math.max(0, yourRoth - retireSpend * rothShare);
      wifeTrad = Math.max(0, wifeTrad - retireSpend * (1 - rothShare));
    }

    const liquidTotal = yourRoth + wifeTrad + taxable + company + metals + sgov;
    data.push({
      age,
      total: Math.round(liquidTotal / 1000),
      netWorth: Math.round((liquidTotal + (hasHouse ? homeEquity : 0)) / 1000),
      coasting: isCoasting,
      isCoastPoint: age === coastFireAge,
      phase: isAccumulating ? 0 : isBridge ? 1 : 2,
    });
  }

  function buildPhaseContribs() {
    const checkAges = [];
    checkAges.push({ label: `Today (Age ${currentAge})`, age: currentAge });
    if (hasHouse && currentAge < houseBuyAge) {
      checkAges.push({ label: `Saving for House (${currentAge}–${houseBuyAge})`, age: currentAge + 1 });
      checkAges.push({ label: `After House Purchase (${houseBuyAge}+)`, age: houseBuyAge + 1 });
    }
    if (numKids >= 1) {
      checkAges.push({ label: `Kid 1 Childcare (Age ${kid1BirthAge}–${kid1BirthAge+5})`, age: kid1BirthAge + 1 });
      checkAges.push({ label: `Kid 1 School (Age ${kid1BirthAge+6}–${kid1BirthAge+17})`, age: kid1BirthAge + 7 });
    }
    if (numKids >= 2) {
      checkAges.push({ label: `Both in Childcare (Age ${kid2BirthAge}–${kid1BirthAge+5})`, age: kid2BirthAge + 1 });
      checkAges.push({ label: `Kid1 School + Kid2 Care`, age: kid1BirthAge + 6 });
      checkAges.push({ label: `Both Kids in School`, age: kid2BirthAge + 6 });
    }
    const lastKidLeave = numKids >= 2 ? kid2BirthAge + 18 : numKids === 1 ? kid1BirthAge + 18 : 0;
    const stableAge = Math.max(lastKidLeave, hasHouse ? houseBuyAge + 1 : 0, 35);
    if (stableAge < retireAge) checkAges.push({ label: `Stable (Age ${stableAge}+)`, age: stableAge });

    const seen = new Set();
    return checkAges.filter(p => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return p.age >= currentAge && p.age < retireAge;
    }).map(p => {
      const c = getMonthlyInvestable(p.age);
      const houseCost = hasHouse && p.age < houseBuyAge ? 3000 : hasHouse ? mortgagePremium : 0;
      const k1 = numKids >= 1 ? p.age - kid1BirthAge : -1;
      const k2 = numKids >= 2 ? p.age - kid2BirthAge : -1;
      const childcare =
        (k1 >= 0 && k1 <= 5 ? CHILDCARE_PER_KID : k1 > 5 && k1 <= 17 ? KID_COST_SCHOOL : 0) +
        (k2 >= 0 && k2 <= 5 ? CHILDCARE_PER_KID : k2 > 5 && k2 <= 17 ? KID_COST_SCHOOL : 0);
      return {
        label: p.label,
        age: p.age,
        snap: {
          monthlyRoth: c.roth,
          monthlyWifeTrad: c.wifeTrad,
          monthlyTaxable: c.taxable,
          monthlyMetals: c.metals,
          monthlyHouseSave: hasHouse && p.age < houseBuyAge ? 3000 : 0,
          monthlyMortgage: hasHouse && p.age >= houseBuyAge ? mortgagePremium : 0,
          monthlyChildcare: childcare,
          totalInvested: c.roth + c.wifeTrad + c.taxable + c.metals,
          totalOut: houseCost + childcare,
        },
      };
    });
  }

  return { label, color, data, coastFireAge, coastFireMonth, coastLabel, retireSpend, hasHouse, numKids, phaseContribs: buildPhaseContribs() };
}

// ─── Scenario definitions ────────────────────────────────────
const SCENARIO_DEFS = [
  { hasHouse: false, numKids: 0, label: "No House, No Kids", color: "#4ade80", retireSpend: RETIRE_SPEND_BASE },
  { hasHouse: true,  numKids: 0, label: "House Only",        color: "#60A5FA", retireSpend: RETIRE_SPEND_HOUSE },
  { hasHouse: true,  numKids: 1, label: "House + 1 Kid",     color: "#F59E0B", retireSpend: RETIRE_SPEND_KIDS },
  { hasHouse: true,  numKids: 2, label: "House + 2 Kids",    color: "#f87171", retireSpend: RETIRE_SPEND_KIDS },
];

// ─── Helpers ─────────────────────────────────────────────────
const fmtM = v => v >= 1000 ? `$${(v / 1000).toFixed(2)}M` : `$${v}k`;

const CustomTooltip = ({ active, payload, label }) => {
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
      <div style={{ color: "#64748b", marginBottom: 10, letterSpacing: 2, fontSize: 11 }}>AGE {label}</div>
      {payload.sort((a, b) => b.value - a.value).map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4, color: p.color }}>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>{p.name.replace(" (NW)", "")}</span>
          <span style={{ fontWeight: 600 }}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────
export default function FireScenarios() {
  const [activeScenarios, setActiveScenarios] = useState(SCENARIO_DEFS.map(s => s.label));
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [hoveredScenario, setHoveredScenario] = useState(null);
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

  const activeData = SCENARIO_DEFS.map(d =>
    runScenario({ ...d, currentAge, mortgagePremium, postCoastInvest, rentAmount: rent, retireAge, inflationRate, withdrawalRate: withdrawalRateDecimal, base })
  );

  const mergedData = activeData[0].data.map((_, i) => {
    const row = { age: activeData[0].data[i].age };
    activeData.forEach(s => {
      row[s.label] = s.data[i].total;
      row[`${s.label}_nw`] = s.data[i].netWorth;
    });
    return row;
  });

  const toggleScenario = (label) => {
    setActiveScenarios(prev =>
      prev.includes(label)
        ? prev.length > 1 ? prev.filter(l => l !== label) : prev
        : [...prev, label]
    );
  };

  const atRetire = (s) => s.data.find(d => d.age === retireAge);
  const atRoth = (s) => s.data.find(d => d.age === 60);

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
          {[
            { label: "Current Rent/mo", value: rent, setter: setRent, color: "#a78bfa", prefix: "$", width: 100 },
            { label: "Est. Mortgage/mo", value: mortgage, setter: setMortgage, color: "#f472b6", prefix: "$", width: 100 },
          ].map(({ label, value, setter, color, prefix, width }) => (
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
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.age !== coastAge) return null;
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
              { key: "monthlyRoth", label: "Your Roth 401k", color: "#6EE7B7" },
              { key: "monthlyWifeTrad", label: "Wife's Trad 401k", color: "#a78bfa" },
              { key: "monthlyTaxable", label: "Taxable Brokerage", color: "#60A5FA" },
              { key: "monthlyMetals", label: "Precious Metals", color: "#D97706" },
            ];
            const costs = [
              { key: "monthlyHouseSave", label: "House Savings", color: "#a78bfa" },
              { key: "monthlyMortgage", label: "Mortgage", color: "#f472b6" },
              { key: "monthlyChildcare", label: "Kids (Childcare/School)", color: "#fb923c" },
            ];
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
