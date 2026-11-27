import { describe, expect, it } from "vitest";
import { IDEMPOTENCY_KEY, paymentActions, paymentAmount, paymentRef, type PaymentTerms } from "./payment";
import type { Unit } from "./units";

const kg: Unit = { key: "kg", dimension: "mass", toBase: 1 };
const t: Unit = { key: "t", dimension: "mass", toBase: 1000 };
const item: Unit = { key: "item", dimension: "count", toBase: 1 };

const terms: PaymentTerms = {
  quantity: 500,
  paymentDirection: "requester_pays",
  priceAmount: 400,
  vatBasis: "net",
  transportOrganiser: "requester",
  freightAmount: null,
  freightPayer: null,
  offererSharePercent: null,
};

describe("payment amount from the accepted terms", () => {
  it("500 kg at €400/t: the requester pays the offerer €200", () => {
    const amount = paymentAmount(terms, kg, t);
    expect(amount).toMatchObject({ payer: "requester", payee: "offerer", amountCents: 20000, vatBasis: "net", missing: [] });
    expect(amount.lines).toEqual([{ kind: "material", from: "requester", to: "offerer", cents: 20000 }]);
  });

  it("adds the freight share the other site owes the organiser (requester organises, €80 shared equally)", () => {
    const amount = paymentAmount({ ...terms, freightAmount: 80, freightPayer: "shared", offererSharePercent: 50 }, kg, t);
    // requester owes €200 for the material, the offerer owes the requester €40 of the freight → net €160
    expect(amount.lines).toContainEqual({ kind: "freight", from: "offerer", to: "requester", cents: 4000 });
    expect(amount).toMatchObject({ payer: "requester", amountCents: 16000 });
  });

  it("the payment can flow the other way when the freight share is larger than the price", () => {
    const amount = paymentAmount({ ...terms, quantity: 150, priceAmount: 120, freightAmount: 80, freightPayer: "shared", offererSharePercent: 50 }, kg, t);
    // €18 for the material against €40 freight share → the offerer pays €22
    expect(amount).toMatchObject({ payer: "offerer", payee: "requester", amountCents: 2200 });
  });

  it("paid recovery: the offerer pays; the organiser's own freight share stays with the organiser", () => {
    const amount = paymentAmount({ ...terms, paymentDirection: "offerer_pays", transportOrganiser: "offerer", freightAmount: 100, freightPayer: "offerer" }, kg, t);
    expect(amount.lines).toEqual([{ kind: "material", from: "offerer", to: "requester", cents: 20000 }]);
    expect(amount).toMatchObject({ payer: "offerer", amountCents: 20000 });
  });

  it("a third-party carrier is paid by the sites directly – not part of the payment", () => {
    const amount = paymentAmount({ ...terms, transportOrganiser: "third_party", freightAmount: 80, freightPayer: "requester" }, kg, t);
    expect(amount).toMatchObject({ amountCents: 20000, freightOutside: true });
  });

  it("nothing to pay: free material without freight between the sites", () => {
    expect(paymentAmount({ ...terms, paymentDirection: "no_payment", priceAmount: null }, kg, null)).toMatchObject({ payer: null, amountCents: 0 });
  });

  it("a price per item on a quantity in kg gives no amount – never a wrong one", () => {
    expect(paymentAmount(terms, kg, item)).toMatchObject({ amountCents: null, payer: null, missing: ["priceBasis"] });
    expect(paymentAmount({ ...terms, priceAmount: null }, kg, t)).toMatchObject({ amountCents: null, missing: ["price"] });
  });

  it("rounds to whole cents", () => {
    expect(paymentAmount({ ...terms, quantity: 333, priceAmount: 0.333 }, kg, kg).amountCents).toBe(11089);
  });
});

describe("who may do what with a payment", () => {
  it("only the payer authorises (simulated checkout) or cancels a pending payment", () => {
    expect(paymentActions("pending", "payer", false)).toEqual(["authorise", "fail", "cancel"]);
    expect(paymentActions("pending", "payee", true)).toEqual([]);
  });
  it("capture needs the delivery; the payer may cancel only before it", () => {
    expect(paymentActions("authorised", "payer", false)).toEqual(["cancel"]);
    expect(paymentActions("authorised", "payee", false)).toEqual([]);
    // security review 2026-11-27 (CWE-841): once the receipt is recorded the payer can no longer pull the money back
    expect(paymentActions("authorised", "payer", true)).toEqual(["capture"]);
    expect(paymentActions("authorised", "payee", true)).toEqual(["capture"]);
  });
  it("the site that recorded the receipt cannot also take the money as payee (CWE-841)", () => {
    expect(paymentActions("authorised", "payee", true, true)).toEqual([]);
    expect(paymentActions("authorised", "payer", true, true)).toEqual(["capture"]);
  });
  it("only the payee refunds captured money; final states allow nothing", () => {
    expect(paymentActions("captured", "payee", true)).toEqual(["refund"]);
    expect(paymentActions("captured", "payer", true)).toEqual([]);
    for (const status of ["failed", "cancelled", "refunded"] as const) expect(paymentActions(status, "payer", true)).toEqual([]);
  });
  it("references and idempotency keys", () => {
    expect(paymentRef(7)).toBe("PM-000007");
    expect(IDEMPOTENCY_KEY.test("0f8c2d1e-9b7a-4c3d-8e2f-1a2b3c4d5e6f")).toBe(true);
    expect(IDEMPOTENCY_KEY.test("short")).toBe(false);
    expect(IDEMPOTENCY_KEY.test("x".repeat(20) + "'; drop")).toBe(false);
  });
});
