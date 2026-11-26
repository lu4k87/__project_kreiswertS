import { describe, expect, it } from "vitest";
import { enquiryInput, offerInput, offerSearchQuery, offerUpdate } from "./offers";

describe("offerSearchQuery (L1-013, L1-014)", () => {
  it("defaults to the local search with the standard radius and limit", () => {
    expect(offerSearchQuery.parse({})).toEqual({ scope: "park", radiusKm: 25, limit: 50 });
  });

  it("treats empty fields of a GET form like missing ones", () => {
    expect(offerSearchQuery.parse({ typeId: "", origin: "", delivery: "", minQuantityKg: "", scope: "" })).toEqual({ scope: "park", radiusKm: 25, limit: 50 });
  });

  it("converts query strings", () => {
    expect(offerSearchQuery.parse({ scope: "radius", radiusKm: "50", typeId: "3", minQuantityKg: "100", delivery: "collection" })).toMatchObject({
      scope: "radius",
      radiusKm: 50,
      typeId: 3,
      minQuantityKg: 100,
      delivery: "collection",
    });
  });

  it("rejects values outside the lists", () => {
    for (const bad of [{ scope: "world" }, { radiusKm: "7" }, { typeId: "-1" }, { origin: "moon" }, { limit: "1000" }, { minQuantityKg: "0" }]) {
      expect(offerSearchQuery.safeParse(bad).success).toBe(false);
    }
  });
});

const minimal = { title: "HDPE offcuts" };

describe("offerInput (L1-005, X-02)", () => {
  it("a draft needs only a title; everything else becomes null or its default", () => {
    const parsed = offerInput.parse(minimal);
    expect(parsed).toMatchObject({ title: "HDPE offcuts", quantity: null, unitKey: null, priceMode: null, deliveryOptions: [], attributes: {}, validityDays: 30 });
  });

  it("drops fields the server sets itself", () => {
    const parsed = offerInput.parse({ ...minimal, siteId: 99, status: "active", provenance: "self_declared", payer: "requester", revision: 7 });
    for (const field of ["siteId", "status", "provenance", "payer", "revision"]) expect(parsed).not.toHaveProperty(field);
  });

  it("NT-L1-005: rejects a negative or zero quantity", () => {
    expect(offerInput.safeParse({ ...minimal, quantity: -5 }).success).toBe(false);
    expect(offerInput.safeParse({ ...minimal, quantity: 0 }).success).toBe(false);
    expect(offerInput.parse({ ...minimal, quantity: 300 }).quantity).toBe(300);
  });

  it("rounds quantities to 3 and prices to 2 decimals", () => {
    const parsed = offerInput.parse({ ...minimal, quantity: 1.23456, priceAmount: 0.405 });
    expect(parsed.quantity).toBe(1.235);
    expect(parsed.priceAmount).toBe(0.41);
  });

  it("keeps an explicit price of 0 apart from 'no price'", () => {
    expect(offerInput.parse({ ...minimal, priceAmount: 0 }).priceAmount).toBe(0);
    expect(offerInput.parse({ ...minimal, priceAmount: null }).priceAmount).toBeNull();
    expect(offerInput.parse({ ...minimal, priceAmount: "" }).priceAmount).toBeNull();
  });

  it("rejects numbers sent as text, unknown list values and a delivery term given twice", () => {
    expect(offerInput.safeParse({ ...minimal, quantity: "300" }).success).toBe(false);
    expect(offerInput.safeParse({ ...minimal, priceMode: "auction" }).success).toBe(false);
    expect(offerInput.safeParse({ ...minimal, origin: "moon" }).success).toBe(false);
    const twice = [{ term: "exw", namedPlace: "A" }, { term: "exw", namedPlace: "B" }];
    expect(offerInput.safeParse({ ...minimal, deliveryOptions: twice }).success).toBe(false);
  });

  it("rejects control and invisible characters in the title, allows line breaks in the description", () => {
    expect(offerInput.safeParse({ title: "HDPE\u0000" }).success).toBe(false);
    expect(offerInput.safeParse({ title: "HDPE\u202eKO" }).success).toBe(false);
    expect(offerInput.safeParse({ title: "HDPE\nKO" }).success).toBe(false);
    expect(offerInput.parse({ ...minimal, description: "Line one\nLine two" }).description).toBe("Line one\nLine two");
    expect(offerInput.safeParse({ ...minimal, description: "x\u0000y" }).success).toBe(false);
  });

  it("review 2026-11-26: rejects every invisible format character, not only a list (zero-width joiner, soft hyphen, BOM)", () => {
    for (const code of [0x200c, 0x200d, 0x200e, 0x200f, 0x061c, 0xfeff, 0x00ad, 0x2028]) {
      expect(offerInput.safeParse({ title: `Muster${String.fromCodePoint(code)}plast` }).success, code.toString(16)).toBe(false);
    }
    expect(offerInput.safeParse({ ...minimal, description: `x${String.fromCodePoint(0x200d)}y` }).success).toBe(false);
  });

  it("review 2026-11-26: limits the number of attribute keys (a body of thousands of empty keys bloated the history)", () => {
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, {}]));
    expect(offerInput.safeParse({ ...minimal, attributes: many(100) }).success).toBe(true);
    expect(offerInput.safeParse({ ...minimal, attributes: many(101) }).success).toBe(false);
  });

  it("rejects an impossible date and a validity outside 1–90 days", () => {
    expect(offerInput.safeParse({ ...minimal, availableFrom: "2026-02-30" }).success).toBe(false);
    expect(offerInput.safeParse({ ...minimal, validityDays: 0 }).success).toBe(false);
    expect(offerInput.safeParse({ ...minimal, validityDays: 91 }).success).toBe(false);
  });
});

describe("offerUpdate (L1-011)", () => {
  it("requires the revision the browser loaded", () => {
    expect(offerUpdate.safeParse(minimal).success).toBe(false);
    expect(offerUpdate.parse({ ...minimal, expectedRevision: 2 }).expectedRevision).toBe(2);
  });
});

describe("enquiryInput (L1-017)", () => {
  it("needs a topic from the list and a real message", () => {
    expect(enquiryInput.parse({ topic: "sample", message: "Are metal inserts left in the offcuts?" }).topic).toBe("sample");
    expect(enquiryInput.safeParse({ topic: "sample", message: "hi" }).success).toBe(false);
    expect(enquiryInput.safeParse({ topic: "chat", message: "Is Friday pickup possible?" }).success).toBe(false);
    expect(enquiryInput.safeParse({ topic: "sample", message: "x".repeat(2001) }).success).toBe(false);
  });
});
