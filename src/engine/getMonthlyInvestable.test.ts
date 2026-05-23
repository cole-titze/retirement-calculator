import { describe, it, expect } from "vitest";
import { getMonthlyInvestable } from "./getMonthlyInvestable";
import { MONTHLY_BASE, CHILDCARE_PER_KID, KID_COST_SCHOOL } from "../constants";
import type { InvestableConfig } from "../types";

const baseConfig: InvestableConfig = {
  hasHouse: false,
  numKids: 0,
  houseBuyAge: 28,
  kid1BirthAge: 29,
  kid2BirthAge: 31,
  mortgagePremium: 1500,
  postCoastInvest: 0,
  rentAmount: 1500,
};

describe("getMonthlyInvestable — no house, no kids", () => {
  it("returns full MONTHLY_BASE when not coasting", () => {
    const result = getMonthlyInvestable(30, false, baseConfig);
    expect(result.roth).toBe(MONTHLY_BASE.yourRoth);
    expect(result.wifeTrad).toBe(MONTHLY_BASE.wifeTraditional);
    expect(result.taxable).toBe(MONTHLY_BASE.taxable);
    expect(result.metals).toBe(MONTHLY_BASE.metals);
  });

  it("taxable never goes below zero", () => {
    const result = getMonthlyInvestable(30, false, baseConfig);
    expect(result.taxable).toBeGreaterThanOrEqual(0);
  });
});

describe("getMonthlyInvestable — house saving period", () => {
  const config: InvestableConfig = { ...baseConfig, hasHouse: true, kid1BirthAge: 30, kid2BirthAge: 32 };

  it("deducts 3000 from taxable before house purchase", () => {
    const result = getMonthlyInvestable(26, false, config);
    const expected = Math.max(0, MONTHLY_BASE.taxable - 3000);
    expect(result.taxable).toBe(expected);
  });

  it("deducts mortgagePremium from taxable after house purchase", () => {
    const result = getMonthlyInvestable(29, false, config);
    const expected = Math.max(0, MONTHLY_BASE.taxable - config.mortgagePremium);
    expect(result.taxable).toBe(expected);
  });

  it("roth is unaffected by house costs", () => {
    const prePurchase = getMonthlyInvestable(26, false, config);
    const postPurchase = getMonthlyInvestable(29, false, config);
    expect(prePurchase.roth).toBe(MONTHLY_BASE.yourRoth);
    expect(postPurchase.roth).toBe(MONTHLY_BASE.yourRoth);
  });
});

describe("getMonthlyInvestable — kids costs", () => {
  const config: InvestableConfig = { ...baseConfig, numKids: 1, kid1BirthAge: 29 };

  it("deducts childcare cost during ages 0–5 of kid", () => {
    const result = getMonthlyInvestable(31, false, config); // kid age 2
    const expected = Math.max(0, MONTHLY_BASE.taxable - CHILDCARE_PER_KID);
    expect(result.taxable).toBe(expected);
  });

  it("deducts school cost during ages 6–17 of kid", () => {
    const result = getMonthlyInvestable(36, false, config); // kid age 7
    const expected = Math.max(0, MONTHLY_BASE.taxable - KID_COST_SCHOOL);
    expect(result.taxable).toBe(expected);
  });

  it("no kid deduction once kid is 18+", () => {
    const result = getMonthlyInvestable(48, false, config); // kid age 19
    expect(result.taxable).toBe(MONTHLY_BASE.taxable);
  });
});

describe("getMonthlyInvestable — coasting", () => {
  it("caps total at postCoastInvest when coasting", () => {
    const config: InvestableConfig = { ...baseConfig, postCoastInvest: 1000 };
    const result = getMonthlyInvestable(35, true, config);
    const total = result.roth + result.wifeTrad + result.taxable + result.metals;
    expect(total).toBe(1000);
  });

  it("fills roth first up to its cap when coasting", () => {
    const config: InvestableConfig = { ...baseConfig, postCoastInvest: 500 };
    const result = getMonthlyInvestable(35, true, config);
    expect(result.roth).toBe(Math.min(MONTHLY_BASE.yourRoth, 500));
  });

  it("returns all zeros when postCoastInvest is 0 and coasting", () => {
    const config: InvestableConfig = { ...baseConfig, postCoastInvest: 0 };
    const result = getMonthlyInvestable(35, true, config);
    const total = result.roth + result.wifeTrad + result.taxable + result.metals;
    expect(total).toBe(0);
  });
});
