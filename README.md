# FIRE Calculator

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

## Kubernetes

Push to `main` — GitHub Actions builds a multi-arch image and pushes to `ghcr.io/cole-titze/retirement-calculator:latest`.

Apply the manifests:

```bash
kubectl apply -f k8s/deployment.yaml
```

Ingress serves at `retirement-calculator.kubecluster` (adjust the hostname in `k8s/deployment.yaml` to match your cluster).
