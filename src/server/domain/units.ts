// Units and conversion (L1-007, L1-008): only units of the same dimension are converted. The unit list itself is
// reference data (table `units`); this module holds the rules. Pure → also used in the browser.

export const UNIT_DIMENSIONS = ["mass", "count", "volume", "area"] as const;
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number];

export type Unit = { key: string; dimension: UnitDimension; toBase: number };

/** True when both units measure the same thing (kg and t), false for kg and item. */
export function comparable(a: Unit, b: Unit): boolean {
  return a.dimension === b.dimension;
}

/** Converts a quantity; null when the dimensions differ – never a silent conversion across dimensions. */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number | null {
  if (!comparable(from, to)) return null;
  return round((quantity * from.toBase) / to.toBase);
}

/** Quantity in the base unit of its dimension (kg for mass). */
export function toBaseQuantity(quantity: number, unit: Unit): number {
  return round(quantity * unit.toBase);
}

/** Price per `to` unit from a price per `from` unit (€400/t → €0.40/kg); null across dimensions (per item → per kg). */
export function convertPrice(amount: number, from: Unit, to: Unit): number | null {
  if (!comparable(from, to)) return null;
  return round((amount / from.toBase) * to.toBase);
}

/** Float noise off (0.1 + 0.2), six decimals are enough for quantities and prices. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
