import { RETIRE_SPEND_BASE, RETIRE_SPEND_HOUSE, RETIRE_SPEND_KIDS } from "./constants";
import type { ScenarioDef } from "./types";

export const SCENARIO_DEFS: ScenarioDef[] = [
  { hasHouse: false, numKids: 0, label: "No House, No Kids", color: "#4ade80", retireSpend: RETIRE_SPEND_BASE },
  { hasHouse: true,  numKids: 0, label: "House Only",        color: "#60A5FA", retireSpend: RETIRE_SPEND_HOUSE },
  { hasHouse: true,  numKids: 1, label: "House + 1 Kid",     color: "#F59E0B", retireSpend: RETIRE_SPEND_KIDS },
  { hasHouse: true,  numKids: 2, label: "House + 2 Kids",    color: "#f87171", retireSpend: RETIRE_SPEND_KIDS },
];
