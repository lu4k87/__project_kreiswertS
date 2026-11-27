import { describe, expect, it } from "vitest";
import { PRICE_MODES } from "./listing";
import { amountRule, payerOf, pricePerKg, storedAmount } from "./price";
import type { Unit } from "./units";

const kg: Unit = { key: "kg", dimension: "mass", toBase: 1 };
const t: Unit = { key: "t", dimension: "mass", toBase: 1000 };
const item: Unit = { key: "item", dimension: "count", toBase: 1 };

describe("price convention (L1-008, D06)", () => {
  it("fixed and paid recovery need an amount, negotiable may have one, quotation and free have none", () => {
    expect(PRICE_MODES.map(amountRule)).toEqual(["required", "optional", "none", "none", "required"]);
  });

  it("NT-L1-008: a quotation stays without a number, free is an explicit 0", () => {
    expect(storedAmount("quotation", 12)).toBeNull();
    expect(storedAmount("quotation", null)).toBeNull();
    expect(storedAmount("free", null)).toBe(0);
    expect(storedAmount("free", 99)).toBe(0);
    expect(storedAmount("fixed", 400)).toBe(400);
  });

  it("AT-L1-008: for a paid recovery the offerer pays; otherwise the requester", () => {
    expect(payerOf("paid_recovery")).toBe("offerer");
    expect(payerOf("fixed")).toBe("requester");
    expect(payerOf("negotiable")).toBe("requester");
    expect(payerOf("free")).toBeNull();
    expect(payerOf("quotation")).toBeNull();
  });

  it("shows the price per kg only for another mass unit, never for items, never for 'no amount'", () => {
    expect(pricePerKg(400, t, kg)).toBe(0.4);
    expect(pricePerKg(0.4, kg, kg)).toBeNull();
    expect(pricePerKg(5, item, kg)).toBeNull();
    expect(pricePerKg(null, t, kg)).toBeNull();
    expect(pricePerKg(0, t, kg)).toBeNull();
  });
});
