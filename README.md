# FIRE Calculator

[![Lint](https://github.com/cole-titze/retirement-calculator/actions/workflows/lint.yml/badge.svg)](https://github.com/cole-titze/retirement-calculator/actions/workflows/lint.yml)
[![Test](https://github.com/cole-titze/retirement-calculator/actions/workflows/test.yml/badge.svg)](https://github.com/cole-titze/retirement-calculator/actions/workflows/test.yml)
[![Container](https://github.com/cole-titze/retirement-calculator/actions/workflows/build.yml/badge.svg)](https://github.com/cole-titze/retirement-calculator/actions/workflows/build.yml)

A personal retirement scenario planner built with React + Recharts.

## Features
- 4 life scenarios: No House/Kids, House Only, House + 1 Kid, House + 2 Kids
- Two-phase retirement model: Bridge (taxable accounts) → Full retirement (Roth)
- Coast FIRE detection with month precision
- Adjustable inputs: starting assets, retire age, rent, mortgage, inflation, withdrawal rate, post-coast investing
- Mortgage payoff at 30 years with prop tax/insurance only after

## Setup

```bash
npm install
npm run dev
```

## Docker

```bash
docker build -t retirement-calculator .
docker run -p 8080:80 retirement-calculator
```

## Cloudflare Tunnel

To expose the app publicly via [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):

1. Create a tunnel in the Cloudflare dashboard and configure it to route traffic to `http://frontend:80`
2. Copy `docker-compose.prod.yml` and create a `.env` file with your tunnel token:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
   ```
3. Start with the tunnel profile:
   ```bash
   docker compose --profile tunnel up -d
   ```

If no token is set, the `cloudflared` container simply won't start.

## Kubernetes

Push to `main` — GitHub Actions builds a multi-arch image and pushes to `ghcr.io/cole-titze/retirement-calculator:latest`.

Apply the manifests:

```bash
kubectl apply -f k8s/deployment.yaml
```

Before applying, set the Cloudflare Tunnel token in `k8s/deployment.yaml` under `retirement-calculator-secret` (or patch it after):

```bash
kubectl create secret generic retirement-calculator-secret \
  --namespace retirement-calculator \
  --from-literal=cloudflare-tunnel-token=<your-token> \
  --dry-run=client -o yaml | kubectl apply -f -
```

Ingress serves at `retirement-calculator.kubecluster` (adjust the hostname in `k8s/deployment.yaml` to match your cluster). The `cloudflared` deployment (2 replicas) exposes the app publicly via Cloudflare Tunnel.
