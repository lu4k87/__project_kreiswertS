import { describe, expect, it } from "vitest";
import { calculateEnvironment, environmentProblems, slotAccepts, type EnvironmentInputs, type Factor } from "./environment";
import type { Unit } from "./units";

const KG: Unit = { key: "kg", dimension: "mass", toBase: 1 };
const ITEM: Unit = { key: "item", dimension: "count", toBase: 1 };
const factor = (id: number, kind: Factor["kind"], value: number, unit: Factor["unit"], boundary: Factor["boundary"]): Factor => ({
  id, kind, value, unit, boundary, version: "demo-2026-11", geography: "DE", example: true,
});
const incineration = factor(1, "treatment", 2.3, "kg_co2e_per_kg", "end_of_life");
const grinding = factor(2, "processing", 0.1, "kg_co2e_per_kg", "gate_to_gate");
const virgin = factor(3, "virgin_production", 1.9, "kg_co2e_per_kg", "cradle_to_gate");
const truck = factor(4, "transport", 0.1, "kg_co2e_per_tkm", "transport");

// AT-L2-008: 500 kg × 90 % yield × 80 % substitution
const inputs: EnvironmentInputs = {
  quantity: 500,
  unit: KG,
  yieldPercent: 90,
  substitutionPercent: 80,
  existing: { treatment: incineration, distanceKm: 20 },
  processing: grinding,
  proposedDistanceKm: 10,
  residueTreatment: incineration,
  virginProduction: virgin,
  transport: truck,
};

describe("AT-L2-008 comparative environmental assessment", () => {
  it("500 kg × 90 % × 80 % = 360 kg reference displacement", () => {
    const result = calculateEnvironment(inputs);
    expect(result.usableKg).toBe(450);
    expect(result.displacementKg).toBe(360);
  });

  it("compares both routes on the same quantity and keeps transport apart", () => {
    const result = calculateEnvironment(inputs);
    // transport: 0.5 t × 20 km × 0.1 = 1 kg vs 0.5 t × 10 km × 0.1 = 0.5 kg
    expect(result.transport).toEqual({ existingKg: 1, proposedKg: 0.5, differenceKg: -0.5 });
    // existing 500 × 2.3 + 1 + 360 × 1.9 = 1835; proposed 500 × 0.1 + 0.5 + 50 × 2.3 = 165.5
    expect(result.lifecycle).toEqual({ existingKg: 1835, proposedKg: 165.5, differenceKg: -1669.5 });
    expect(result.status).toBe("complete");
    expect(result.illustrative).toBe(true);
  });

  it("no preparation needed counts as zero, not as unknown", () => {
    expect(calculateEnvironment({ ...inputs, processing: "none" }).lifecycle?.proposedKg).toBe(115.5);
  });
});

describe("NT-L2-008 missing baseline or factor, inconsistent units", () => {
  it("without a baseline there is no comparative result at all", () => {
    const result = calculateEnvironment({ ...inputs, existing: null });
    expect(result.lifecycle).toBeNull();
    expect(result.transport).toBeNull();
    expect(result.status).toBe("incomplete");
    expect(result.missing).toContain("baseline");
    // the displacement itself is still shown – it is not a CO₂e claim
    expect(result.displacementKg).toBe(360);
  });

  it("a missing factor prevents the lifecycle claim; transport-only stays separate", () => {
    const result = calculateEnvironment({ ...inputs, virginProduction: null });
    expect(result.lifecycle).toBeNull();
    expect(result.status).toBe("transport_only");
    expect(result.missing).toContain("factor.virginProduction");
  });

  it("an unknown preparation is not zero", () => {
    expect(calculateEnvironment({ ...inputs, processing: null }).missing).toContain("factor.processing");
  });

  it("a factor with the wrong unit or boundary is a validation error", () => {
    expect(environmentProblems({ ...inputs, virginProduction: truck })).toContainEqual({ field: "virginProduction", code: "FACTOR_MISMATCH" });
    expect(environmentProblems({ ...inputs, existing: { treatment: virgin, distanceKm: 20 } })).toContainEqual({ field: "existingTreatment", code: "FACTOR_MISMATCH" });
    expect(slotAccepts("transport", truck)).toBe(true);
  });

  it("a quantity in items cannot be assessed", () => {
    const result = calculateEnvironment({ ...inputs, unit: ITEM });
    expect(result.problems).toContainEqual({ field: "unitKey", code: "UNIT_NOT_MASS" });
    expect(result.lifecycle).toBeNull();
  });
});
