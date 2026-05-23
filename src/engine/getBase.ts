import { BASE_DEFAULT, BASE_DEFAULT_TOTAL } from "../constants";
import type { Portfolio } from "../types";

export function getBase(totalAssets: number): Portfolio {
  const scale = totalAssets / BASE_DEFAULT_TOTAL;
  return {
    yourRoth:       Math.round(BASE_DEFAULT.yourRoth       * scale),
    wifeTraditional:Math.round(BASE_DEFAULT.wifeTraditional* scale),
    taxable:        Math.round(BASE_DEFAULT.taxable        * scale),
    company:        Math.round(BASE_DEFAULT.company        * scale),
    metals:         Math.round(BASE_DEFAULT.metals         * scale),
    sgov:           Math.round(BASE_DEFAULT.sgov           * scale),
  };
}
