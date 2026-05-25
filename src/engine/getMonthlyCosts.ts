import { PROP_TAX_INS } from "../constants";
import type { CostConfig } from "../types";

export interface MonthlyCosts {
  houseSave: number;
  mortgage: number;
  childcare: number;
  total: number;
}

export function getMonthlyCosts(age: number, config: CostConfig): MonthlyCosts {
  const { hasHouse, numKids, houseBuyAge, kid1BirthAge, kid2BirthAge, mortgagePremium, rentAmount, childcareCost, kidCostSchool } = config;

  let houseSave = 0;
  let mortgage = 0;
  let childcare = 0;

  if (hasHouse && age < houseBuyAge) {
    houseSave = 3000;
  } else if (hasHouse) {
    const mortgagePaidOff = houseBuyAge + 30;
    if (age < mortgagePaidOff) {
      mortgage = mortgagePremium;
    } else {
      mortgage = Math.max(0, PROP_TAX_INS - rentAmount);
    }
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

  return { houseSave, mortgage, childcare, total: houseSave + mortgage + childcare };
}
