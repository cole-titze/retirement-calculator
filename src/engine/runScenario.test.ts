import { describe, it, expect } from "vitest";
import { runScenario } from "./runScenario";
import { getMonthlyCosts } from "./getMonthlyCosts";
import { SCENARIO_DEFS } from "../scenarios";
import type { Bucket, CostConfig } from "../types";

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

describe("runScenario — tax type", () => {
  // Use 0% growth, 0 contributions, 0 spending so balance is stable and math is exact.
  const scenario = { ...SCENARIO_DEFS[0], retireSpend: 0 };
  const params = { currentAge: 30, retireAge: 50, inflationRate: 0, withdrawalRate: 0.04, mortgagePremium: 0, rentAmount: 0 };
  const makeBucket = (taxType: "roth" | "traditional" | "taxable") =>
    ({ id: "a", label: "A", balance: 100000, monthlyContrib: 0, annualReturn: 0, taxType });

  it("Roth bucket: tax rate has no effect on displayed total", () => {
    const b = makeBucket("roth");
    const r0  = runScenario({ ...scenario, ...params, buckets: [b], retireTaxRate: 0 });
    const r22 = runScenario({ ...scenario, ...params, buckets: [b], retireTaxRate: 22 });
    expect(r0.data.find(d => d.age === 30)!.total).toBe(r22.data.find(d => d.age === 30)!.total);
  });

  it("Taxable bucket: tax rate has no effect on displayed total", () => {
    const b = makeBucket("taxable");
    const r0  = runScenario({ ...scenario, ...params, buckets: [b], retireTaxRate: 0 });
    const r22 = runScenario({ ...scenario, ...params, buckets: [b], retireTaxRate: 22 });
    expect(r0.data.find(d => d.age === 30)!.total).toBe(r22.data.find(d => d.age === 30)!.total);
  });

  it("Traditional bucket: total is reduced by tax rate", () => {
    const r = runScenario({ ...scenario, ...params, buckets: [makeBucket("traditional")], retireTaxRate: 20 });
    // 100k * (1 - 0.20) / 1000 = 80
    expect(r.data.find(d => d.age === 30)!.total).toBe(80);
  });

  it("Traditional at 0% tax shows full balance", () => {
    const r = runScenario({ ...scenario, ...params, buckets: [makeBucket("traditional")], retireTaxRate: 0 });
    expect(r.data.find(d => d.age === 30)!.total).toBe(100);
  });

  it("mixed Roth + Traditional: only traditional portion is discounted", () => {
    const buckets = [
      { id: "r", label: "Roth", balance: 100000, monthlyContrib: 0, annualReturn: 0, taxType: "roth" as const },
      { id: "t", label: "Trad", balance: 100000, monthlyContrib: 0, annualReturn: 0, taxType: "traditional" as const },
    ];
    const r = runScenario({ ...scenario, ...params, buckets, retireTaxRate: 25 });
    // Roth: 100k, Trad: 100k * 0.75 = 75k → total = 175k → 175
    expect(r.data.find(d => d.age === 30)!.total).toBe(175);
  });
});

describe("runScenario — collegeCostPerKid", () => {
  // House+1Kid: kid1BirthAge=30, college deduction hits at parent age 48
  const collegeAge = 48;
  const buckets = [{ id: "a", label: "A", balance: 500000, monthlyContrib: 0, annualReturn: 0, taxType: "taxable" as const }];
  const params = { ...baseParams, inflationRate: 0, buckets };

  it("higher college cost produces lower total after kid turns 18", () => {
    const free = runScenario({ ...SCENARIO_DEFS[2], ...params, collegeCostPerKid: 0 });
    const paid = runScenario({ ...SCENARIO_DEFS[2], ...params, collegeCostPerKid: 50000 });
    expect(free.data.find(d => d.age === collegeAge + 1)!.total).toBeGreaterThan(
      paid.data.find(d => d.age === collegeAge + 1)!.total
    );
  });

  it("zero college cost: total unchanged across kid's 18th year at 0% growth", () => {
    const result = runScenario({ ...SCENARIO_DEFS[2], ...params, collegeCostPerKid: 0 });
    const before = result.data.find(d => d.age === collegeAge - 1)!;
    const after  = result.data.find(d => d.age === collegeAge + 1)!;
    expect(after.total).toBe(before.total);
  });

  it("college cost does not affect no-kids scenario", () => {
    const noKids = runScenario({ ...SCENARIO_DEFS[0], ...params, collegeCostPerKid: 50000 });
    const before = noKids.data.find(d => d.age === collegeAge - 1)!;
    const after  = noKids.data.find(d => d.age === collegeAge + 1)!;
    expect(after.total).toBe(before.total);
  });
});

describe("runScenario — retireSpend", () => {
  const buckets = [{ id: "a", label: "A", balance: 2000000, monthlyContrib: 0, annualReturn: 0, taxType: "taxable" as const }];
  const params = { ...baseParams, inflationRate: 0, buckets };

  it("higher retireSpend depletes portfolio faster in bridge phase", () => {
    const low  = runScenario({ ...SCENARIO_DEFS[0], ...params, retireSpend: 40000 });
    const high = runScenario({ ...SCENARIO_DEFS[0], ...params, retireSpend: 150000 });
    expect(low.data.find(d => d.age === baseParams.retireAge + 5)!.total).toBeGreaterThan(
      high.data.find(d => d.age === baseParams.retireAge + 5)!.total
    );
  });

  it("retireSpend 0 keeps portfolio flat at 0% growth in bridge phase", () => {
    const result = runScenario({ ...SCENARIO_DEFS[0], ...params, retireSpend: 0 });
    const atRetire = result.data.find(d => d.age === baseParams.retireAge)!;
    const atBridge = result.data.find(d => d.age === baseParams.retireAge + 5)!;
    expect(atBridge.total).toBe(atRetire.total);
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

describe("runScenario — user-configurable cost inputs", () => {
  it("college cost scales portfolio impact: higher cost → lower total year after kid turns 18", () => {
    // hasHouse: true → kid1BirthAge = 30, college at age 48, check age 49
    const noCost = runScenario({
      ...SCENARIO_DEFS[2], ...baseParams, // House + 1 Kid
      buckets: LARGE_BUCKETS,
      collegeCostPerKid: 0,
    });
    const highCost = runScenario({
      ...SCENARIO_DEFS[2], ...baseParams,
      buckets: LARGE_BUCKETS,
      collegeCostPerKid: 50000,
    });
    const noCostAt49   = noCost.data.find(d => d.age === 49)!;
    const highCostAt49 = highCost.data.find(d => d.age === 49)!;
    expect(noCostAt49.total).toBeGreaterThan(highCostAt49.total);
  });

  it("retireSpend drives bridge depletion: higher spend → lower total at retireAge + 3", () => {
    // 0% growth, no contributions, 0 inflation so math is exact
    const flatBuckets: Bucket[] = [
      { id: "a", label: "A", balance: 2000000, monthlyContrib: 0, annualReturn: 0, taxType: "taxable" },
    ];
    const lowSpend = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: flatBuckets,
      inflationRate: 0,
      retireSpend: 50000,
    });
    const highSpend = runScenario({
      ...SCENARIO_DEFS[0], ...baseParams,
      buckets: flatBuckets,
      inflationRate: 0,
      retireSpend: 200000,
    });
    const checkAge = baseParams.retireAge + 3;
    const lowAt  = lowSpend.data.find(d => d.age === checkAge)!;
    const highAt = highSpend.data.find(d => d.age === checkAge)!;
    expect(lowAt.total).toBeGreaterThan(highAt.total);
  });

  it("houseSavings appears as cost pre-purchase: getMonthlyCosts returns custom houseSave", () => {
    const houseBuyAge = 28;
    const config: CostConfig = {
      hasHouse: true,
      numKids: 0,
      houseBuyAge,
      kid1BirthAge: 30,
      kid2BirthAge: 32,
      mortgagePremium: 1500,
      rentAmount: 1500,
      childcareCost: 1800,
      kidCostSchool: 1100,
      houseSavings: 4000,
      propTaxIns: 600,
    };
    // Age 26 is before houseBuyAge (28), so houseSave should be the custom value
    const costs = getMonthlyCosts(26, config);
    expect(costs.houseSave).toBe(4000);
  });

  it("propTaxIns appears after mortgage payoff: getMonthlyCosts returns propTaxIns as mortgage", () => {
    const houseBuyAge = 28;
    const config: CostConfig = {
      hasHouse: true,
      numKids: 0,
      houseBuyAge,
      kid1BirthAge: 30,
      kid2BirthAge: 32,
      mortgagePremium: 1500,
      rentAmount: 0,
      childcareCost: 1800,
      kidCostSchool: 1100,
      houseSavings: 3000,
      propTaxIns: 800,
    };
    // Mortgage paid off at houseBuyAge + 30 = 58; check age 59 (> 58)
    const costs = getMonthlyCosts(houseBuyAge + 31, config);
    expect(costs.mortgage).toBe(800);
  });
});
