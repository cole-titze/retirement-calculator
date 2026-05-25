import { describe, it, expect } from "vitest";
import { runScenario } from "./runScenario";
import { SCENARIO_DEFS } from "../scenarios";
import type { Bucket } from "../types";

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "roth",   label: "Roth 401k", balance: 0, monthlyContrib: 1958, annualReturn: 7, taxType: "roth"    },
  { id: "market", label: "Market",    balance: 0, monthlyContrib: 0,    annualReturn: 7, taxType: "taxable" },
];

const LARGE_BUCKETS: Bucket[] = [
  { id: "roth",   label: "Roth 401k", balance: 1000000, monthlyContrib: 1958, annualReturn: 7, taxType: "roth"    },
  { id: "market", label: "Market",    balance: 0,       monthlyContrib: 0,    annualReturn: 7, taxType: "taxable" },
];

const baseParams = {
  currentAge: 26,
  mortgagePremium: 1500,
  postCoastInvest: 0,
  rentAmount: 1500,
  retireAge: 50,
  inflationRate: 0,
  withdrawalRate: 0.04,
  buckets: DEFAULT_BUCKETS,
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
    SCENARIO_DEFS.forEach(def => {
      const result = runScenario({ ...def, ...baseParams, buckets: LARGE_BUCKETS });
      expect(result.coastFireAge).not.toBeNull();
    });
  });

  it("coastLabel contains the word COAST", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, buckets: LARGE_BUCKETS });
    if (result.coastLabel) {
      expect(result.coastLabel).toContain("COAST");
    }
  });

  it("coastFireAge is within [currentAge, retireAge]", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...baseParams, buckets: LARGE_BUCKETS });
    if (result.coastFireAge !== null) {
      expect(result.coastFireAge).toBeGreaterThanOrEqual(baseParams.currentAge);
      expect(result.coastFireAge).toBeLessThanOrEqual(baseParams.retireAge);
    }
  });
});

describe("runScenario — house scenarios", () => {
  it("house scenario accumulates positive portfolio", () => {
    const result = runScenario({ ...SCENARIO_DEFS[1], ...baseParams });
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

describe("runScenario — bucket differences", () => {
  it("no-kids scenario accumulates more than 2-kids scenario", () => {
    const noKids = runScenario({ ...SCENARIO_DEFS[0], ...baseParams });
    const twoKids = runScenario({ ...SCENARIO_DEFS[3], ...baseParams });
    const retire0 = noKids.data.find(d => d.age === baseParams.retireAge)!;
    const retire2 = twoKids.data.find(d => d.age === baseParams.retireAge)!;
    expect(retire0.total).toBeGreaterThanOrEqual(retire2.total);
  });
});

describe("runScenario — multi-bucket return rates", () => {
  it("higher return bucket accumulates more than lower return bucket", () => {
    const lowReturn = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 10000, monthlyContrib: 0, annualReturn: 2 }],
    });
    const highReturn = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 10000, monthlyContrib: 0, annualReturn: 10 }],
    });
    const retireLow  = lowReturn.data.find(d => d.age === baseParams.retireAge)!;
    const retireHigh = highReturn.data.find(d => d.age === baseParams.retireAge)!;
    expect(retireHigh.total).toBeGreaterThan(retireLow.total);
  });

  it("two buckets total equals equivalent single bucket at same avg rate", () => {
    // Single bucket at 7%
    const single = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 0, monthlyContrib: 1000, annualReturn: 7 }],
    });
    // Two buckets at 7% each — should produce the same total
    const dual = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [
        { id: "a", label: "A", balance: 0, monthlyContrib: 600, annualReturn: 7 },
        { id: "b", label: "B", balance: 0, monthlyContrib: 400, annualReturn: 7 },
      ],
    });
    const singleRetire = single.data.find(d => d.age === baseParams.retireAge)!;
    const dualRetire   = dual.data.find(d => d.age === baseParams.retireAge)!;
    expect(dualRetire.total).toBe(singleRetire.total);
  });
});

describe("runScenario — college costs", () => {
  it("college deduction reduces total at kid's 18th birthday", () => {
    const withKid    = runScenario({ ...SCENARIO_DEFS[2], ...baseParams }); // House + 1 Kid
    const withoutKid = runScenario({ ...SCENARIO_DEFS[1], ...baseParams }); // House Only
    // House+1Kid scenario has a college deduction; House Only does not
    // At any age after kid turns 18, the difference should reflect the deduction
    const kid1BirthAge = 30; // hasHouse=true → kid1BirthAge=30
    const collegeAge = kid1BirthAge + 18;
    const after  = withKid.data.find(d => d.age === collegeAge + 1);
    const before = withKid.data.find(d => d.age === collegeAge - 1);
    if (after && before) {
      // With college cost, total should be less than it would be without
      const noKidAfter  = withoutKid.data.find(d => d.age === collegeAge + 1)!;
      const noKidBefore = withoutKid.data.find(d => d.age === collegeAge - 1)!;
      const kidGrowth   = after.total  - before.total;
      const noKidGrowth = noKidAfter.total - noKidBefore.total;
      // Kid scenario grows less over that year due to college cost
      expect(kidGrowth).toBeLessThan(noKidGrowth);
    }
  });
});

describe("runScenario — bridge and retirement spending", () => {
  it("portfolio decreases during bridge phase", () => {
    const result = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 500000, monthlyContrib: 0, annualReturn: 0 }],
      inflationRate: 0,
    });
    const atRetire = result.data.find(d => d.age === baseParams.retireAge)!;
    const atBridge = result.data.find(d => d.age === baseParams.retireAge + 2)!;
    expect(atBridge.total).toBeLessThan(atRetire.total);
  });

  it("portfolio stays non-negative throughout when started with modest assets", () => {
    const result = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 100000, monthlyContrib: 0, annualReturn: 7 }],
    });
    result.data.forEach(d => expect(d.total).toBeGreaterThanOrEqual(0));
  });

  it("coast is not found when assets are insufficient", () => {
    const result = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: [{ id: "a", label: "A", balance: 0, monthlyContrib: 0, annualReturn: 0 }],
    });
    expect(result.coastFireAge).toBeNull();
  });
});

describe("runScenario — postCoastInvest", () => {
  it("postCoastInvest > 0 produces higher total at retirement than full coast", () => {
    const fullCoast = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: LARGE_BUCKETS,
      postCoastInvest: 0,
    });
    const partialCoast = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: LARGE_BUCKETS,
      postCoastInvest: 500,
    });
    const retire0 = fullCoast.data.find(d => d.age === baseParams.retireAge)!;
    const retire500 = partialCoast.data.find(d => d.age === baseParams.retireAge)!;
    expect(retire500.total).toBeGreaterThanOrEqual(retire0.total);
  });
});
