// Price convention (L1-008, D06): which amount a mode needs and who pays. Pure → also used in the browser.
import type { Payer, PriceMode } from "./listing";
import { convertPrice, type Unit } from "./units";

/** fixed + paid recovery need an amount > 0; negotiable may carry an indicative one; quotation and free have none to enter. */
export function amountRule(mode: PriceMode): "required" | "optional" | "none" {
  if (mode === "fixed" || mode === "paid_recovery") return "required";
  return mode === "negotiable" ? "optional" : "none";
}

/** Payment direction is set by the server from the mode: for a paid recovery the offerer pays. */
export function payerOf(mode: PriceMode): Payer | null {
  if (mode === "paid_recovery") return "offerer";
  return mode === "fixed" || mode === "negotiable" ? "requester" : null;
}

/** Stored amount: free is an explicit 0, a quotation has no number at all (never 0). */
export function storedAmount(mode: PriceMode, amount: number | null): number | null {
  if (mode === "free") return 0;
  if (mode === "quotation") return null;
  return amount;
}

/**
 * Equivalent price per kilogram for mass units other than kg (€400/t → €0.40/kg). null when there is no
 * amount, the unit is already kg, or the unit is not a mass (an item price is never turned into a mass price).
 */
export function pricePerKg(amount: number | null, unit: Unit | null, kg: Unit | null): number | null {
  if (amount == null || amount === 0 || !unit || !kg || unit.key === kg.key) return null;
  return convertPrice(amount, unit, kg);
}
