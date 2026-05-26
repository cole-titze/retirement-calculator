import { describe, it, expect } from "vitest";
import { buildPhaseContribs } from "./buildPhaseContribs";
import { CHILDCARE_PER_KID } from "../constants";
import type { Bucket, CostConfig } from "../types";

const bucket = (overrides: Partial<Bucket> = {}): Bucket => ({
  id: "roth", label: "Roth", balance: 0, monthlyContrib: 2000, annualReturn: 7, taxType: "roth" as const,
  ...overrides,
});

const makeConfig = (overrides: Partial<CostConfig> = {}): CostConfig => ({
  hasHouse: false, numKids: 0, houseBuyAge: 28,
  kid1BirthAge: 29, kid2BirthAge: 31, mortgagePremium: 1500, rentAmount: 1500, childcareCost: 1800, kidCostSchool: 1100,
  propTaxIns: 600,
  ...overrides,
});

const base = {
  currentAge: 26, hasHouse: false, numKids: 0, houseBuyAge: 28,
  kid1BirthAge: 29, kid2BirthAge: 31, mortgagePremium: 1500, retireAge: 50,
};

describe("buildPhaseContribs — no house, no kids", () => {
  it("returns at least one phase starting at currentAge", () => {
    const phases = buildPhaseContribs({
      ...base,
      buckets: [bucket()],
      config: makeConfig(),
    });
    expect(phases.length).toBeGreaterThan(0);
    expect(phases[0].age).toBe(base.currentAge);
  });

  it("all phases are within [currentAge, retireAge)", () => {
    const phases = buildPhaseContribs({
      ...base,
      buckets: [bucket()],
      config: makeConfig(),
    });
    phases.forEach(p => {
      expect(p.age).toBeGreaterThanOrEqual(base.currentAge);
      expect(p.age).toBeLessThan(base.retireAge);
    });
  });

  it("no duplicate labels", () => {
    const phases = buildPhaseContribs({
      ...base,
      buckets: [bucket()],
      config: makeConfig(),
    });
    const labels = phases.map(p => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("totalInvested matches sum of bucketContribs amounts", () => {
    const phases = buildPhaseContribs({
      ...base,
      buckets: [bucket()],
      config: makeConfig(),
    });
    phases.forEach(p => {
      const sum = p.snap.bucketContribs.reduce((s, b) => s + b.amount, 0);
      expect(p.snap.totalInvested).toBe(sum);
    });
  });

  it("totalOut is 0 with no house and no kids", () => {
    const phases = buildPhaseContribs({
      ...base,
      buckets: [bucket()],
      config: makeConfig(),
    });
    phases.forEach(p => expect(p.snap.totalOut).toBe(0));
  });
});

describe("buildPhaseContribs — house", () => {
  const config = makeConfig({ hasHouse: true });

  it("includes a post-purchase phase with mortgage cost", () => {
    const phases = buildPhaseContribs({
      ...base, hasHouse: true, buckets: [bucket()], config,
    });
    const mortgage = phases.find(p => p.snap.monthlyMortgage > 0);
    expect(mortgage).toBeDefined();
    expect(mortgage!.snap.monthlyMortgage).toBe(config.mortgagePremium);
  });
});

describe("buildPhaseContribs — kids", () => {
  const config = makeConfig({ numKids: 1, kid1BirthAge: 29 });

  it("includes a childcare phase", () => {
    const phases = buildPhaseContribs({
      ...base, numKids: 1, kid1BirthAge: 29, retireAge: 55,
      buckets: [bucket()], config,
    });
    const childcare = phases.find(p => p.snap.monthlyChildcare > 0);
    expect(childcare).toBeDefined();
    expect(childcare!.snap.monthlyChildcare).toBe(CHILDCARE_PER_KID);
  });
});

describe("buildPhaseContribs — life cost deduction from last bucket", () => {
  it("deducts childcare from last bucket first, leaving first bucket intact", () => {
    // Childcare = $1800. Buckets: [roth($2000), market($500)].
    // Last (market): deduct min(500, 1800)=500. Remaining=1300.
    // First (roth): deduct min(2000, 1300)=1300. Roth remaining = 700.
    const bRoth   = bucket({ id: "roth",   label: "Roth",   monthlyContrib: 2000 });
    const bMarket = bucket({ id: "market", label: "Market", monthlyContrib: 500 });
    const config  = makeConfig({ numKids: 1, kid1BirthAge: 26 });

    const phases = buildPhaseContribs({
      ...base, numKids: 1, kid1BirthAge: 26, retireAge: 55,
      buckets: [bRoth, bMarket], config,
    });
    const childcarePhase = phases.find(p => p.snap.monthlyChildcare > 0)!;
    const market = childcarePhase.snap.bucketContribs.find(b => b.id === "market")!;
    const roth   = childcarePhase.snap.bucketContribs.find(b => b.id === "roth")!;
    expect(market.amount).toBe(0);              // fully consumed first
    expect(roth.amount).toBe(2000 - 1300);     // 700 — partially consumed after market is gone
  });

  it("fully protects first bucket when second bucket covers all costs", () => {
    // Roth($2000), Market($2000). Childcare=$1800. Market(last) absorbs all.
    const bRoth   = bucket({ id: "roth",   label: "Roth",   monthlyContrib: 2000 });
    const bMarket = bucket({ id: "market", label: "Market", monthlyContrib: 2000 });
    const config  = makeConfig({ numKids: 1, kid1BirthAge: 26 });

    const phases = buildPhaseContribs({
      ...base, numKids: 1, kid1BirthAge: 26, retireAge: 55,
      buckets: [bRoth, bMarket], config,
    });
    const childcare = phases.find(p => p.snap.monthlyChildcare > 0)!;
    const roth      = childcare.snap.bucketContribs.find(b => b.id === "roth")!;
    const market    = childcare.snap.bucketContribs.find(b => b.id === "market")!;
    expect(roth.amount).toBe(2000);
    expect(market.amount).toBe(2000 - CHILDCARE_PER_KID);
  });
});

describe("buildPhaseContribs — multiple buckets", () => {
  it("bucketContribs has one entry per bucket per phase", () => {
    const buckets = [
      bucket({ id: "a", label: "A", monthlyContrib: 500 }),
      bucket({ id: "b", label: "B", monthlyContrib: 300 }),
      bucket({ id: "c", label: "C", monthlyContrib: 100 }),
    ];
    const phases = buildPhaseContribs({
      ...base, buckets, config: makeConfig(),
    });
    phases.forEach(p => {
      expect(p.snap.bucketContribs).toHaveLength(3);
    });
  });
});
