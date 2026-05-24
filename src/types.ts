export interface Portfolio {
  yourRoth: number;
  wifeTraditional: number;
  taxable: number;
  company: number;
  metals: number;
  sgov: number;
}

export interface MonthlyContrib {
  roth: number;
  wifeTrad: number;
  taxable: number;
  metals: number;
}

export interface InvestableConfig {
  hasHouse: boolean;
  numKids: number;
  houseBuyAge: number;
  kid1BirthAge: number;
  kid2BirthAge: number;
  mortgagePremium: number;
  postCoastInvest: number;
  rentAmount: number;
}

export interface DataPoint {
  age: number;
  total: number;
  coasting: boolean;
  isCoastPoint: boolean;
  phase: 0 | 1 | 2;
}

export interface PhaseSnap {
  monthlyRoth: number;
  monthlyWifeTrad: number;
  monthlyTaxable: number;
  monthlyMetals: number;
  monthlyHouseSave: number;
  monthlyMortgage: number;
  monthlyChildcare: number;
  totalInvested: number;
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
  currentAge?: number;
  mortgagePremium?: number;
  postCoastInvest?: number;
  rentAmount?: number;
  retireAge?: number;
  growthRate?: number;
  inflationRate?: number;
  withdrawalRate?: number;
  base: Portfolio;
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
