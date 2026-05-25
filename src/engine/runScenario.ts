import { COLLEGE_PER_KID } from "../constants";
import type { ScenarioParams, ScenarioResult } from "../types";
import { buildPhaseContribs } from "./buildPhaseContribs";
import { getMonthlyCosts } from "./getMonthlyCosts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Deducts `amount` from balances starting from the last bucket working backward.
function applyLifeCosts(balances: number[], amount: number): void {
  let remaining = amount;
  for (let i = balances.length - 1; i >= 0 && remaining > 0; i--) {
    const deduct = Math.min(Math.max(0, balances[i]), remaining);
    balances[i] = Math.max(0, balances[i] - deduct);
    remaining -= deduct;
  }
}

export function runScenario({
  hasHouse,
  numKids,
  label,
  color,
  retireSpend,
  buckets,
  currentAge = 30,
  mortgagePremium = 1500,
  postCoastInvest = 0,
  rentAmount = 1500,
  retireAge = 50,
  inflationRate = 0,
  withdrawalRate = 0.04,
  childcareCost = 1800,
  kidCostSchool = 1100,
  retireTaxRate = 0,
}: ScenarioParams): ScenarioResult {
  const houseBuyAge = 28;
  const kid1BirthAge = hasHouse ? 30 : 29;
  const kid2BirthAge = kid1BirthAge + 2;

  const config = { hasHouse, numKids, houseBuyAge, kid1BirthAge, kid2BirthAge, mortgagePremium, rentAmount, childcareCost, kidCostSchool };

  // Real growth rate per bucket (clamped to ≥ 0)
  const realRates = buckets.map(b => Math.max(0, b.annualReturn / 100 - inflationRate));
  const totalMonthlyContrib = buckets.reduce((s, b) => s + b.monthlyContrib, 0);

  // Returns effective per-bucket contribution amounts after deducting life costs.
  function effectiveContribs(monthlyCostTotal: number): number[] {
    let remaining = monthlyCostTotal;
    const amounts = buckets.map(b => b.monthlyContrib);
    for (let i = amounts.length - 1; i >= 0 && remaining > 0; i--) {
      const deduct = Math.min(amounts[i], remaining);
      amounts[i] -= deduct;
      remaining -= deduct;
    }
    return amounts;
  }

  // ── First pass: find coast FIRE to month precision ──
  let coastFireAge: number | null = null;
  let coastFireMonth: number | null = null;
  {
    const monthlyGrowths = realRates.map(r => Math.pow(1 + r, 1 / 12));
    const balances = buckets.map(b => b.balance);
    const fireNum = retireSpend / withdrawalRate;

    outer: for (let age = currentAge; age <= retireAge; age++) {
      for (let mo = 0; mo < 12; mo++) {
        const fracAge = age + mo / 12;
        for (let i = 0; i < balances.length; i++) balances[i] *= monthlyGrowths[i];

        if (mo === 0) {
          if (numKids >= 1 && age - kid1BirthAge === 18) applyLifeCosts(balances, COLLEGE_PER_KID);
          if (numKids >= 2 && age - kid2BirthAge === 18) applyLifeCosts(balances, COLLEGE_PER_KID);
        }

        const yearsLeft = Math.max(0, retireAge - fracAge);
        const projected = balances.reduce((s, bal, i) => s + bal * Math.pow(1 + realRates[i], yearsLeft), 0);

        if (!coastFireAge && projected >= fireNum) {
          coastFireAge = age;
          coastFireMonth = mo;
          break outer;
        }

        const costs = getMonthlyCosts(fracAge, config);
        const contribs = effectiveContribs(costs.total);
        const excess = costs.total - buckets.reduce((s, b) => s + b.monthlyContrib, 0);
        if (excess > 0) applyLifeCosts(balances, excess);
        for (let i = 0; i < balances.length; i++) balances[i] += contribs[i];
      }
    }
  }

  const coastLabel =
    coastFireAge !== null ? `COAST ${MONTHS[coastFireMonth ?? 0]} ${coastFireAge}` : null;

  // ── Second pass: full simulation age currentAge → 70 ──
  const balances = buckets.map(b => b.balance);
  const data = [];

  for (let age = currentAge; age <= 70; age++) {
    const isAccumulating = age < retireAge;
    const isBridge = age >= retireAge && age < 60;
    const isRetired = age >= 60;
    const isCoasting = coastFireAge !== null && age >= coastFireAge && isAccumulating;

    for (let i = 0; i < balances.length; i++) balances[i] *= (1 + realRates[i]);

    if (isAccumulating) {
      if (!isCoasting || postCoastInvest > 0) {
        const costs = getMonthlyCosts(age, config);
        const annualCostTotal = costs.total * 12;

        let annualContribs: number[];
        if (isCoasting) {
          annualContribs = buckets.map(b =>
            totalMonthlyContrib > 0 ? (b.monthlyContrib / totalMonthlyContrib) * postCoastInvest * 12 : 0,
          );
        } else {
          annualContribs = effectiveContribs(costs.total).map(m => m * 12);
          // If costs exceed total contributions, deduct excess from balances
          const contributionTotal = annualContribs.reduce((s, v) => s + v, 0);
          const excess = annualCostTotal - (totalMonthlyContrib * 12 - contributionTotal);
          if (excess > 0) applyLifeCosts(balances, excess);
        }

        for (let i = 0; i < balances.length; i++) balances[i] += annualContribs[i];
      }

      if (numKids >= 1 && age - kid1BirthAge === 18) applyLifeCosts(balances, COLLEGE_PER_KID);
      if (numKids >= 2 && age - kid2BirthAge === 18) applyLifeCosts(balances, COLLEGE_PER_KID);
    }

    if (isBridge) applyLifeCosts(balances, retireSpend);

    if (isRetired) {
      const total = balances.reduce((s, b) => s + b, 0);
      if (total > 0) {
        for (let i = 0; i < balances.length; i++) {
          balances[i] = Math.max(0, balances[i] - retireSpend * (balances[i] / total));
        }
      }
    }

    const taxMultiplier = (i: number) =>
      buckets[i].taxType === "traditional" ? 1 - retireTaxRate / 100 : 1;
    const liquidTotal = balances.reduce((s, b, i) => s + b * taxMultiplier(i), 0);
    data.push({
      age,
      total: Math.round(liquidTotal / 1000),
      coasting: isCoasting,
      isCoastPoint: age === coastFireAge,
      phase: (isAccumulating ? 0 : isBridge ? 1 : 2) as 0 | 1 | 2,
    });
  }

  const phaseContribs = buildPhaseContribs({
    currentAge,
    hasHouse,
    numKids,
    houseBuyAge,
    kid1BirthAge,
    kid2BirthAge,
    retireAge,
    buckets,
    config,
  });

  return { label, color, data, coastFireAge, coastFireMonth, coastLabel, retireSpend, hasHouse, numKids, phaseContribs };
}
