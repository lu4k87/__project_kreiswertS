import { describe, expect, it } from "vitest";
import {
  applicableAttributes,
  attributeProblems,
  criticalUnknowns,
  formatAttributeValue,
  incompatibleKeys,
  isUnknown,
  type AttributeValue,
} from "./attributes";
import { METALS, PLASTICS, testCatalogue } from "../testing/catalogue";

const { attributes } = testCatalogue;
const value = (partial: Partial<AttributeValue>): AttributeValue => ({ valueMin: null, valueMax: null, comparator: null, valueText: null, ...partial });
const keys = (list: { key: string }[]) => list.map((definition) => definition.key);
const sheet = applicableAttributes(attributes, PLASTICS, "sheet");
const regrind = applicableAttributes(attributes, PLASTICS, "regrind");
const definition = (key: string) => attributes.find((candidate) => candidate.key === key && candidate.categoryId === PLASTICS)!;

describe("applicable attributes (AT-L1-006)", () => {
  it("switching from sheets to regrind: sheet fields disappear, regrind fields appear", () => {
    expect(keys(sheet)).toEqual(["grade", "contamination", "thickness"]);
    expect(keys(regrind)).toEqual(["grade", "contamination", "melt_flow_rate", "mfr_test_conditions", "particle_size"]);
  });

  it("another category brings its own attributes without any plastics field", () => {
    expect(keys(applicableAttributes(attributes, METALS, "sheet"))).toEqual(["alloy"]);
  });

  it("nothing applies until category and form are chosen", () => {
    expect(applicableAttributes(attributes, null, "sheet")).toEqual([]);
    expect(applicableAttributes(attributes, PLASTICS, null)).toEqual([]);
  });

  it("names the entered values a form change would drop, and ignores empty ones", () => {
    const values = { thickness: value({ valueMin: 3, valueMax: 6 }), grade: value({ valueText: "PE 100" }), particle_size: value({}) };
    expect(incompatibleKeys(regrind, values)).toEqual(["thickness"]);
    expect(incompatibleKeys(sheet, values)).toEqual([]);
  });
});

describe("unknown is not zero (NT-L1-006)", () => {
  it("an explicit 0 is a value, an empty entry is unknown", () => {
    expect(isUnknown(value({ valueMin: 0 }))).toBe(false);
    expect(isUnknown(value({}))).toBe(true);
    expect(isUnknown(value({ valueText: "   " }))).toBe(true);
    expect(isUnknown(undefined)).toBe(true);
  });

  it("AT-L1-016: a missing grade and a missing MFR stay visible as critical unknowns", () => {
    expect(keys(criticalUnknowns(regrind, { particle_size: value({ valueMin: 3, valueMax: 6 }) }))).toEqual(["grade", "melt_flow_rate"]);
    expect(keys(criticalUnknowns(regrind, { grade: value({ valueText: "PE 100" }), melt_flow_rate: value({ valueMin: 0 }) }))).toEqual([]);
  });
});

describe("attribute validation (NT-L1-006)", () => {
  const codes = (values: Record<string, AttributeValue>, applicable = regrind) => attributeProblems(applicable, values, true).map((problem) => `${problem.field}:${problem.code}`);

  it("accepts valid values of every data type", () => {
    const film = applicableAttributes(attributes, PLASTICS, "film");
    expect(
      attributeProblems(
        film,
        {
          contamination: value({ valueMin: 1, comparator: "lt" }),
          layer_structure: value({ valueText: "multilayer" }),
          unit_count: value({ valueMin: 12 }),
          grade: value({ valueText: "LDPE transparent" }),
        },
        true,
      ),
    ).toEqual([]);
  });

  it("rejects an attribute that does not apply to the form", () => {
    expect(codes({ thickness: value({ valueMin: 3 }) })).toEqual(["attributes.thickness:NOT_APPLICABLE"]);
  });

  it("rejects values outside the configured limits", () => {
    expect(codes({ contamination: value({ valueMin: 101 }) })).toEqual(["attributes.contamination:OUT_OF_RANGE"]);
    expect(codes({ contamination: value({ valueMin: -1 }) })).toEqual(["attributes.contamination:OUT_OF_RANGE"]);
    expect(codes({ particle_size: value({ valueMin: 3, valueMax: -2 }) })).toContain("attributes.particle_size:RANGE_ORDER");
  });

  it("rejects a reversed range, an unknown enum value and a fraction where a count is expected", () => {
    const film = applicableAttributes(attributes, PLASTICS, "film");
    expect(codes({ particle_size: value({ valueMin: 6, valueMax: 3 }) })).toEqual(["attributes.particle_size:RANGE_ORDER"]);
    expect(codes({ layer_structure: value({ valueText: "triple" }) }, film)).toEqual(["attributes.layer_structure:INVALID_OPTION"]);
    expect(codes({ unit_count: value({ valueMin: 2.5 }) }, film)).toEqual(["attributes.unit_count:NOT_INTEGER"]);
  });

  it("rejects a value in the wrong field: text for a number, a comparator for a range", () => {
    expect(codes({ contamination: value({ valueText: "low" }) })).toEqual(["attributes.contamination:INVALID"]);
    expect(codes({ particle_size: value({ valueMin: 3, comparator: "lt" }) })).toEqual(["attributes.particle_size:INVALID"]);
    expect(codes({ grade: value({ valueText: "ok", valueMin: 1 }) })).toEqual(["attributes.grade:INVALID"]);
  });

  it("a melt flow rate needs its test conditions – in a draft too", () => {
    const withoutConditions = { melt_flow_rate: value({ valueMin: 0.8 }) };
    expect(attributeProblems(regrind, withoutConditions, false)).toEqual([{ field: "attributes.mfr_test_conditions", code: "REQUIRED_WITH" }]);
    expect(attributeProblems(regrind, { ...withoutConditions, mfr_test_conditions: value({ valueText: "190 °C / 2.16 kg" }) }, true)).toEqual([]);
  });

  it("empty optional attributes are no problem", () => {
    expect(attributeProblems(regrind, {}, true)).toEqual([]);
  });
});

describe("formatAttributeValue", () => {
  it("writes ranges, comparators and units, with number and unit kept together", () => {
    expect(formatAttributeValue(definition("particle_size"), value({ valueMin: 3, valueMax: 6 }), "en")).toBe("3–6\u00a0mm");
    expect(formatAttributeValue(definition("contamination"), value({ valueMin: 1, comparator: "lt" }), "en")).toBe("<\u00a01\u00a0%");
    expect(formatAttributeValue(definition("melt_flow_rate"), value({ valueMin: 0.8 }), "de")).toBe("0,8\u00a0g/10\u00a0min"); // a unit with a space never breaks
    expect(formatAttributeValue(definition("contamination"), value({ valueMin: 0 }), "en")).toBe("0\u00a0%");
  });

  it("shows the label of an enum in the UI language and plain text as it is", () => {
    expect(formatAttributeValue(definition("layer_structure"), value({ valueText: "multilayer" }), "de")).toBe("Mehrschichtig");
    expect(formatAttributeValue(definition("grade"), value({ valueText: "PE 100" }), "en")).toBe("PE 100");
  });
});
