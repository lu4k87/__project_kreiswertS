import { describe, expect, it } from "vitest";
import { aggregateOffers, type AggregationOffer } from "./aggregation";
import type { Unit } from "./units";

const UNITS: Unit[] = [
  { key: "kg", dimension: "mass", toBase: 1 },
  { key: "t", dimension: "mass", toBase: 1000 },
  { key: "item", dimension: "count", toBase: 1 },
];
const PE = { id: 1, key: "hdpe" };
const PP = { id: 2, key: "pp" };
const MIXED = { id: 9, key: "mixed" };
const SHEET = { id: 10, key: "sheet" };
const REGRIND = { id: 11, key: "regrind" };

let nextId = 1;
const offer = (patch: Partial<AggregationOffer> = {}): AggregationOffer => ({
  id: nextId++,
  status: "active",
  type: PE,
  form: SHEET,
  origin: "pre_consumer",
  quantity: 100,
  unitKey: "kg",
  frequency: "one_time",
  recurrencePeriod: null,
  recurrenceQuantity: null,
  site: { id: 1 },
  ...patch,
});

describe("aggregateOffers (L2-010)", () => {
  it("AT-L2-010: two compatible batches of 200 kg and 400 kg are 600 kg; closing one leaves 400 kg; PP stays out", () => {
    const small = offer({ quantity: 200, site: { id: 1 } });
    const large = offer({ quantity: 400, site: { id: 2 } });
    const pp = offer({ type: PP, quantity: 300, site: { id: 3 } });
    const before = aggregateOffers([small, large, pp], UNITS);
    const pe = before.groups.find((group) => group.typeId === PE.id)!;
    expect(pe.currentKg).toBe(600);
    expect(pe.offerIds).toEqual([small.id, large.id]);
    expect(pe.siteIds).toEqual([1, 2]);
    expect(pe.offerIds).not.toContain(pp.id);

    const after = aggregateOffers([{ ...small, status: "closed" }, large, pp], UNITS);
    expect(after.groups.find((group) => group.typeId === PE.id)!.currentKg).toBe(400);
  });

  it("converts tonnes and keeps another form in its own group", () => {
    const result = aggregateOffers([offer({ quantity: 0.5, unitKey: "t" }), offer({ quantity: 250 }), offer({ form: REGRIND, quantity: 90 })], UNITS);
    expect(result.groups.map((group) => [group.key, group.currentKg])).toEqual([
      ["1-10", 750],
      ["1-11", 90],
    ]);
  });

  it("NT-L2-010: a duplicate counts once, expired and closed drop out, recurring supply is not added to the stock", () => {
    const batch = offer({ quantity: 200 });
    const recurring = offer({ quantity: 300, frequency: "recurring", recurrencePeriod: "monthly", recurrenceQuantity: 1, unitKey: "t" });
    const result = aggregateOffers([batch, batch, recurring, offer({ status: "expired" }), offer({ status: "closed" }), offer({ status: "draft" })], UNITS);
    const [group] = result.groups;
    expect(result.groups).toHaveLength(1);
    expect(group.offerIds).toEqual([batch.id, recurring.id]);
    expect(group.currentKg).toBe(200 + 300_000);
    expect(group.recurringKg).toEqual({ monthly: 1000 });
  });

  it("never groups mixed material and never sums a batch without a mass", () => {
    const items = offer({ quantity: 40, unitKey: "item" });
    const unknownQuantity = offer({ quantity: null, origin: null });
    const result = aggregateOffers([offer({ type: MIXED }), offer({ form: { id: 12, key: "mixed" } }), offer({ quantity: 50 }), items, unknownQuantity], UNITS);
    expect(result.excluded).toBe(2);
    const [group] = result.groups;
    expect(group.currentKg).toBe(50);
    expect(group.notComparable).toEqual([items.id, unknownQuantity.id]);
    expect(group.origins).toEqual({ pre_consumer: 2, unknown: 1 });
  });

  it("lists the largest group first", () => {
    const result = aggregateOffers([offer({ type: PP }), offer(), offer()], UNITS);
    expect(result.groups.map((group) => group.typeId)).toEqual([PE.id, PP.id]);
  });
});
