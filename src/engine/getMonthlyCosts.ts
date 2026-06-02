import type { CostConfig } from "../types";

export interface MonthlyCosts {
  housing: number;  // rent (renting), full mortgage payment (buying), or propTaxIns (after payoff)
  childcare: number;
  total: number;
}

export function getMonthlyCosts(age: number, config: CostConfig): MonthlyCosts {
  const { hasHouse, numKids, houseBuyAge, kid1BirthAge, kid2BirthAge, mortgagePremium, rentAmount, childcareCost, kidCostSchool, propTaxIns } = config;

  let housing = 0;
  let childcare = 0;

  if (!hasHouse || age < houseBuyAge) {
    housing = rentAmount;                        // renting
  } else {
    const mortgagePaidOff = houseBuyAge + 30;
    housing = age < mortgagePaidOff
      ? rentAmount + mortgagePremium             // full mortgage = rent + premium
      : propTaxIns;                              // taxes/insurance only after payoff
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
