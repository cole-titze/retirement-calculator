export interface Bucket {
  id: string;
  label: string;
  balance: number;
  monthlyContrib: number;
  annualReturn: number; // percent, e.g. 7 for 7%
}

export interface DataPoint {
  age: number;
  total: number;
  coasting: boolean;
  isCoastPoint: boolean;
  phase: 0 | 1 | 2;
}

export interface CostConfig {
  hasHouse: boolean;
  numKids: number;
  houseBuyAge: number;
  kid1BirthAge: number;
  kid2BirthAge: number;
  mortgagePremium: number;
  rentAmount: number;
  childcareCost: number;
}

export interface PhaseSnap {
  bucketContribs: { id: string; label: string; amount: number }[];
  totalInvested: number;
  monthlyHouseSave: number;
  monthlyMortgage: number;
  monthlyChildcare: number;
  totalOut: number;
}

export interface PhaseContrib {
  label: string;
  age: number;
  snap: PhaseSnap;
}

export interface ScenarioDef {
  hasHouse: boolean;
  numKids: number;
  label: string;
  color: string;
  retireSpend: number;
}

export interface ScenarioParams extends ScenarioDef {
  buckets: Bucket[];
  currentAge?: number;
  mortgagePremium?: number;
  postCoastInvest?: number;
  rentAmount?: number;
  retireAge?: number;
  inflationRate?: number;
  withdrawalRate?: number;
}

export interface ScenarioResult {
  label: string;
  color: string;
  data: DataPoint[];
  coastFireAge: number | null;
  coastFireMonth: number | null;
  coastLabel: string | null;
  retireSpend: number;
  hasHouse: boolean;
  numKids: number;
  phaseContribs: PhaseContrib[];
}
