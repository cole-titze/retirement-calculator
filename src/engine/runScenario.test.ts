import { describe, it, expect } from "vitest";
import { runScenario } from "./runScenario";
import { getBase } from "./getBase";
import { SCENARIO_DEFS } from "../scenarios";

const base = getBase(0);

const baseParams = {
  currentAge: 26,
  mortgagePremium: 1500,
  postCoastInvest: 0,
  rentAmount: 1500,
  retireAge: 50,
  inflationRate: 0,
  withdrawalRate: 0.04,
  base,
};

describe("runScenario — basic shape", () => {
  it("returns data from currentAge to 70", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    expect(result.data[0].age).toBe(26);
    expect(result.data[result.data.length - 1].age).toBe(70);
    expect(result.data).toHaveLength(70 - 26 + 1);
  });

  it("passes through label and color unchanged", () => {
    const def = SCENARIO_DEFS[1];
    const result = runScenario({ ...def, ...baseParams });
    expect(result.label).toBe(def.label);
    expect(result.color).toBe(def.color);
  });

  it("data totals are non-negative", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    result.data.forEach(d => {
      expect(d.total).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("runScenario — phases", () => {
  it("phase is 0 (accumulating) before retireAge", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    const preRetire = result.data.filter(d => d.age < baseParams.retireAge);
    preRetire.forEach(d => expect(d.phase).toBe(0));
  });

  it("phase is 1 (bridge) from retireAge to 59", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    const bridge = result.data.filter(d => d.age >= baseParams.retireAge && d.age < 60);
    bridge.forEach(d => expect(d.phase).toBe(1));
  });

  it("phase is 2 (retired) at 60+", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    const retired = result.data.filter(d => d.age >= 60);
    retired.forEach(d => expect(d.phase).toBe(2));
  });
});

describe("runScenario — coast FIRE", () => {
  it("finds a coastFireAge for all four scenarios with sufficient assets", () => {
    // 1M starting assets projects well past any scenario's FIRE number by retireAge
    const largeBase = getBase(1000000);
    SCENARIO_DEFS.forEach(def => {
      const result = runScenario({ ...def, ...baseParams, base: largeBase });
      expect(result.coastFireAge).not.toBeNull();
    });
  });

  it("coastLabel contains the word COAST", () => {
    const largeBase = getBase(1000000);
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, base: largeBase });
    if (result.coastLabel) {
      expect(result.coastLabel).toContain("COAST");
    }
  });

  it("coastFireAge is within [currentAge, retireAge]", () => {
    const largeBase = getBase(1000000);
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, base: largeBase });
    if (result.coastFireAge !== null) {
      expect(result.coastFireAge).toBeGreaterThanOrEqual(baseParams.currentAge);
      expect(result.coastFireAge).toBeLessThanOrEqual(baseParams.retireAge);
    }
  });
});

describe("runScenario — house scenarios", () => {
  it("house scenario accumulates positive portfolio", () => {
    const result = runScenario({ ...SCENARIO_DEFS[1], ...baseParams }); // House Only
    const atRetire = result.data.find(d => d.age === baseParams.retireAge)!;
    expect(atRetire.total).toBeGreaterThan(0);
  });
});

describe("runScenario — inflation", () => {
  it("higher inflation produces lower real portfolio values at retirement", () => {
    const noInflation = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, inflationRate: 0 });
    const highInflation = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, inflationRate: 0.05 });
    const retireNoInfl = noInflation.data.find(d => d.age === baseParams.retireAge)!;
    const retireHighInfl = highInflation.data.find(d => d.age === baseParams.retireAge)!;
    expect(retireNoInfl.total).toBeGreaterThan(retireHighInfl.total);
  });
});
