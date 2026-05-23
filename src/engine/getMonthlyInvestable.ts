import { MONTHLY_BASE, CHILDCARE_PER_KID, KID_COST_SCHOOL, PROP_TAX_INS } from "../constants";
import type { InvestableConfig, MonthlyContrib } from "../types";

export function getMonthlyInvestable(
  age: number,
  coasting: boolean,
  config: InvestableConfig,
): MonthlyContrib {
  const {
    hasHouse,
    numKids,
    houseBuyAge,
    kid1BirthAge,
    kid2BirthAge,
    mortgagePremium,
    postCoastInvest,
    rentAmount,
  } = config;

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
