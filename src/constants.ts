import type { Portfolio } from "./types";

export const GROWTH = 0.07;
export const METALS_GROWTH = 0.05;
export const SGOV_GROWTH = 0.045;

// Portfolio allocation weights (must sum to 100); getBase() scales these
// proportionally to whatever the user enters as starting assets.
export const BASE_DEFAULT: Portfolio = {
  yourRoth: 40,
  wifeTraditional: 0,
  taxable: 25,
  company: 18,
  metals: 4,
  sgov: 13,
};
export const BASE_DEFAULT_TOTAL = Object.values(BASE_DEFAULT).reduce((a, b) => a + b, 0);

// Monthly contribution amounts per bucket.
// yourRoth defaults to the 2025 IRS Roth 401k max; set others to match your situation.
export const MONTHLY_BASE = {
  yourRoth: 1958,
  wifeTraditional: 0,
  taxable: 0,
  metals: 0,
};

export const PROP_TAX_INS = 600;

export const CHILDCARE_PER_KID = 1800;
export const KID_COST_SCHOOL = 1100;
export const COLLEGE_PER_KID = 25000;

export const RETIRE_SPEND_BASE = 100000;
export const RETIRE_SPEND_HOUSE = 100000;
export const RETIRE_SPEND_KIDS = 100000;
