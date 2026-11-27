// Rules of a material request (L2-001, L2-004) – named after the test register (AT-L2-001, NT-L2-001).
import { describe, expect, it } from "vitest";
import { ALUMINIUM, HDPE, METALS, PLASTICS, PP, REGRIND, SHEET, testCatalogue } from "../testing/catalogue";
import { criteriaDefinitions, requestProblems, type RequestFields } from "./request-rules";

const TODAY = "2026-11-27";

const complete: RequestFields = {
  title: "HDPE regrind, monthly",
  description: "For injection moulding of transport boxes.",
  categoryId: PLASTICS,
  typeIds: [HDPE],
  formIds: [REGRIND],
  origins: [],
  quantity: 500,
  unitKey: "kg",
  minLot: 200,
  frequency: "recurring",
  recurrencePeriod: "monthly",
  neededFrom: null,
  neededUntil: null,
  maxPriceAmount: 400,
  maxPriceUnitKey: "t",
  deliveryTerms: ["dap"],
  evidenceStatus: null,
  sampleRequired: false,
  criteria: { contamination: { kind: "required", valueMin: null, valueMax: 2, valueText: null } },
};

const codes = (fields: RequestFields, mode: "draft" | "publish" = "publish") =>
  requestProblems(fields, testCatalogue, mode, TODAY).map((problem) => `${problem.field}:${problem.code}`);

describe("requestProblems", () => {
  it("AT-L2-001: a complete request without any reference to an offer can be published", () => {
    expect(codes(complete)).toEqual([]);
  });

  it("NT-L2-001: missing type criterion or a type of another category is refused", () => {
    expect(codes({ ...complete, typeIds: [] })).toContain("typeIds:REQUIRED");
    expect(codes({ ...complete, typeIds: [ALUMINIUM] }, "draft")).toContain("typeIds:INVALID_COMBINATION");
    expect(codes({ ...complete, formIds: [] })).toContain("formIds:REQUIRED");
  });

  it("a draft needs only valid parts; publishing needs the rest", () => {
    const draft: RequestFields = { ...complete, description: null, typeIds: [], formIds: [], quantity: null, unitKey: null, minLot: null, frequency: null, criteria: {} };
    expect(codes(draft, "draft")).toEqual([]);
    expect(codes(draft)).toEqual(expect.arrayContaining(["description:REQUIRED", "quantity:REQUIRED", "unitKey:REQUIRED", "frequency:REQUIRED"]));
  });

  it("a disabled category, an unpermitted unit and a lot above the need are refused", () => {
    expect(codes({ ...complete, categoryId: METALS, typeIds: [], formIds: [] })).toContain("categoryId:CATEGORY_DISABLED");
    expect(codes({ ...complete, unitKey: "m3" })).toContain("unitKey:UNIT_NOT_PERMITTED");
    expect(codes({ ...complete, minLot: 600 })).toContain("minLot:MIN_LOT_EXCEEDS_NEED");
  });

  it("dates: the end before the start, and a past end when publishing", () => {
    expect(codes({ ...complete, neededFrom: "2026-12-10", neededUntil: "2026-12-01" })).toContain("neededUntil:DATE_ORDER");
    expect(codes({ ...complete, neededUntil: "2026-11-01" })).toContain("neededUntil:DATE_PAST");
    expect(codes({ ...complete, neededUntil: "2026-11-01" }, "draft")).toEqual([]);
  });

  it("a price ceiling needs a permitted unit", () => {
    expect(codes({ ...complete, maxPriceUnitKey: null })).toContain("maxPriceUnitKey:REQUIRED");
    expect(codes({ ...complete, maxPriceUnitKey: "m3" })).toContain("maxPriceUnitKey:UNIT_NOT_PERMITTED");
  });

  it("criteria: only attributes of an accepted form, each with a valid value", () => {
    expect(codes({ ...complete, criteria: { thickness: { kind: "required", valueMin: 3, valueMax: 6, valueText: null } } })).toContain("criteria.thickness:NOT_APPLICABLE");
    expect(codes({ ...complete, formIds: [SHEET], criteria: { thickness: { kind: "required", valueMin: 3, valueMax: 6, valueText: null } } })).toEqual([]);
    expect(codes({ ...complete, criteria: { contamination: { kind: "required", valueMin: 5, valueMax: 2, valueText: null } } })).toContain("criteria.contamination:RANGE_ORDER");
    expect(codes({ ...complete, criteria: { contamination: { kind: "required", valueMin: null, valueMax: 120, valueText: null } } })).toContain("criteria.contamination:OUT_OF_RANGE");
    expect(codes({ ...complete, criteria: { contamination: { kind: "required", valueMin: null, valueMax: null, valueText: null } } })).toContain("criteria.contamination:REQUIRED");
    expect(codes({ ...complete, criteria: { grade: { kind: "preferred", valueMin: null, valueMax: null, valueText: "  " } } })).toContain("criteria.grade:REQUIRED");
  });

  it("several accepted types of the same category are fine", () => {
    expect(codes({ ...complete, typeIds: [HDPE, PP] })).toEqual([]);
  });
});

describe("criteriaDefinitions", () => {
  it("offers the attributes of every accepted form, never the test conditions of an offer", () => {
    const keys = criteriaDefinitions(testCatalogue.attributes, PLASTICS, ["regrind"]).map((definition) => definition.key);
    expect(keys).toEqual(["grade", "contamination", "melt_flow_rate", "particle_size"]);
    expect(criteriaDefinitions(testCatalogue.attributes, null, ["regrind"])).toEqual([]);
  });
});
