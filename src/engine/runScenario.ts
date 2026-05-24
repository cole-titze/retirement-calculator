import {
  GROWTH,
  METALS_GROWTH,
  COLLEGE_PER_KID,
  BASE_DEFAULT,
} from "../constants";
import type { ScenarioParams, ScenarioResult } from "../types";
import { buildPhaseContribs } from "./buildPhaseContribs";
import { getMonthlyInvestable } from "./getMonthlyInvestable";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function runScenario({
  hasHouse,
  numKids,
  label,
  color,
  retireSpend,
  currentAge = 30,
  mortgagePremium = 1500,
  postCoastInvest = 0,
  rentAmount = 1500,
  retireAge = 50,
  growthRate = GROWTH,
  inflationRate = 0,
  withdrawalRate = 0.04,
  base = BASE_DEFAULT,
}: ScenarioParams): ScenarioResult {
  const houseBuyAge = 28;
  const kid1BirthAge = hasHouse ? 30 : 29;
  const kid2BirthAge = kid1BirthAge + 2;
  const growth = Math.max(0, growthRate - inflationRate);

  const config = {
    hasHouse,
    numKids,
    houseBuyAge,
    kid1BirthAge,
    kid2BirthAge,
    mortgagePremium,
    postCoastInvest,
    rentAmount,
  };

  // ── First pass: find coast FIRE to month precision ──
  let coastFireAge: number | null = null;
  let coastFireMonth: number | null = null;
  {
    const MONTHLY_GROWTH = Math.pow(1 + growth, 1 / 12);
    const MONTHLY_GROWTH_METALS = Math.pow(1 + METALS_GROWTH, 1 / 12);
    let r = base.yourRoth, w = base.wifeTraditional, t = base.taxable;
    let c = base.company, m = base.metals, s = base.sgov;

    const fireNum = retireSpend / withdrawalRate;

    outer: for (let age = currentAge; age <= retireAge; age++) {
      for (let mo = 0; mo < 12; mo++) {
        const fracAge = age + mo / 12;

        r *= MONTHLY_GROWTH; w *= MONTHLY_GROWTH; t *= MONTHLY_GROWTH;
        c *= age < 35 ? 1.0 : Math.pow(1.04, 1 / 12);
        m *= MONTHLY_GROWTH_METALS;

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

        const contrib = getMonthlyInvestable(fracAge, false, config);
        r += contrib.roth; w += contrib.wifeTrad;
        t += contrib.taxable; m += contrib.metals;
      }
    }
  }

  const coastLabel =
    coastFireAge !== null
      ? `COAST ${MONTHS[coastFireMonth ?? 0]} ${coastFireAge}`
      : null;

  // ── Second pass: full simulation age currentAge → 70 ──
  let yourRoth = base.yourRoth, wifeTrad = base.wifeTraditional;
  let taxable = base.taxable, company = base.company;
  let metals = base.metals, sgov = base.sgov;

  const data = [];

  for (let age = currentAge; age <= 70; age++) {
    const isAccumulating = age < retireAge;
    const isBridge = age >= retireAge && age < 60;
    const isRetired = age >= 60;
    const isCoasting = coastFireAge !== null && age >= coastFireAge && isAccumulating;

    yourRoth *= (1 + growth); wifeTrad *= (1 + growth);
    taxable  *= (1 + growth); company  *= age < 35 ? 1.0 : 1.04;
    metals   *= (1 + METALS_GROWTH);

    if (isAccumulating) {
      if (!isCoasting || postCoastInvest > 0) {
        const contrib = getMonthlyInvestable(age, isCoasting, config);
        yourRoth += contrib.roth   * 12;
        wifeTrad += contrib.wifeTrad * 12;
        taxable  += contrib.taxable * 12;
        metals   += contrib.metals  * 12;
      }

      if (numKids >= 1 && age - kid1BirthAge === 18) taxable -= COLLEGE_PER_KID;
      if (numKids >= 2 && age - kid2BirthAge === 18) taxable -= COLLEGE_PER_KID;
    }

    if (isBridge) {
      if (taxable >= retireSpend) {
        taxable -= retireSpend;
      } else {
        company = Math.max(0, company - (retireSpend - taxable));
        taxable = 0;
      }
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
    mortgagePremium,
    retireAge,
    config,
  });

  return {
    label,
    color,
    data,
    coastFireAge,
    coastFireMonth,
    coastLabel,
    retireSpend,
    hasHouse,
    numKids,
    phaseContribs,
  };
}
