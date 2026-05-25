import { describe, it, expect } from "vitest";
import { getMonthlyCosts } from "./getMonthlyCosts";
import { CHILDCARE_PER_KID } from "../constants";
import type { CostConfig } from "../types";

const baseConfig: CostConfig = {
  hasHouse: false,
  numKids: 0,
  houseBuyAge: 28,
  kid1BirthAge: 29,
  kid2BirthAge: 31,
  mortgagePremium: 1500,
  rentAmount: 1500,
  childcareCost: 1800,
  kidCostSchool: 1100,
  houseSavings: 3000,
  propTaxIns: 600,
};

describe("getMonthlyCosts — no house, no kids", () => {
  it("returns zero total for no house no kids", () => {
    const result = getMonthlyCosts(30, baseConfig);
    expect(result.total).toBe(0);
  });
});

describe("getMonthlyCosts — house saving period", () => {
  const config: CostConfig = { ...baseConfig, hasHouse: true, kid1BirthAge: 30, kid2BirthAge: 32 };

  it("houseSave is 3000 before house purchase", () => {
    const result = getMonthlyCosts(26, config);
    expect(result.houseSave).toBe(3000);
  });

  it("mortgage equals mortgagePremium after house purchase", () => {
    const result = getMonthlyCosts(29, config);
    expect(result.mortgage).toBe(config.mortgagePremium);
  });

  it("house costs do not appear in childcare field", () => {
    const result = getMonthlyCosts(26, config);
    expect(result.childcare).toBe(0);
  });
});

describe("getMonthlyCosts — kids costs", () => {
  const config: CostConfig = { ...baseConfig, numKids: 1, kid1BirthAge: 29 };

  it("childcare cost during ages 0–5 of kid", () => {
    const result = getMonthlyCosts(31, config); // kid age 2
    expect(result.childcare).toBe(CHILDCARE_PER_KID);
  });

  it("school cost during ages 6–17 of kid", () => {
    const result = getMonthlyCosts(36, config); // kid age 7
    expect(result.childcare).toBe(1100);
  });

  it("no kid deduction once kid is 18+", () => {
    const result = getMonthlyCosts(48, config); // kid age 19
    expect(result.childcare).toBe(0);
  });
});

describe("getMonthlyCosts — two kids", () => {
  const config: CostConfig = { ...baseConfig, numKids: 2, kid1BirthAge: 29, kid2BirthAge: 31 };

  it("both kids in childcare simultaneously", () => {
    const result = getMonthlyCosts(32, config); // kid1 age 3, kid2 age 1
    expect(result.childcare).toBe(CHILDCARE_PER_KID * 2);
  });

  it("total equals sum of parts", () => {
    const result = getMonthlyCosts(32, config);
    expect(result.total).toBe(result.houseSave + result.mortgage + result.childcare);
  });
});

describe("getMonthlyCosts — houseSavings", () => {
  const config: CostConfig = { ...baseConfig, hasHouse: true, houseSavings: 4000, kid1BirthAge: 30, kid2BirthAge: 32 };

  it("uses houseSavings value before house purchase", () => {
    const result = getMonthlyCosts(26, config); // age 26 < houseBuyAge 28
    expect(result.houseSave).toBe(4000);
  });

  it("houseSave is 0 after house purchase", () => {
    const result = getMonthlyCosts(30, config); // age 30 > houseBuyAge 28
    expect(result.houseSave).toBe(0);
  });
});

describe("getMonthlyCosts — propTaxIns", () => {
  const houseBuyAge = 28;
  const config: CostConfig = { ...baseConfig, hasHouse: true, propTaxIns: 800, rentAmount: 0, kid1BirthAge: 30, kid2BirthAge: 32 };

  it("uses propTaxIns as mortgage cost after mortgage is paid off", () => {
    const afterPayoff = houseBuyAge + 31; // 30-year mortgage
    const result = getMonthlyCosts(afterPayoff, config);
    expect(result.mortgage).toBe(800);
  });

  it("propTaxIns is reduced by rentAmount after payoff", () => {
    const configWithRent: CostConfig = { ...config, rentAmount: 300 };
    const afterPayoff = houseBuyAge + 31;
    const result = getMonthlyCosts(afterPayoff, configWithRent);
    expect(result.mortgage).toBe(500); // 800 - 300
  });
});
