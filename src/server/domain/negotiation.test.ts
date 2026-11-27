import { describe, expect, it } from "vitest";
import {
  changedTerms,
  countsAsVerifiedOutcome,
  effectiveNegotiationStatus,
  exchangeActions,
  incotermsVersionOf,
  negotiationActions,
  termProblems,
  type Terms,
} from "./negotiation";

const terms: Terms = {
  quantity: 500,
  unitKey: "kg",
  paymentDirection: "requester_pays",
  priceAmount: 200,
  priceUnitKey: "t",
  vatBasis: "net",
  deliveryTerm: "fca",
  namedPlace: "Werk D, Moers",
  transportOrganiser: "requester",
  freightAmount: 80,
  freightCostStatus: "estimated",
  freightPayer: "shared",
  offererSharePercent: 50,
  deliveryFrom: "2026-12-01",
  deliveryUntil: "2026-12-15",
  technicalConditions: "Moisture below 0.2 %",
};
const units = ["kg", "t"];
const today = "2026-11-27";
const codes = (changed: Partial<Terms>) => termProblems({ ...terms, ...changed }, units, today).map((p) => `${p.field}:${p.code}`);

describe("changedTerms (AT-L2-006)", () => {
  it("names exactly the terms a counterproposal changed", () => {
    expect(changedTerms(terms, { ...terms, quantity: 400, priceAmount: 180 })).toEqual(["quantity", "priceAmount"]);
  });
  it("an unchanged copy changes nothing; null and missing are the same", () => {
    expect(changedTerms(terms, { ...terms })).toEqual([]);
    expect(changedTerms({ ...terms, technicalConditions: null }, { ...terms, technicalConditions: null })).toEqual([]);
  });
});

describe("termProblems", () => {
  it("complete terms pass", () => {
    expect(codes({})).toEqual([]);
  });
  it("a price needs an amount and a unit unless nothing is paid", () => {
    expect(codes({ priceAmount: null, priceUnitKey: null })).toEqual(["priceAmount:REQUIRED", "priceUnitKey:REQUIRED"]);
    expect(codes({ paymentDirection: "no_payment", priceAmount: null, priceUnitKey: null })).toEqual([]);
    expect(codes({ paymentDirection: "no_payment" })).toEqual(["priceAmount:NOT_APPLICABLE"]);
  });
  it("units must be permitted for the category", () => {
    expect(codes({ unitKey: "m3", priceUnitKey: "m3" })).toEqual(["unitKey:UNIT_NOT_PERMITTED", "priceUnitKey:UNIT_NOT_PERMITTED"]);
  });
  it("D07: a formal term names its place; a custom arrangement is described", () => {
    expect(codes({ namedPlace: null })).toEqual(["namedPlace:NAMED_PLACE_REQUIRED"]);
    expect(codes({ deliveryTerm: "custom", namedPlace: null })).toEqual(["namedPlace:NAMED_PLACE_REQUIRED"]);
    expect(incotermsVersionOf("fca")).toBe("2020");
    expect(incotermsVersionOf("custom")).toBeNull();
  });
  it("freight needs its cost status and payer; a share only with shared freight (D07, D17)", () => {
    expect(codes({ freightCostStatus: null, freightPayer: null, offererSharePercent: null })).toEqual(["freightCostStatus:REQUIRED", "freightPayer:REQUIRED"]);
    expect(codes({ offererSharePercent: null })).toEqual(["offererSharePercent:REQUIRED"]);
    expect(codes({ freightPayer: "requester" })).toEqual(["offererSharePercent:NOT_APPLICABLE"]);
  });
  it("delivery window: not in the past, end not before start", () => {
    expect(codes({ deliveryFrom: "2026-11-01" })).toEqual(["deliveryFrom:DATE_PAST"]);
    expect(codes({ deliveryFrom: "2026-12-20" })).toEqual(["deliveryUntil:DATE_ORDER"]);
  });
});

describe("negotiation rules (D16, NT-L2-006)", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  it("an open negotiation whose current proposal ran out is expired", () => {
    expect(effectiveNegotiationStatus("open", new Date("2026-11-27T11:59:59Z"), now)).toBe("expired");
    expect(effectiveNegotiationStatus("open", new Date("2026-11-28T00:00:00Z"), now)).toBe("open");
    expect(effectiveNegotiationStatus("agreed", new Date("2026-11-01T00:00:00Z"), now)).toBe("agreed");
  });
  it("only the counterpart accepts, declines or counters; the author can only withdraw", () => {
    expect(negotiationActions("open", false)).toEqual(["accept", "counter", "decline"]);
    expect(negotiationActions("open", true)).toEqual(["withdraw"]);
  });
  it("an expired proposal cannot be accepted, only replaced or ended", () => {
    expect(negotiationActions("expired", false)).not.toContain("accept");
    expect(negotiationActions("expired", true)).toEqual(["repropose", "withdraw"]);
  });
  it("an agreement locks the terms", () => {
    for (const status of ["agreed", "declined", "withdrawn"] as const) expect(negotiationActions(status, false)).toEqual([]);
  });
});

describe("exchange rules (L2-011, D13)", () => {
  it("only the receiver records receipt and completion", () => {
    expect(exchangeActions("planned", true)).toEqual(["update", "complete", "cancel"]);
    expect(exchangeActions("planned", false)).toEqual(["update", "cancel"]);
    expect(exchangeActions("completed", true)).toEqual([]);
  });
  it("AT-L2-011: a simulated completion never counts as a verified outcome", () => {
    expect(countsAsVerifiedOutcome({ status: "completed", simulated: true, qualityResult: "accepted", receivedQuantity: 100 })).toBe(false);
    expect(countsAsVerifiedOutcome({ status: "completed", simulated: false, qualityResult: "accepted", receivedQuantity: 100 })).toBe(true);
  });
  it("a completion without received material is no outcome (security review 2026-11-27)", () => {
    expect(countsAsVerifiedOutcome({ status: "completed", simulated: false, qualityResult: "accepted", receivedQuantity: 0 })).toBe(false);
  });
  it("cancelled, planned or rejected material is no outcome", () => {
    expect(countsAsVerifiedOutcome({ status: "cancelled", simulated: false, qualityResult: null, receivedQuantity: null })).toBe(false);
    expect(countsAsVerifiedOutcome({ status: "planned", simulated: false, qualityResult: null, receivedQuantity: null })).toBe(false);
    expect(countsAsVerifiedOutcome({ status: "completed", simulated: false, qualityResult: "rejected", receivedQuantity: 100 })).toBe(false);
  });
});
