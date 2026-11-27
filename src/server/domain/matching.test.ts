// Explained matching (L2-005, D15) – named after the test register (AT-L2-005, NT-L2-005).
import { describe, expect, it } from "vitest";
import { PLASTICS, testCatalogue } from "../testing/catalogue";
import { attributeOutcome, evaluateMatch, processingSteps, type MatchOffer, type MatchRequest } from "./matching";
import { formatCriterion } from "../../components/requests/format-request";

/** Site C needs HDPE regrind, at least 200 kg of 500 kg, contamination at most 2 % required. */
const request: MatchRequest = {
  categoryId: PLASTICS,
  typeKeys: ["hdpe"],
  formKeys: ["regrind"],
  origins: [],
  quantity: 500,
  unitKey: "kg",
  minLot: 200,
  frequency: "one_time",
  neededFrom: null,
  neededUntil: null,
  maxPriceAmount: null,
  maxPriceUnitKey: null,
  deliveryTerms: [],
  evidenceStatus: null,
  sampleRequired: false,
  criteria: { contamination: { kind: "required", valueMin: null, valueMax: 2, valueText: null } },
};

/** 0.3 t of HDPE regrind with "< 1 %" contamination. */
const offer: MatchOffer = {
  categoryId: PLASTICS,
  typeKey: "hdpe",
  formKey: "regrind",
  origin: "pre_consumer",
  quantity: 0.3,
  unitKey: "t",
  minLot: null,
  frequency: "one_time",
  availableFrom: "2026-11-27",
  collectionUntil: null,
  priceMode: "fixed",
  priceAmount: 300,
  priceUnitKey: "t",
  deliveryTerms: ["fca"],
  evidenceStatus: "self_declared",
  sampleAvailable: "yes",
  attributes: { contamination: { valueMin: 1, valueMax: null, comparator: "lt", valueText: null } },
};

const outcome = (result: ReturnType<typeof evaluateMatch>, key: string) => result.checks.find((check) => check.key === key)?.outcome;

describe("evaluateMatch", () => {
  it("compatible on declared data when every requirement is met (t converted to kg)", () => {
    const result = evaluateMatch(request, offer, testCatalogue);
    expect(result.result).toBe("compatible");
    expect(outcome(result, "quantity")).toBe("met");
    expect(outcome(result, "attributes.contamination")).toBe("met");
  });

  it("AT-L2-005: a PP-only request rejects HDPE", () => {
    const result = evaluateMatch({ ...request, typeKeys: ["pp"] }, offer, testCatalogue);
    expect(result.result).toBe("incompatible");
    expect(outcome(result, "type")).toBe("failed");
  });

  it("AT-L2-005: an unknown mandatory grade gives a conditional result, not a match", () => {
    const withGrade = { ...request, criteria: { ...request.criteria, grade: { kind: "required" as const, valueMin: null, valueMax: null, valueText: "HDPE 5502" } } };
    const result = evaluateMatch(withGrade, offer, testCatalogue);
    expect(result.result).toBe("conditional");
    expect(outcome(result, "attributes.grade")).toBe("unknown");
  });

  it("AT-L2-005: a processing-required result names the missing preparation step", () => {
    const result = evaluateMatch(request, { ...offer, formKey: "sheet", attributes: {} , quantity: 300, unitKey: "kg" }, testCatalogue);
    // sheet → regrind by grinding; contamination unknown keeps it from being "compatible", but processing ranks first
    expect(result.result).toBe("processing_required");
    expect(result.steps).toEqual(["grinding"]);
  });

  it("NT-L2-005: a known incompatible polymer is rejected even when every preference is met", () => {
    const result = evaluateMatch({ ...request, typeKeys: ["pp"], deliveryTerms: ["fca"], maxPriceAmount: 500, maxPriceUnitKey: "t" }, offer, testCatalogue);
    expect(result.result).toBe("incompatible");
    expect(result.checks.filter((check) => !check.hard).every((check) => check.outcome === "met")).toBe(true);
  });

  it("NT-L2-005: a preference never overrides a failed requirement, and a failed preference never fails the match", () => {
    const preferred = { ...request, criteria: { contamination: { kind: "preferred" as const, valueMin: null, valueMax: 0.5, valueText: null } } };
    const result = evaluateMatch(preferred, offer, testCatalogue);
    expect(outcome(result, "attributes.contamination")).toBe("unknown"); // "< 1 %" may or may not be below 0.5 %
    expect(result.result).toBe("compatible");
    const tooHigh = evaluateMatch(preferred, { ...offer, attributes: { contamination: { valueMin: 3, valueMax: null, comparator: null, valueText: null } } }, testCatalogue);
    expect(outcome(tooHigh, "attributes.contamination")).toBe("failed");
    expect(tooHigh.result).toBe("compatible");
  });

  it("NT-L2-005: unknown required dimensions are conditional, not compatible", () => {
    const sheets = { ...request, formKeys: ["sheet"], criteria: { thickness: { kind: "required" as const, valueMin: 3, valueMax: 6, valueText: null } } };
    const result = evaluateMatch(sheets, { ...offer, formKey: "sheet", attributes: {} }, testCatalogue);
    expect(result.result).toBe("conditional");
  });

  it("a batch below the smallest accepted lot fails; another dimension stays unknown", () => {
    expect(outcome(evaluateMatch(request, { ...offer, quantity: 80, unitKey: "kg" }, testCatalogue), "quantity")).toBe("failed");
    expect(outcome(evaluateMatch(request, { ...offer, quantity: 10, unitKey: "item" }, testCatalogue), "quantity")).toBe("unknown");
  });

  it("an offerer's minimum lot above the need fails", () => {
    expect(outcome(evaluateMatch(request, { ...offer, quantity: 2, minLot: 1, unitKey: "t" }, testCatalogue), "minLot")).toBe("failed");
  });

  it("timing: a batch available only after the requested date fails", () => {
    const result = evaluateMatch({ ...request, neededUntil: "2026-11-20" }, offer, testCatalogue);
    expect(outcome(result, "timing")).toBe("failed");
  });

  it("weaker evidence and an unknown sample keep the result conditional; a refused sample fails", () => {
    expect(evaluateMatch({ ...request, evidenceStatus: "tested" }, offer, testCatalogue).result).toBe("conditional");
    expect(evaluateMatch({ ...request, sampleRequired: true }, { ...offer, sampleAvailable: "unknown" }, testCatalogue).result).toBe("conditional");
    expect(evaluateMatch({ ...request, sampleRequired: true }, { ...offer, sampleAvailable: "no" }, testCatalogue).result).toBe("incompatible");
  });

  it("price ceiling compares in the request's unit; free material is always below it; on enquiry is unknown", () => {
    const ceiling = { ...request, maxPriceAmount: 0.25, maxPriceUnitKey: "kg" };
    expect(outcome(evaluateMatch(ceiling, offer, testCatalogue), "price")).toBe("failed"); // €300/t = €0.30/kg
    expect(outcome(evaluateMatch(ceiling, { ...offer, priceMode: "free", priceAmount: 0 }, testCatalogue), "price")).toBe("met");
    expect(outcome(evaluateMatch(ceiling, { ...offer, priceMode: "quotation", priceAmount: null }, testCatalogue), "price")).toBe("unknown");
  });

  it("mixed plastics need sorting first; an unidentified polymer is unknown", () => {
    expect(evaluateMatch(request, { ...offer, typeKey: "mixed" }, testCatalogue).steps).toEqual(["sorting"]);
    expect(outcome(evaluateMatch(request, { ...offer, typeKey: "unknown" }, testCatalogue), "type")).toBe("unknown");
  });

  it("another category is always incompatible", () => {
    expect(evaluateMatch(request, { ...offer, categoryId: 2 }, testCatalogue).result).toBe("incompatible");
  });
});

describe("processingSteps", () => {
  it("finds the shortest documented route and none where there is no route", () => {
    expect(processingSteps("sheet", ["regrind"])).toEqual(["grinding"]);
    expect(processingSteps("sheet", ["granulate"])).toEqual(["grinding", "regranulation"]);
    expect(processingSteps("granulate", ["sheet"])).toBeNull();
    expect(processingSteps("regrind", ["regrind"])).toBeNull(); // the same form needs no step
  });
});

describe("attributeOutcome", () => {
  const enumDefinition = testCatalogue.attributes.find((definition) => definition.key === "layer_structure")!;
  const textDefinition = testCatalogue.attributes.find((definition) => definition.key === "grade")!;
  it("enum: equal value met, other value failed", () => {
    const criterion = { kind: "required" as const, valueMin: null, valueMax: null, valueText: "single" };
    expect(attributeOutcome(enumDefinition, criterion, { valueMin: null, valueMax: null, comparator: null, valueText: "single" })).toBe("met");
    expect(attributeOutcome(enumDefinition, criterion, { valueMin: null, valueMax: null, comparator: null, valueText: "multilayer" })).toBe("failed");
  });
  it("text: a match ignoring case is met, free text that differs stays open for review", () => {
    const criterion = { kind: "required" as const, valueMin: null, valueMax: null, valueText: "pc klar" };
    expect(attributeOutcome(textDefinition, criterion, { valueMin: null, valueMax: null, comparator: null, valueText: "PC klar, extrudiert" })).toBe("met");
    expect(attributeOutcome(textDefinition, criterion, { valueMin: null, valueMax: null, comparator: null, valueText: "Makrolon" })).toBe("unknown");
  });
});

describe("formatCriterion", () => {
  it("keeps number and unit together, also inside a unit like g/10 min", () => {
    const mfr = testCatalogue.attributes.find((definition) => definition.key === "melt_flow_rate")!;
    expect(formatCriterion(mfr, { kind: "preferred", valueMin: 0.5, valueMax: 8, valueText: null }, "de")).toBe("0,5–8\u00a0g/10\u00a0min");
    expect(formatCriterion(mfr, { kind: "required", valueMin: null, valueMax: 2, valueText: null }, "en")).toBe("≤\u00a02\u00a0g/10\u00a0min");
  });
});
