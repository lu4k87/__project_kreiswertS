import { describe, expect, it } from "vitest";
import { calculateFeasibility, feasibilityProblems, weakestStatus, type PrivateInputs, type SharedInputs } from "./feasibility";
import type { Unit } from "./units";

const KG: Unit = { key: "kg", dimension: "mass", toBase: 1 };
const T: Unit = { key: "t", dimension: "mass", toBase: 1000 };
const ITEM: Unit = { key: "item", dimension: "count", toBase: 1 };

// AT-L2-007: 500 kg at €200 (€400/t), €80 extra freight shared equally
const shared: SharedInputs = {
  quantity: 500,
  unit: KG,
  paymentDirection: "requester_pays",
  priceAmount: 400,
  priceUnit: T,
  priceStatus: "quoted",
  priceIncludesFreight: false,
  freight: { amount: 80, status: "estimated", payer: "shared", offererSharePercent: 50 },
};
const none: PrivateInputs = { yieldPercent: 100, costs: [], baseline: null };

describe("AT-L2-007 delivered cost and net proceeds", () => {
  it("splits shared freight: offerer €160, requester €240 before other costs", () => {
    const result = calculateFeasibility(shared, none, "requester");
    expect(result.problems).toEqual([]);
    expect(result.materialPayment).toBe(200);
    expect(result.freight).toEqual({ total: 80, offerer: 40, requester: 40 });
    expect(result.offererNetProceeds).toBe(160);
    expect(result.requesterDeliveredCost).toBe(240);
  });

  it("gives the same two numbers to both sides, built from shared inputs only", () => {
    const offerer = calculateFeasibility(shared, none, "offerer");
    expect(offerer.offererNetProceeds).toBe(160);
    expect(offerer.requesterDeliveredCost).toBe(240);
    expect(offerer.own.beforeCosts).toBe(160);
  });

  it("converts the price unit: €0.40/kg is the same as €400/t", () => {
    const result = calculateFeasibility({ ...shared, priceAmount: 0.4, priceUnit: KG }, none, "requester");
    expect(result.requesterDeliveredCost).toBe(240);
  });

  it("paid recovery turns the payment around", () => {
    const result = calculateFeasibility({ ...shared, paymentDirection: "offerer_pays", freight: null }, none, "offerer");
    expect(result.offererNetProceeds).toBe(-200);
    expect(result.requesterDeliveredCost).toBe(-200);
  });

  it("adds own costs, yield and baseline, and finds the break-even for a positive contribution", () => {
    // requester: €240 + €30 testing (fixed) + €0.10/kg grinding = €320 for 450 usable kg; virgin costs €1.20/kg
    const own: PrivateInputs = {
      yieldPercent: 90,
      costs: [
        { label: "Testing", basis: "fixed", amount: 30, status: "quoted" },
        { label: "Grinding", basis: "variable", amount: 0.1, status: "estimated" },
      ],
      baseline: { rate: 1.2, status: "confirmed" },
    };
    const result = calculateFeasibility(shared, own, "requester").own;
    expect(result.total).toBe(320);
    expect(result.usableQuantity).toBe(450);
    expect(result.perUsableUnit).toBe(0.71);
    expect(result.baseline).toBe(540);
    expect(result.contribution).toBe(220);
    // fixed = 30 + 40 freight = 70; margin per kg = (220 + 70) / 500 = 0.58 → 120.69 kg
    expect(result.breakEven).toEqual({ kind: "quantity", quantity: 120.69 });
    expect(result.status).toBe("estimated");
    expect(result.missing).toEqual([]);
  });

  it("weakest status wins", () => {
    expect(weakestStatus(["confirmed", "quoted"])).toBe("quoted");
    expect(weakestStatus([])).toBeNull();
  });
});

describe("NT-L2-007 double freight, unknowns and no break-even", () => {
  it("rejects extra freight on a price that already includes delivery", () => {
    const problems = feasibilityProblems({ ...shared, priceIncludesFreight: true }, none);
    expect(problems).toContainEqual({ field: "freight", code: "FREIGHT_ALREADY_INCLUDED" });
    // and the freight is never counted a second time
    const result = calculateFeasibility({ ...shared, priceIncludesFreight: true }, none, "requester");
    expect(result.freight).toBeNull();
    expect(result.requesterDeliveredCost).toBe(200);
  });

  it("gives no break-even for a negative contribution", () => {
    const own: PrivateInputs = { yieldPercent: 100, costs: [], baseline: { rate: 0.3, status: "estimated" } };
    const result = calculateFeasibility(shared, own, "requester").own;
    expect(result.contribution).toBe(-90);
    expect(result.breakEven).toEqual({ kind: "none" });
  });

  it("gives no break-even for a contribution of exactly zero", () => {
    const own: PrivateInputs = { yieldPercent: 100, costs: [], baseline: { rate: 0.48, status: "estimated" } };
    expect(calculateFeasibility(shared, own, "requester").own.breakEven).toEqual({ kind: "none" });
  });

  it("keeps unknowns unknown: no price, no freight amount, no cost amount → no totals", () => {
    const unknownPrice = calculateFeasibility({ ...shared, priceAmount: null }, none, "requester");
    expect(unknownPrice.requesterDeliveredCost).toBeNull();
    expect(unknownPrice.own.missing).toContain("price");
    const unknownFreight = calculateFeasibility({ ...shared, freight: { ...shared.freight!, amount: null } }, none, "offerer");
    expect(unknownFreight.offererNetProceeds).toBeNull();
    const unknownCost = calculateFeasibility(shared, { ...none, costs: [{ label: "Testing", basis: "fixed", amount: null, status: "estimated" }] }, "requester");
    expect(unknownCost.own.total).toBeNull();
    expect(unknownCost.own.breakEven).toEqual({ kind: "unknown" });
  });

  it("gives no total on incompatible bases (price per item, quantity in kg)", () => {
    const result = calculateFeasibility({ ...shared, priceUnit: ITEM }, none, "requester");
    expect(result.materialPayment).toBeNull();
    expect(result.own.missing).toContain("priceBasis");
  });

  it("without a baseline there is no contribution and no break-even", () => {
    const result = calculateFeasibility(shared, none, "offerer").own;
    expect(result.contribution).toBeNull();
    expect(result.breakEven).toEqual({ kind: "unknown" });
    expect(result.missing).toContain("baseline");
  });

  it("a shared freight needs the offerer's share", () => {
    expect(feasibilityProblems({ ...shared, freight: { ...shared.freight!, offererSharePercent: null } }, none)).toContainEqual({ field: "freight.offererSharePercent", code: "REQUIRED" });
  });
});
