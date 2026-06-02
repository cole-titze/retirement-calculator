import { describe, it, expect } from "vitest";
import { getMonthlyCosts } from "./getMonthlyCosts";
import { CHILDCARE_PER_KID } from "../constants";
import type { CostConfig } from "../types";

const noHouseNoKids: CostConfig = {
  hasHouse: false,
  numKids: 0,
  houseBuyAge: 28,
  kid1BirthAge: 29,
  kid2BirthAge: 31,
  mortgagePremium: 1500,
  rentAmount: 1500,
  childcareCost: 1800,
  kidCostSchool: 1100,
  propTaxIns: 600,
};

describe("getMonthlyCosts — no house, no kids", () => {
  it("returns rent as housing cost for no house no kids", () => {
    const costs = getMonthlyCosts(30, noHouseNoKids);
    expect(costs.housing).toBe(1500);
    expect(costs.childcare).toBe(0);
    expect(costs.total).toBe(1500);
  });
});

describe("getMonthlyCosts — house", () => {
  const config: CostConfig = { ...noHouseNoKids, hasHouse: true, kid1BirthAge: 30, kid2BirthAge: 32 };

  it("housing is rent before house purchase", () => {
    const costs = getMonthlyCosts(26, config);
    expect(costs.housing).toBe(1500);
  });

  it("housing is rent + mortgagePremium after purchase", () => {
    const costs = getMonthlyCosts(29, config);
    expect(costs.housing).toBe(3000); // 1500 rent + 1500 premium
  });

  it("total equals sum of parts", () => {
    const costs = getMonthlyCosts(29, config);
    expect(costs.total).toBe(costs.housing + costs.childcare);
  });
});

describe("getMonthlyCosts — kids", () => {
  const config: CostConfig = { ...noHouseNoKids, numKids: 1, kid1BirthAge: 29 };

  it("childcare cost during early years", () => {
    const costs = getMonthlyCosts(31, config); // kid age 2
    expect(costs.childcare).toBe(CHILDCARE_PER_KID);
  });

  it("no childcare after kid turns 18", () => {
    const costs = getMonthlyCosts(48, config); // kid age 19
    expect(costs.childcare).toBe(0);
  });
});
