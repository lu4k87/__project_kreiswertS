import { describe, expect, it } from "vitest";
import { comparable, convertPrice, convertQuantity, toBaseQuantity, type Unit } from "./units";

const kg: Unit = { key: "kg", dimension: "mass", toBase: 1 };
const t: Unit = { key: "t", dimension: "mass", toBase: 1000 };
const item: Unit = { key: "item", dimension: "count", toBase: 1 };
const m3: Unit = { key: "m3", dimension: "volume", toBase: 1 };

describe("units (L1-007)", () => {
  it("converts kg and t into each other", () => {
    expect(convertQuantity(1.2, t, kg)).toBe(1200);
    expect(convertQuantity(300, kg, t)).toBe(0.3);
    expect(toBaseQuantity(2, t)).toBe(2000);
  });

  it("never converts across dimensions: mass, count and volume stay apart", () => {
    expect(comparable(kg, item)).toBe(false);
    expect(convertQuantity(10, item, kg)).toBeNull();
    expect(convertQuantity(10, m3, t)).toBeNull();
  });

  it("returns exact decimals instead of float noise", () => {
    expect(convertQuantity(0.1 + 0.2, kg, kg)).toBe(0.3);
  });
});

describe("price conversion (AT-L1-008)", () => {
  it("€400/t equals €0.40/kg", () => {
    expect(convertPrice(400, t, kg)).toBe(0.4);
    expect(convertPrice(0.4, kg, t)).toBe(400);
  });

  it("an item price is not converted to a mass price", () => {
    expect(convertPrice(5, item, kg)).toBeNull();
  });
});
