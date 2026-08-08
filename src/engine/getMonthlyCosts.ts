import type { CostConfig } from "../types";

export interface MonthlyCosts {
  // Extra monthly housing cost above the rent baseline.
  // No-house path: 0 (rent is the assumed baseline, paid from income separately).
  // Has-house, mortgage phase: mortgagePremium (the extra cost above rent).
  // Has-house, post-payoff: max(0, propTaxIns − rentAmount) (often 0 if owning is cheaper).
  housing: number;
  childcare: number;
  total: number;
}

export function getMonthlyCosts(age: number, config: CostConfig): MonthlyCosts {
  const { hasHouse, numKids, houseBuyAge, kid1BirthAge, kid2BirthAge, mortgagePremium, rentAmount, childcareCost, kidCostSchool, propTaxIns } = config;

  let housing = 0;
  let childcare = 0;

  if (hasHouse && age >= houseBuyAge) {
    const mortgagePaidOff = houseBuyAge + 30;
    housing = age < mortgagePaidOff
      ? mortgagePremium                          // extra cost above rent during mortgage
      : Math.max(0, propTaxIns - rentAmount);   // tax/insurance minus rent savings after payoff
  }

  if (numKids >= 1) {
    const k1Age = age - kid1BirthAge;
    if (k1Age >= 0 && k1Age <= 5) childcare += childcareCost;
    else if (k1Age > 5 && k1Age <= 17) childcare += kidCostSchool;
  }

  if (numKids >= 2) {
    const k2Age = age - kid2BirthAge;
    if (k2Age >= 0 && k2Age <= 5) childcare += childcareCost;
    else if (k2Age > 5 && k2Age <= 17) childcare += kidCostSchool;
  }

  return { housing, childcare, total: housing + childcare };
}
