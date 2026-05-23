import { CHILDCARE_PER_KID, KID_COST_SCHOOL } from "../constants";
import type { InvestableConfig, PhaseContrib } from "../types";
import { getMonthlyInvestable } from "./getMonthlyInvestable";

interface BuildPhaseContribsParams {
  currentAge: number;
  hasHouse: boolean;
  numKids: number;
  houseBuyAge: number;
  kid1BirthAge: number;
  kid2BirthAge: number;
  mortgagePremium: number;
  retireAge: number;
  config: InvestableConfig;
}

export function buildPhaseContribs({
  currentAge,
  hasHouse,
  numKids,
  houseBuyAge,
  kid1BirthAge,
  kid2BirthAge,
  mortgagePremium,
  retireAge,
  config,
}: BuildPhaseContribsParams): PhaseContrib[] {
  const checkAges: { label: string; age: number }[] = [];

  checkAges.push({ label: `Today (Age ${currentAge})`, age: currentAge });

  if (hasHouse && currentAge < houseBuyAge) {
    checkAges.push({ label: `Saving for House (${currentAge}–${houseBuyAge})`, age: currentAge + 1 });
    checkAges.push({ label: `After House Purchase (${houseBuyAge}+)`, age: houseBuyAge + 1 });
  }

  if (numKids >= 1) {
    checkAges.push({ label: `Kid 1 Childcare (Age ${kid1BirthAge}–${kid1BirthAge + 5})`, age: kid1BirthAge + 1 });
    checkAges.push({ label: `Kid 1 School (Age ${kid1BirthAge + 6}–${kid1BirthAge + 17})`, age: kid1BirthAge + 7 });
  }

  if (numKids >= 2) {
    checkAges.push({ label: `Both in Childcare (Age ${kid2BirthAge}–${kid1BirthAge + 5})`, age: kid2BirthAge + 1 });
    checkAges.push({ label: `Kid1 School + Kid2 Care`, age: kid1BirthAge + 6 });
    checkAges.push({ label: `Both Kids in School`, age: kid2BirthAge + 6 });
  }

  const lastKidLeave =
    numKids >= 2 ? kid2BirthAge + 18 : numKids === 1 ? kid1BirthAge + 18 : 0;
  const stableAge = Math.max(lastKidLeave, hasHouse ? houseBuyAge + 1 : 0, 35);
  if (stableAge < retireAge) {
    checkAges.push({ label: `Stable (Age ${stableAge}+)`, age: stableAge });
  }

  const seen = new Set<string>();
  return checkAges
    .filter((p) => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return p.age >= currentAge && p.age < retireAge;
    })
    .map((p) => {
      const c = getMonthlyInvestable(p.age, false, config);
      const houseCost =
        hasHouse && p.age < houseBuyAge ? 3000 : hasHouse ? mortgagePremium : 0;
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
