// Comparative environmental assessment (L2-008, D18): the existing route against the proposed one for the same
// quantity (equivalent functional unit). Pure → tested on its own (environment.test.ts) and used by the page.
//
// Existing route: today's treatment of the material + its transport + the virgin material the requester buys
//   instead (the reference displacement).
// Proposed route: preparation + transport to the requester + treatment of the unusable residue.
// Transport-only is reported on its own and never mixed with the lifecycle comparison. Without a baseline (the
// existing route) or without a factor there is no comparative CO₂e result at all – missing data stays unknown.
import type { TermProblem } from "./negotiation";
import { convertQuantity, type Unit } from "./units";

export const FACTOR_KINDS = ["virgin_production", "processing", "treatment", "transport"] as const;
export type FactorKind = (typeof FACTOR_KINDS)[number];
export const FACTOR_UNITS = ["kg_co2e_per_kg", "kg_co2e_per_tkm"] as const;
export type FactorUnit = (typeof FACTOR_UNITS)[number];
export const FACTOR_BOUNDARIES = ["cradle_to_gate", "gate_to_gate", "end_of_life", "transport"] as const;
export type FactorBoundary = (typeof FACTOR_BOUNDARIES)[number];

/** One referenced emission factor; a stored version never changes (a new value is a new version). */
export type Factor = {
  id: number;
  kind: FactorKind;
  value: number;
  unit: FactorUnit;
  version: string;
  geography: string;
  boundary: FactorBoundary;
  /** Demo value without a source (D18): results that use it are illustrative, never a CO₂e claim. */
  example: boolean;
};

/** The places a factor is used and the unit and boundary each one needs – anything else is inconsistent. */
export const SLOTS = {
  existingTreatment: { unit: "kg_co2e_per_kg", boundary: "end_of_life" },
  processing: { unit: "kg_co2e_per_kg", boundary: "gate_to_gate" },
  residueTreatment: { unit: "kg_co2e_per_kg", boundary: "end_of_life" },
  virginProduction: { unit: "kg_co2e_per_kg", boundary: "cradle_to_gate" },
  transport: { unit: "kg_co2e_per_tkm", boundary: "transport" },
} as const satisfies Record<string, { unit: FactorUnit; boundary: FactorBoundary }>;
export type Slot = keyof typeof SLOTS;
export const SLOT_KEYS = Object.keys(SLOTS) as Slot[];

/** Kind of factor that fits a slot (for the choice lists). */
export function slotAccepts(slot: Slot, factor: Pick<Factor, "unit" | "boundary">): boolean {
  return factor.unit === SLOTS[slot].unit && factor.boundary === SLOTS[slot].boundary;
}

export type EnvironmentInputs = {
  quantity: number;
  unit: Unit;
  yieldPercent: number | null;
  substitutionPercent: number | null;
  /** The baseline. null = the existing route is not described. */
  existing: { treatment: Factor | null; distanceKm: number | null } | null;
  /** "none": the material needs no preparation; null: unknown. */
  processing: Factor | "none" | null;
  proposedDistanceKm: number | null;
  residueTreatment: Factor | null;
  virginProduction: Factor | null;
  transport: Factor | null;
};

export type Comparison = { existingKg: number; proposedKg: number; differenceKg: number };

export type EnvironmentStatus = "complete" | "transport_only" | "incomplete";

export type EnvironmentResult = {
  problems: TermProblem[];
  quantityKg: number | null;
  usableKg: number | null;
  /** Virgin material the usable share replaces: quantity × yield × substitution (AT-L2-008). */
  displacementKg: number | null;
  transport: Comparison | null;
  lifecycle: Comparison | null;
  status: EnvironmentStatus;
  /** Any factor used is an example value without a source. */
  illustrative: boolean;
  /** What is missing for the lifecycle comparison. */
  missing: string[];
};

const kg = (value: number) => Math.round(value * 1000) / 1000;
const MASS_KG: Unit = { key: "kg", dimension: "mass", toBase: 1 };

export function environmentProblems(inputs: EnvironmentInputs): TermProblem[] {
  const problems: TermProblem[] = [];
  // NT-L2-008: emissions per kg need a mass; an item count cannot be compared
  if (inputs.unit.dimension !== "mass") problems.push({ field: "unitKey", code: "UNIT_NOT_MASS" });
  const used: [Slot, Factor | "none" | null | undefined][] = [
    ["existingTreatment", inputs.existing?.treatment],
    ["processing", inputs.processing],
    ["residueTreatment", inputs.residueTreatment],
    ["virginProduction", inputs.virginProduction],
    ["transport", inputs.transport],
  ];
  for (const [slot, factor] of used) {
    if (factor && factor !== "none" && !slotAccepts(slot, factor)) problems.push({ field: slot, code: "FACTOR_MISMATCH" });
  }
  for (const key of ["yieldPercent", "substitutionPercent"] as const) {
    const value = inputs[key];
    if (value != null && (value < 0 || value > 100)) problems.push({ field: key, code: "RANGE" });
  }
  return problems;
}

export function calculateEnvironment(inputs: EnvironmentInputs): EnvironmentResult {
  const problems = environmentProblems(inputs);
  const quantityKg = convertQuantity(inputs.quantity, inputs.unit, MASS_KG);
  const factors = [inputs.existing?.treatment, inputs.processing, inputs.residueTreatment, inputs.virginProduction, inputs.transport];
  const illustrative = factors.some((factor) => factor && factor !== "none" && factor.example);
  const empty: EnvironmentResult = { problems, quantityKg, usableKg: null, displacementKg: null, transport: null, lifecycle: null, status: "incomplete", illustrative, missing: [] };
  if (problems.length > 0 || quantityKg == null) return { ...empty, missing: ["quantity"] };

  const usableKg = inputs.yieldPercent == null ? null : kg((quantityKg * inputs.yieldPercent) / 100);
  const displacementKg = usableKg == null || inputs.substitutionPercent == null ? null : kg((usableKg * inputs.substitutionPercent) / 100);
  const tonnes = quantityKg / 1000;

  const missing: string[] = [];
  if (!inputs.existing) missing.push("baseline");
  if (!inputs.transport) missing.push("factor.transport");
  if (inputs.proposedDistanceKm == null) missing.push("proposedDistance");
  if (inputs.existing && inputs.existing.distanceKm == null) missing.push("existingDistance");

  const transportOf = (distanceKm: number) => kg(tonnes * distanceKm * inputs.transport!.value);
  const transport: Comparison | null =
    inputs.existing && inputs.existing.distanceKm != null && inputs.transport && inputs.proposedDistanceKm != null
      ? comparison(transportOf(inputs.existing.distanceKm), transportOf(inputs.proposedDistanceKm))
      : null;

  if (inputs.existing && !inputs.existing.treatment) missing.push("factor.existingTreatment");
  if (inputs.processing == null) missing.push("factor.processing");
  if (usableKg == null) missing.push("yield");
  if (inputs.substitutionPercent == null) missing.push("substitution");
  if (!inputs.virginProduction) missing.push("factor.virginProduction");
  const residueKg = usableKg == null ? null : kg(quantityKg - usableKg);
  if (residueKg != null && residueKg > 0 && !inputs.residueTreatment) missing.push("factor.residueTreatment");

  let lifecycle: Comparison | null = null;
  if (missing.length === 0 && transport && inputs.existing?.treatment && inputs.virginProduction && displacementKg != null && residueKg != null && inputs.processing != null) {
    const processing = inputs.processing === "none" ? 0 : quantityKg * inputs.processing.value;
    const residue = residueKg > 0 ? residueKg * inputs.residueTreatment!.value : 0;
    const existingKg = quantityKg * inputs.existing.treatment.value + transport.existingKg + displacementKg * inputs.virginProduction.value;
    const proposedKg = processing + transport.proposedKg + residue;
    lifecycle = comparison(kg(existingKg), kg(proposedKg));
  }

  return {
    problems,
    quantityKg,
    usableKg,
    displacementKg,
    transport,
    lifecycle,
    status: lifecycle ? "complete" : transport ? "transport_only" : "incomplete",
    illustrative,
    missing,
  };
}

/** Negative difference = the proposed route emits less than the existing one. */
function comparison(existingKg: number, proposedKg: number): Comparison {
  return { existingKg, proposedKg, differenceKg: kg(proposedKg - existingKg) };
}
