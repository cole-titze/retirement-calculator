import { describe, it, expect } from "vitest";
import { getBase } from "./getBase";
import { BASE_DEFAULT, BASE_DEFAULT_TOTAL } from "../constants";

describe("getBase", () => {
  it("returns all zeros for zero assets", () => {
    const result = getBase(0);
    expect(result.yourRoth).toBe(0);
    expect(result.wifeTraditional).toBe(0);
    expect(result.taxable).toBe(0);
    expect(result.company).toBe(0);
    expect(result.metals).toBe(0);
    expect(result.sgov).toBe(0);
  });

  it("returns BASE_DEFAULT values when totalAssets equals BASE_DEFAULT_TOTAL", () => {
    const result = getBase(BASE_DEFAULT_TOTAL);
    expect(result.yourRoth).toBe(BASE_DEFAULT.yourRoth);
    expect(result.taxable).toBe(BASE_DEFAULT.taxable);
    expect(result.company).toBe(BASE_DEFAULT.company);
    expect(result.metals).toBe(BASE_DEFAULT.metals);
    expect(result.sgov).toBe(BASE_DEFAULT.sgov);
  });

  it("scales proportionally for double the assets", () => {
    const result = getBase(BASE_DEFAULT_TOTAL * 2);
    expect(result.yourRoth).toBe(BASE_DEFAULT.yourRoth * 2);
    expect(result.taxable).toBe(BASE_DEFAULT.taxable * 2);
    expect(result.sgov).toBe(BASE_DEFAULT.sgov * 2);
  });

  it("preserves allocation ratios for large asset amounts", () => {
    const totalAssets = 500000;
    const result = getBase(totalAssets);
    const scale = totalAssets / BASE_DEFAULT_TOTAL;
    expect(result.yourRoth).toBe(Math.round(BASE_DEFAULT.yourRoth * scale));
    expect(result.taxable).toBe(Math.round(BASE_DEFAULT.taxable * scale));
    expect(result.sgov).toBe(Math.round(BASE_DEFAULT.sgov * scale));
  });
});
