// Feedstock volume aggregation (L2-010, D19): groups compatible, available batches of one search into potential
// collection groups. Only a potential total is shown – nothing is reserved, booked or routed.
// Pure → tested on its own (aggregation.test.ts).
//
// Rules:
// - compatible = same material type and the same form (HDPE sheet with HDPE sheet; PP never joins a PE group);
//   "mixed" types or forms are never grouped (unknown composition is not approved feedstock)
// - only active listings; closed and expired ones drop out; one offer is counted once, however often it is passed
// - current stock and recurring supply stay apart: the expected quantity per period is never added to the stock
// - only masses are summed (in kg); a batch in items, m³ or without a quantity is listed as "not comparable"
import type { Origin, RecurrencePeriod } from "./listing";
import { toBaseQuantity, type Unit } from "./units";

type Ref = { id: number; key: string } | null;

export type AggregationOffer = {
  id: number;
  status: string;
  type: Ref;
  form: Ref;
  origin: string | null;
  quantity: number | null;
  unitKey: string | null;
  frequency: string | null;
  recurrencePeriod: string | null;
  recurrenceQuantity: number | null;
  site: { id: number };
};

export type CollectionGroup = {
  /** `<typeId>-<formId>`, stable within one catalogue. */
  key: string;
  typeId: number;
  formId: number;
  offerIds: number[];
  siteIds: number[];
  /** Sum of the current stock in kg of the comparable batches. */
  currentKg: number;
  /** Expected recurring supply in kg per period – never part of currentKg. */
  recurringKg: Partial<Record<RecurrencePeriod, number>>;
  /** Batches without a mass (items, volume, no quantity): in the group, not in the totals. */
  notComparable: number[];
  /** Number of batches per declared origin; "unknown" collects missing and unknown origins (D19: flagged). */
  origins: Partial<Record<Origin, number>>;
};

export type Aggregation = {
  groups: CollectionGroup[];
  /** Active batches left out because type or form is mixed or missing. */
  excluded: number;
};

const MIXED = "mixed";

export function aggregateOffers(offers: AggregationOffer[], units: Unit[]): Aggregation {
  const unitByKey = new Map(units.map((unit) => [unit.key, unit]));
  const groups = new Map<string, CollectionGroup>();
  const seen = new Set<number>();
  let excluded = 0;

  for (const offer of offers) {
    if (seen.has(offer.id) || offer.status !== "active") continue;
    seen.add(offer.id);
    if (!offer.type || !offer.form || offer.type.key === MIXED || offer.form.key === MIXED) {
      excluded += 1;
      continue;
    }
    const key = `${offer.type.id}-${offer.form.id}`;
    const group = groups.get(key) ?? { key, typeId: offer.type.id, formId: offer.form.id, offerIds: [], siteIds: [], currentKg: 0, recurringKg: {}, notComparable: [], origins: {} };
    groups.set(key, group);
    group.offerIds.push(offer.id);
    if (!group.siteIds.includes(offer.site.id)) group.siteIds.push(offer.site.id);
    const origin: Origin = offer.origin === "pre_consumer" || offer.origin === "post_consumer" || offer.origin === MIXED ? offer.origin : "unknown";
    group.origins[origin] = (group.origins[origin] ?? 0) + 1;

    const unit = offer.unitKey ? unitByKey.get(offer.unitKey) : undefined;
    if (!unit || unit.dimension !== "mass" || offer.quantity === null) {
      group.notComparable.push(offer.id);
      continue;
    }
    group.currentKg = round(group.currentKg + toBaseQuantity(offer.quantity, unit));
    const period = offer.recurrencePeriod as RecurrencePeriod | null;
    if (offer.frequency === "recurring" && period && offer.recurrenceQuantity !== null) {
      group.recurringKg[period] = round((group.recurringKg[period] ?? 0) + toBaseQuantity(offer.recurrenceQuantity, unit));
    }
  }

  // Largest potential first; ties by key so the order is stable between two loads.
  const sorted = [...groups.values()].sort((a, b) => b.offerIds.length - a.offerIds.length || b.currentKg - a.currentKg || a.key.localeCompare(b.key));
  return { groups: sorted, excluded };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
