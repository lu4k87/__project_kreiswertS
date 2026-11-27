// Delivery arrangements (L1-009, D07): who loads, transports and unloads. Plain-language responsibilities,
// not a legal certification. Pure → also used in the browser.
import type { DeliveryTerm } from "./listing";

export type Party = "offerer" | "requester";
/** null = by arrangement (custom collection or recovery – deliberately not an Incoterm). */
export type Responsibilities = { loading: Party | null; transport: Party | null; unloading: Party | null };

export const RESPONSIBILITIES: Readonly<Record<DeliveryTerm, Responsibilities>> = {
  exw: { loading: "requester", transport: "requester", unloading: "requester" },
  fca: { loading: "offerer", transport: "requester", unloading: "requester" },
  dap: { loading: "offerer", transport: "offerer", unloading: "requester" },
  dpu: { loading: "offerer", transport: "offerer", unloading: "offerer" },
  custom: { loading: null, transport: null, unloading: null },
};

/** Version stored with a formal term. */
export const INCOTERMS_VERSION = "2020";

/** Formal terms need a named place and a version; "custom" is free text and never labelled as an Incoterm. */
export function isFormalTerm(term: DeliveryTerm): boolean {
  return term !== "custom";
}

export type DeliveryMode = "collection" | "delivered";

/** The requester fetches the material (EXW, FCA, custom) or the offerer brings it (DAP, DPU). */
export function deliveryMode(term: DeliveryTerm): DeliveryMode {
  return RESPONSIBILITIES[term].transport === "offerer" ? "delivered" : "collection";
}

/** Search filter: a collection-only batch does not appear under "delivered by the offerer". */
export function offersMode(terms: readonly DeliveryTerm[], mode: DeliveryMode): boolean {
  return terms.some((term) => deliveryMode(term) === mode);
}
