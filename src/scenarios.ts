import { RETIRE_SPEND_BASE, RETIRE_SPEND_HOUSE, RETIRE_SPEND_KIDS } from "./constants";
import type { ScenarioDef } from "./types";

export const SCENARIO_DEFS: ScenarioDef[] = [
  { hasHouse: false, numKids: 0, label: "No House, No Kids", color: "#2e7d52", retireSpend: RETIRE_SPEND_BASE },
  { hasHouse: true,  numKids: 0, label: "House Only",        color: "#1d5f8a", retireSpend: RETIRE_SPEND_HOUSE },
  { hasHouse: true,  numKids: 1, label: "House + 1 Kid",     color: "#9a6820", retireSpend: RETIRE_SPEND_KIDS },
  { hasHouse: true,  numKids: 2, label: "House + 2 Kids",    color: "#8f2f2f", retireSpend: RETIRE_SPEND_KIDS },
];
