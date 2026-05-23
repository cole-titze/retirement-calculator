export const fmtM = (v: number): string =>
  v >= 1000 ? `$${(v / 1000).toFixed(2)}M` : `$${v}k`;
