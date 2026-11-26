import { describe, expect, it } from "vitest";
import { HDPE, PLASTICS, REGRIND, SHEET, testCatalogue } from "@/server/testing/catalogue";
import { offerInput } from "@/server/validation/offers";
import { checkForm, fromInput, newOfferInput, parseDecimal, toBody, type FormState } from "./offer-form-state";

const TODAY = "2026-11-26";
const blank = (): FormState => fromInput(newOfferInput(testCatalogue, TODAY), true);
const filled = (changes: Partial<FormState> = {}): FormState => ({
  ...blank(),
  title: "HDPE regrind",
  description: "Regrind from production offcuts.",
  typeId: String(HDPE),
  formId: String(REGRIND),
  origin: "pre_consumer",
  legalStatus: "by_product",
  quantity: "500",
  unitKey: "kg",
  priceMode: "fixed",
  priceAmount: "400",
  priceUnitKey: "t",
  evidenceStatus: "self_declared",
  delivery: { ...blank().delivery, fca: { on: true, namedPlace: "Standort B, Moers", customNote: "" } },
  ...changes,
});
const fields = (state: FormState, mode: "draft" | "publish" = "publish") => {
  const result = checkForm(state, testCatalogue, mode, TODAY);
  return result.ok ? [] : result.problems.map((problem) => `${problem.field}:${problem.code}`);
};

describe("parseDecimal", () => {
  it("reads a decimal point and a decimal comma, and keeps an explicit 0", () => {
    expect(parseDecimal("0,4")).toBe(0.4);
    expect(parseDecimal(" 300 ")).toBe(300);
    expect(parseDecimal("0")).toBe(0);
  });

  it("empty is unknown (null), text is not a number (NaN) – neither becomes 0", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("  ")).toBeNull();
    expect(parseDecimal("ca. 300")).toBeNaN();
    expect(parseDecimal("1.234,5")).toBeNaN();
  });
});

describe("offer form state", () => {
  it("a new offer starts with the enabled category, today's date and an empty title", () => {
    const state = blank();
    expect(state).toMatchObject({ title: "", categoryId: String(PLASTICS), availableFrom: TODAY, frequency: "one_time", validityDays: "30" });
  });

  it("survives the round trip input → form → body → input", () => {
    const input = offerInput.parse({
      title: "HDPE regrind",
      categoryId: PLASTICS,
      typeId: HDPE,
      formId: REGRIND,
      quantity: 500,
      unitKey: "kg",
      frequency: "recurring",
      recurrencePeriod: "monthly",
      recurrenceQuantity: 500,
      priceMode: "fixed",
      priceAmount: 400,
      priceUnitKey: "t",
      deliveryOptions: [{ term: "fca", namedPlace: "Standort B, Moers" }, { term: "custom", customNote: "By arrangement" }],
      attributes: { particle_size: { valueMin: 3, valueMax: 6 }, contamination: { valueMin: 0, comparator: "lte" } },
    });
    const { body, problems } = toBody(fromInput(input), testCatalogue);
    expect(problems).toEqual([]);
    expect(offerInput.parse(body)).toEqual(input);
  });

  it("scenario 3 passes the publish check in the browser", () => {
    expect(fields(filled({ attributes: { particle_size: { min: "3", max: "6", comparator: "", text: "" } } }))).toEqual([]);
  });

  it("reports text in a number field at that field instead of sending 0", () => {
    expect(fields(filled({ quantity: "viel" }))).toEqual(["quantity:INVALID_NUMBER"]);
    expect(fields(filled({ attributes: { contamination: { min: "wenig", max: "", comparator: "", text: "" } } }))).toEqual(["attributes.contamination:INVALID_NUMBER"]);
  });

  it("leaves unknown attributes out of the body – an empty field is never stored as 0", () => {
    const { body } = toBody(filled({ attributes: { contamination: { min: "", max: "", comparator: "lt", text: "" }, grade: { min: "", max: "", comparator: "", text: "  " } } }), testCatalogue);
    expect(body.attributes).toEqual({});
  });

  it("keeps an explicit 0 as a value", () => {
    const { body } = toBody(filled({ attributes: { contamination: { min: "0", max: "", comparator: "", text: "" } } }), testCatalogue);
    expect(body.attributes).toEqual({ contamination: { valueMin: 0, valueMax: null, comparator: null, valueText: null } });
  });

  it("AT-L1-006: after switching from regrind to sheets the regrind values are not sent", () => {
    const state = filled({ formId: String(SHEET), attributes: { particle_size: { min: "3", max: "6", comparator: "", text: "" }, thickness: { min: "8", max: "12", comparator: "", text: "" } } });
    expect(Object.keys(toBody(state, testCatalogue).body.attributes as object)).toEqual(["thickness"]);
  });

  it("drops the amount when the price mode has none (quotation never carries a number)", () => {
    const { body } = toBody(filled({ priceMode: "quotation", priceAmount: "400" }), testCatalogue);
    expect(body).toMatchObject({ priceAmount: null, priceUnitKey: null });
  });

  it("names the delivery arrangement whose place is missing", () => {
    const state = filled({ delivery: { ...blank().delivery, exw: { on: true, namedPlace: "Site", customNote: "" }, fca: { on: true, namedPlace: "", customNote: "" } } });
    expect(fields(state)).toEqual(["deliveryOptions.fca.namedPlace:NAMED_PLACE_REQUIRED"]);
  });

  it("a draft needs a title and nothing else", () => {
    expect(fields(blank(), "draft")).toEqual(["title:REQUIRED"]);
    expect(fields({ ...blank(), title: "PP offcuts" }, "draft")).toEqual([]);
  });
});
