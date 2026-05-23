# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # production build to dist/
npm run preview   # preview the production build
```

```bash
# Build container locally
docker build -t retirement-calculator .
docker run -p 8080:80 retirement-calculator
```

No test runner or linter is configured.

## Deployment

The app is deployed as a Kubernetes service. CI builds a multi-arch (amd64/arm64) Nginx image and pushes it to GHCR on every push to `main`.

- **Image**: `ghcr.io/cole-titze/retirement-calculator:latest`
- **CI**: `.github/workflows/build.yml` — triggers on push to main, PRs, weekly Sunday rebuild
- **K8s manifests**: `k8s/deployment.yaml` — Deployment + ClusterIP Service + Ingress at `retirement-calculator.kubecluster`
- **Nginx config**: `nginx.conf` — serves `dist/` with SPA fallback (`try_files $uri /index.html`)

## Architecture

This is a single-file React app — all logic and UI lives in `src/App.jsx`. There is no routing, no state management library, and no CSS files (all styling is inline).

### Simulation engine

The financial model runs entirely in pure functions before the React component renders:

- **`runScenario()`** — core engine. Takes scenario params and runs two sequential passes:
  1. Monthly loop (to month precision) to find the Coast FIRE date — the point at which the portfolio can grow to the FIRE number by `retireAge` with zero further contributions
  2. Annual loop age 26→70 to build the chart data array

- **`getMonthlyInvestable(age, coasting)`** — returns how much goes into each bucket (Roth, wife's trad, taxable, metals) at a given age, after deducting house-saving redirect, mortgage premium, and childcare costs

- **`getBase(totalAssets)`** — scales the hardcoded portfolio allocation proportionally when the user changes "Starting Assets"

- **`buildPhaseContribs()`** (inside `runScenario`) — builds the contributions-by-phase table shown under the chart

### Four scenarios

Defined in `SCENARIO_DEFS`, each re-runs `runScenario()` on every render when the user changes any slider input:

| Label | hasHouse | numKids |
|---|---|---|
| No House, No Kids | false | 0 |
| House Only | true | 0 |
| House + 1 Kid | true | 1 |
| House + 2 Kids | true | 2 |

### Two-phase retirement model

- **Bridge phase** (`retireAge` → 59½): draws from taxable brokerage (then company account if taxable runs out)
- **Full retirement** (59½+): draws from Roth + wife's traditional 401k proportionally

### Key hardcoded constants (top of `App.jsx`)

- `CURRENT_AGE = 26`, `GROWTH = 0.07` (nominal), `METALS_GROWTH = 0.05`, `SGOV_GROWTH = 0.045`
- House: bought at age 28, `HOME_PRICE = 450000`, 10% down, `MORTGAGE_MONTHLY = 3000`
- Kids: Kid 1 born at 30 (house) or 29 (no house); Kid 2 born 2 years after Kid 1
- Childcare: `$1,800/mo` ages 0–5, `$1,100/mo` ages 6–17, `$25,000` lump sum at 18 (college)
- Mortgage pays off at house-buy-age + 30; after that only prop tax/insurance (`$600/mo`)
- `MONTHLY_BASE.yourRoth = 1958` (2025 IRS Roth 401k monthly max); all other contribution buckets default to 0 — set them to match your situation
- `BASE_DEFAULT` is portfolio allocation weights (summing to 100) used to proportionally split the user-entered `startingAssets` across account types; adjust the weights if your allocation differs

### User-adjustable inputs (React state)

Current age (18–55), starting assets, current rent, estimated mortgage, retire age (30–58), inflation %, withdrawal %, and post-coast monthly investment amount. The `mortgagePremium` (mortgage minus rent) is the actual drag on investable cash, not the raw mortgage amount.

### Chart data flow

`mergedData` is a flat array of `{ age, [scenarioLabel]: liquidTotal, [scenarioLabel]_nw: netWorth }` objects fed directly to Recharts `LineChart`. Coast FIRE dots are rendered via the `dot` prop on each `Line` component.
