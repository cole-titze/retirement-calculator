import type { Bucket, CostConfig, PhaseContrib } from "../types";
import { getMonthlyCosts } from "./getMonthlyCosts";

interface BuildPhaseContribsParams {
  currentAge: number;
  hasHouse: boolean;
  numKids: number;
  houseBuyAge: number;
  kid1BirthAge: number;
  kid2BirthAge: number;
  retireAge: number;
  buckets: Bucket[];
  config: CostConfig;
}

function effectiveBucketContribs(
  buckets: Bucket[],
  costTotal: number,
): { id: string; label: string; amount: number }[] {
  let remaining = costTotal;
  const result = buckets.map(b => ({ id: b.id, label: b.label, amount: b.monthlyContrib }));
  for (let i = result.length - 1; i >= 0 && remaining > 0; i--) {
    const deduct = Math.min(result[i].amount, remaining);
    result[i].amount -= deduct;
    remaining -= deduct;
  }
  return result;
}

export function buildPhaseContribs({
  currentAge,
  hasHouse,
  numKids,
  houseBuyAge,
  kid1BirthAge,
  kid2BirthAge,
  retireAge,
  buckets,
  config,
}: BuildPhaseContribsParams): PhaseContrib[] {
  const checkAges: { label: string; age: number }[] = [];

  checkAges.push({ label: `Today (Age ${currentAge})`, age: currentAge });

  if (hasHouse && currentAge < houseBuyAge) {
    checkAges.push({ label: `Saving for House (${currentAge}–${houseBuyAge})`, age: currentAge + 1 });
    checkAges.push({ label: `After House Purchase (${houseBuyAge}+)`, age: houseBuyAge + 1 });
  }

  if (numKids >= 1) {
    checkAges.push({ label: `Kid 1 Childcare (Age ${kid1BirthAge}–${kid1BirthAge + 5})`, age: kid1BirthAge + 1 });
    checkAges.push({ label: `Kid 1 School (Age ${kid1BirthAge + 6}–${kid1BirthAge + 17})`, age: kid1BirthAge + 7 });
  }

  if (numKids >= 2) {
    checkAges.push({ label: `Both in Childcare (Age ${kid2BirthAge}–${kid1BirthAge + 5})`, age: kid2BirthAge + 1 });
    checkAges.push({ label: `Kid1 School + Kid2 Care`, age: kid1BirthAge + 6 });
    checkAges.push({ label: `Both Kids in School`, age: kid2BirthAge + 6 });
  }

  const lastKidLeave =
    numKids >= 2 ? kid2BirthAge + 18 : numKids === 1 ? kid1BirthAge + 18 : 0;
  const stableAge = Math.max(lastKidLeave, hasHouse ? houseBuyAge + 1 : 0, 35);
  if (stableAge < retireAge) {
    checkAges.push({ label: `Stable (Age ${stableAge}+)`, age: stableAge });
  }

  const seen = new Set<string>();
  return checkAges
    .filter(p => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return p.age >= currentAge && p.age < retireAge;
    })
    .map(p => {
      const costs = getMonthlyCosts(p.age, config);
      const bucketContribs = effectiveBucketContribs(buckets, costs.total);
      const totalInvested = bucketContribs.reduce((s, b) => s + b.amount, 0);
      return {
        label: p.label,
        age: p.age,
        snap: {
          bucketContribs,
          totalInvested,
          monthlyMortgage: costs.mortgage,
          monthlyChildcare: costs.childcare,
          totalOut: costs.total,
        },
      };
    });
}
