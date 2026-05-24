# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # install dependencies
npm run dev         # start dev server (Vite, localhost:5173)
npm run build       # production build to dist/
npm run preview     # preview the production build
npm run lint        # ESLint (TypeScript + React hooks rules)
npm test            # run Vitest tests once
npm run test:watch  # run Vitest in watch mode
```

```bash
# Build container locally
docker build -t retirement-calculator .
docker run -p 8080:80 retirement-calculator
```

## Styling rule

ESLint enforces `react/forbid-dom-props: [style]` — **inline styles are banned**. All styling must use SCSS modules (`.module.scss`) or the global stylesheet (`src/global.scss`).

## Deployment

The app is deployed as a Kubernetes service. CI builds a multi-arch (amd64/arm64) Nginx image and pushes it to GHCR on every push to `main`.

- **Image**: `ghcr.io/cole-titze/retirement-calculator:latest`
- **CI**: `.github/workflows/build.yml` — triggers on push to main, PRs, weekly Sunday rebuild
- **K8s manifests**: `k8s/deployment.yaml` — Deployment + ClusterIP Service + Ingress at `retirement-calculator.kubecluster`
- **Nginx config**: `nginx.conf` — serves `dist/` with SPA fallback (`try_files $uri /index.html`)

## Architecture

TypeScript + React + Recharts + Vite. No routing, no state management library. All styling via SCSS modules.

### Module layout

```
src/
  constants.ts          — all hardcoded financial constants
  types.ts              — shared TypeScript interfaces
  scenarios.ts          — SCENARIO_DEFS array (four hasHouse/numKids combos)
  utils.ts              — fmtM(): formats a number as $Xk or $X.XXM
  App.tsx               — single React component; runs all scenarios, owns all slider state
  engine/
    runScenario.ts      — core simulation engine
    getMonthlyInvestable.ts — per-bucket monthly contribution at a given age
    getBase.ts          — scales BASE_DEFAULT weights to user-entered starting assets
    buildPhaseContribs.ts   — builds the contributions-by-phase table
  components/
    CustomTooltip.tsx   — Recharts custom tooltip
```

### Simulation engine

`runScenario()` takes `ScenarioParams` and runs two passes:

1. **Monthly loop** (currentAge → retireAge): finds the Coast FIRE date to month precision — the earliest point where the portfolio projected forward at `growth` rate hits `retireSpend / withdrawalRate` with no further contributions.
2. **Annual loop** (currentAge → 70): builds the `DataPoint[]` array for the chart, applying accumulation, bridge-phase, and full-retirement drawdowns.

`getMonthlyInvestable(age, coasting, config)` returns how much flows into each bucket (Roth, wife's trad, taxable, metals) after deducting house-saving redirect, mortgage premium, and childcare.

`getBase(totalAssets)` scales `BASE_DEFAULT` weights proportionally so they sum to `totalAssets`.

### Four scenarios

| Label | hasHouse | numKids |
|---|---|---|
| No House, No Kids | false | 0 |
| House Only | true | 0 |
| House + 1 Kid | true | 1 |
| House + 2 Kids | true | 2 |

All four re-run on every render when any slider changes. Results are merged into a flat `mergedData` array keyed by scenario label for Recharts.

### Two-phase retirement model

- **Bridge phase** (retireAge → 59): draws from taxable brokerage, then company account if taxable runs out
- **Full retirement** (60+): draws from Roth + wife's traditional 401k proportionally

### Key hardcoded constants (`src/constants.ts`)

- `GROWTH = 0.07` (nominal), `METALS_GROWTH = 0.05`, `SGOV_GROWTH = 0.045`
- House: bought at age 28, `HOME_PRICE = 450000`, 10% down, `MORTGAGE_MONTHLY = 3000`
- Kids: Kid 1 born at 30 (house) or 29 (no house); Kid 2 born 2 years after Kid 1
- Childcare: `$1,800/mo` ages 0–5, `$1,100/mo` ages 6–17, `$25,000` lump sum at 18 (college)
- `MONTHLY_BASE.yourRoth = 1958` (2025 IRS Roth 401k monthly max); all other contribution buckets default to 0
- `BASE_DEFAULT` portfolio allocation weights (must sum to 100) used by `getBase()`

### User-adjustable inputs (React state in `App.tsx`)

Current age (18–55), starting assets, current rent, estimated mortgage, retire age (30–58), inflation %, withdrawal %, and post-coast monthly investment. `mortgagePremium` (mortgage minus rent) is the actual cash drag used by the engine — not the raw mortgage amount.
