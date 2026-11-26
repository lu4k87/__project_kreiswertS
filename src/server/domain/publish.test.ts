import { describe, expect, it } from "vitest";
import { offerProblems, type OfferFields } from "./publish";
import { ALUMINIUM, HDPE, METALS, METAL_SHEET, PLASTICS, REGRIND, SHEET, testCatalogue } from "../testing/catalogue";

const TODAY = "2026-11-26";

/** Scenario 1: 300 kg of sorted HDPE sheet offcuts, one-off, price on enquiry, collection. */
const complete: OfferFields = {
  title: "HDPE sheet offcuts",
  description: "Sorted offcuts from production.",
  categoryId: PLASTICS,
  typeId: HDPE,
  formId: SHEET,
  origin: "pre_consumer",
  legalStatus: "by_product",
  quantity: 300,
  unitKey: "kg",
  minLot: null,
  frequency: "one_time",
  recurrencePeriod: null,
  availableFrom: "2026-11-26",
  collectionUntil: "2026-11-27",
  priceMode: "quotation",
  priceAmount: null,
  priceUnitKey: null,
  deliveryOptions: [{ term: "exw", namedPlace: "Werk A, Kamp-Lintfort", customNote: null }],
  deliveryPricing: null,
  evidenceStatus: "self_declared",
  attributes: {},
};

const publish = (changes: Partial<OfferFields>) => offerProblems({ ...complete, ...changes }, testCatalogue, "publish", TODAY).map((p) => `${p.field}:${p.code}`);
const draft = (changes: Partial<OfferFields>) => offerProblems({ ...complete, ...changes }, testCatalogue, "draft", TODAY).map((p) => `${p.field}:${p.code}`);

describe("publishing an offer (L1-005)", () => {
  it("AT-L1-005: 300 kg of HDPE offcuts under Plastics can be published", () => {
    expect(publish({})).toEqual([]);
  });

  it("AT-L1-005: a missing unit blocks publication with a field error", () => {
    expect(publish({ unitKey: null })).toEqual(["unitKey:REQUIRED"]);
  });

  it("AT-L1-005: a disabled category blocks publication, but may be drafted", () => {
    const metal = { categoryId: METALS, typeId: ALUMINIUM, formId: METAL_SHEET };
    expect(publish(metal)).toEqual(["categoryId:CATEGORY_DISABLED"]);
    expect(draft(metal)).toEqual([]);
  });

  it("NT-L1-005: an unsupported unit is rejected in a draft already", () => {
    expect(draft({ unitKey: "m3" })).toEqual(["unitKey:UNIT_NOT_PERMITTED"]);
    expect(draft({ unitKey: "litre" })).toEqual(["unitKey:INVALID"]);
  });

  it("a draft may be incomplete: only what is entered must be valid", () => {
    const empty: OfferFields = { ...complete, description: null, categoryId: null, typeId: null, formId: null, origin: null, legalStatus: null,
      quantity: null, unitKey: null, frequency: null, availableFrom: null, collectionUntil: null, priceMode: null, deliveryOptions: [], evidenceStatus: null };
    expect(offerProblems(empty, testCatalogue, "draft", TODAY)).toEqual([]);
    expect(offerProblems(empty, testCatalogue, "publish", TODAY).map((p) => p.field)).toEqual(
      expect.arrayContaining(["description", "categoryId", "typeId", "formId", "origin", "legalStatus", "quantity", "unitKey", "frequency", "availableFrom", "priceMode", "deliveryOptions", "evidenceStatus"]),
    );
  });

  it("type and form must belong to the chosen category", () => {
    expect(draft({ typeId: ALUMINIUM })).toEqual(["typeId:INVALID_COMBINATION"]);
    expect(draft({ formId: METAL_SHEET })).toEqual(["formId:INVALID_COMBINATION"]);
    expect(draft({ categoryId: 999 })).toEqual(expect.arrayContaining(["categoryId:INVALID"]));
  });
});

describe("availability (L1-007)", () => {
  it("NT-L1-007: a minimum lot above the current stock is not publishable", () => {
    expect(publish({ minLot: 301 })).toEqual(["minLot:MIN_LOT_EXCEEDS_STOCK"]);
    expect(publish({ minLot: 300 })).toEqual([]);
  });

  it("a recurring supply needs its period", () => {
    expect(publish({ frequency: "recurring" })).toEqual(["recurrencePeriod:REQUIRED"]);
    expect(publish({ frequency: "recurring", recurrencePeriod: "monthly" })).toEqual([]);
  });

  it("the collection deadline is neither before the start nor in the past", () => {
    expect(publish({ collectionUntil: "2026-11-25" })).toEqual(["collectionUntil:DATE_ORDER"]);
    expect(publish({ availableFrom: "2026-11-01", collectionUntil: "2026-11-20" })).toEqual(["collectionUntil:DATE_PAST"]);
  });
});

describe("price (L1-008)", () => {
  it("a fixed price needs a positive amount and a permitted unit", () => {
    expect(publish({ priceMode: "fixed" })).toEqual(["priceAmount:REQUIRED"]);
    expect(publish({ priceMode: "fixed", priceAmount: 0, priceUnitKey: "t" })).toEqual(["priceAmount:POSITIVE"]);
    expect(publish({ priceMode: "fixed", priceAmount: 400 })).toEqual(["priceUnitKey:REQUIRED"]);
    expect(publish({ priceMode: "fixed", priceAmount: 400, priceUnitKey: "m3" })).toEqual(["priceUnitKey:UNIT_NOT_PERMITTED"]);
    expect(publish({ priceMode: "fixed", priceAmount: 400, priceUnitKey: "t" })).toEqual([]);
  });

  it("a paid recovery needs the fee; free and quotation need no amount", () => {
    expect(publish({ priceMode: "paid_recovery" })).toEqual(["priceAmount:REQUIRED"]);
    expect(publish({ priceMode: "free" })).toEqual([]);
    expect(publish({ priceMode: "negotiable" })).toEqual([]);
  });

  it("an amount left over from another mode is ignored for free and quotation", () => {
    expect(publish({ priceMode: "quotation", priceAmount: 0, priceUnitKey: "m3" })).toEqual([]);
  });
});

describe("delivery (L1-009)", () => {
  it("needs at least one accepted arrangement", () => {
    expect(publish({ deliveryOptions: [] })).toEqual(["deliveryOptions:REQUIRED"]);
  });

  it("NT-L1-009: formal FCA without a named place is rejected", () => {
    expect(publish({ deliveryOptions: [{ term: "fca", namedPlace: null, customNote: null }] })).toEqual(["deliveryOptions.fca.namedPlace:NAMED_PLACE_REQUIRED"]);
  });

  it("a custom arrangement is described instead of naming an Incoterm place", () => {
    expect(publish({ deliveryOptions: [{ term: "custom", namedPlace: null, customNote: null }] })).toEqual(["deliveryOptions.custom.customNote:REQUIRED"]);
    expect(publish({ deliveryOptions: [{ term: "custom", namedPlace: null, customNote: "Collection by arrangement." }] })).toEqual([]);
  });

  it("delivery by the offerer needs to say how the delivery is priced", () => {
    const dap = [{ term: "dap" as const, namedPlace: "Moers", customNote: null }];
    expect(publish({ deliveryOptions: dap })).toEqual(["deliveryPricing:REQUIRED"]);
    expect(publish({ deliveryOptions: dap, deliveryPricing: "quotation" })).toEqual([]);
  });
});

describe("technical attributes inside an offer (L1-006)", () => {
  it("scenario 3: HDPE regrind with a known particle size and no melt flow data is publishable", () => {
    expect(publish({ formId: REGRIND, attributes: { particle_size: { valueMin: 3, valueMax: 6, comparator: null, valueText: null } } })).toEqual([]);
  });

  it("values of another form are rejected", () => {
    expect(draft({ formId: REGRIND, attributes: { thickness: { valueMin: 3, valueMax: 6, comparator: null, valueText: null } } })).toEqual(["attributes.thickness:NOT_APPLICABLE"]);
  });
});
