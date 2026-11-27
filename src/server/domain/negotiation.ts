// Negotiations and exchanges (L2-006, L2-011, D07, D13, D16): value lists, term rules, who may do what, and which
// records count as a verified outcome. Pure → tested on its own (negotiation.test.ts) and used by the forms.
import { INCOTERMS_VERSION, isFormalTerm } from "./delivery";
import type { DeliveryTerm, VatBasis } from "./listing";

/** Version stored with a revision: "2020" for a formal term, null for a custom arrangement (never an Incoterm). */
export function incotermsVersionOf(term: DeliveryTerm): string | null {
  return isFormalTerm(term) ? INCOTERMS_VERSION : null;
}

/** Who pays whom for the material; "no_payment" = handed over free of charge. */
export const PAYMENT_DIRECTIONS = ["requester_pays", "offerer_pays", "no_payment"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

/** Who books the transport. */
export const TRANSPORT_ORGANISERS = ["offerer", "requester", "third_party"] as const;
export type TransportOrganiser = (typeof TRANSPORT_ORGANISERS)[number];

/** Who bears the freight; "shared" needs the offerer's share in percent (cost sharing agreed explicitly, D07). */
export const FREIGHT_PAYERS = ["offerer", "requester", "shared"] as const;
export type FreightPayer = (typeof FREIGHT_PAYERS)[number];

/** How certain a cost is (D17): an estimate, a carrier's quotation, or confirmed. */
export const COST_STATUSES = ["estimated", "quoted", "confirmed"] as const;
export type CostStatus = (typeof COST_STATUSES)[number];

/** Result of the receiver's quality check when the material arrived. */
export const QUALITY_RESULTS = ["accepted", "accepted_with_deviations", "rejected"] as const;
export type QualityResult = (typeof QUALITY_RESULTS)[number];

export const MAX_PROPOSAL_VALIDITY_DAYS = 30;
export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 7;

/** The commercial terms of one proposal revision. A stored revision never changes (D16). */
export type Terms = {
  quantity: number;
  unitKey: string;
  paymentDirection: PaymentDirection;
  /** Per price unit; null only with "no_payment". */
  priceAmount: number | null;
  priceUnitKey: string | null;
  vatBasis: VatBasis;
  deliveryTerm: DeliveryTerm;
  /** Required for a formal term (Incoterms 2020, D07); a custom arrangement is described here instead. */
  namedPlace: string | null;
  transportOrganiser: TransportOrganiser;
  freightAmount: number | null;
  freightCostStatus: CostStatus | null;
  freightPayer: FreightPayer | null;
  /** Offerer's share of the freight in percent, only with freightPayer "shared". */
  offererSharePercent: number | null;
  deliveryFrom: string | null;
  deliveryUntil: string | null;
  technicalConditions: string | null;
};

/** Terms compared between two revisions, in the order the page lists them. */
export const TERM_KEYS = [
  "quantity",
  "unitKey",
  "paymentDirection",
  "priceAmount",
  "priceUnitKey",
  "vatBasis",
  "deliveryTerm",
  "namedPlace",
  "transportOrganiser",
  "freightAmount",
  "freightCostStatus",
  "freightPayer",
  "offererSharePercent",
  "deliveryFrom",
  "deliveryUntil",
  "technicalConditions",
] as const satisfies readonly (keyof Terms)[];
export type TermKey = (typeof TERM_KEYS)[number];

/** AT-L2-006: a counterproposal names the terms it changed; the earlier revision stays as it was. */
export function changedTerms(before: Terms, after: Terms): TermKey[] {
  return TERM_KEYS.filter((key) => (before[key] ?? null) !== (after[key] ?? null));
}

export type TermProblem = { field: string; code: string };

/** Business rules of one set of terms that the schema alone cannot express. */
export function termProblems(terms: Terms, permittedUnits: readonly string[], today: string): TermProblem[] {
  const problems: TermProblem[] = [];
  const add = (field: string, code: string) => problems.push({ field, code });
  if (!permittedUnits.includes(terms.unitKey)) add("unitKey", "UNIT_NOT_PERMITTED");
  if (terms.paymentDirection === "no_payment") {
    if (terms.priceAmount != null) add("priceAmount", "NOT_APPLICABLE");
  } else {
    if (terms.priceAmount == null) add("priceAmount", "REQUIRED");
    else if (terms.priceAmount <= 0) add("priceAmount", "POSITIVE");
    if (terms.priceUnitKey == null) add("priceUnitKey", "REQUIRED");
  }
  if (terms.priceUnitKey != null && !permittedUnits.includes(terms.priceUnitKey)) add("priceUnitKey", "UNIT_NOT_PERMITTED");
  // a formal term names its place (D07), a custom arrangement describes itself in the same field
  if (!terms.namedPlace) add("namedPlace", "NAMED_PLACE_REQUIRED");
  if (terms.freightAmount != null && terms.freightCostStatus == null) add("freightCostStatus", "REQUIRED");
  if (terms.freightAmount != null && terms.freightPayer == null) add("freightPayer", "REQUIRED");
  if (terms.freightPayer === "shared") {
    if (terms.offererSharePercent == null) add("offererSharePercent", "REQUIRED");
  } else if (terms.offererSharePercent != null) add("offererSharePercent", "NOT_APPLICABLE");
  if (terms.deliveryFrom && terms.deliveryFrom < today) add("deliveryFrom", "DATE_PAST");
  if (terms.deliveryUntil && terms.deliveryUntil < today) add("deliveryUntil", "DATE_PAST");
  if (terms.deliveryFrom && terms.deliveryUntil && terms.deliveryUntil < terms.deliveryFrom) add("deliveryUntil", "DATE_ORDER");
  return problems;
}

/** Stored status of a negotiation (column negotiations.status). */
export const NEGOTIATION_STATUSES = ["open", "agreed", "declined", "withdrawn"] as const;
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];

/** What users see: an open negotiation whose current proposal ran out is "expired" – no job flips a status. */
export type NegotiationDisplayStatus = NegotiationStatus | "expired";

export function effectiveNegotiationStatus(status: NegotiationStatus, validUntil: Date, now: Date = new Date()): NegotiationDisplayStatus {
  return status === "open" && validUntil.getTime() <= now.getTime() ? "expired" : status;
}

export type NegotiationAction = "accept" | "decline" | "counter" | "withdraw" | "repropose";

/**
 * D16: only the counterpart of the current pending revision accepts, declines or counters it; its author can
 * withdraw it. After expiry nobody can accept, and either party may make a fresh proposal. A decided negotiation
 * allows nothing – the accepted terms are locked.
 */
export function negotiationActions(status: NegotiationDisplayStatus, viewerIsAuthor: boolean): NegotiationAction[] {
  if (status === "open") return viewerIsAuthor ? ["withdraw"] : ["accept", "counter", "decline"];
  if (status === "expired") return ["repropose", "withdraw"];
  return [];
}

/** Stored status of an exchange (column exchanges.status). */
export const EXCHANGE_STATUSES = ["planned", "completed", "cancelled"] as const;
export type ExchangeStatus = (typeof EXCHANGE_STATUSES)[number];

export type ExchangeAction = "update" | "complete" | "cancel";

/**
 * L2-011: both parties keep the plan up to date and may cancel it; only the receiving site (the requester)
 * records the received quantity, the quality check and completion. A completed or cancelled exchange is final.
 */
export function exchangeActions(status: ExchangeStatus, viewerIsReceiver: boolean): ExchangeAction[] {
  if (status !== "planned") return [];
  return viewerIsReceiver ? ["update", "complete", "cancel"] : ["update", "cancel"];
}

/**
 * D13, X-05: only a completed exchange between real (non-demo) records with material that was not rejected is a
 * verified outcome. Simulated records never count, whatever their status.
 */
export function countsAsVerifiedOutcome(exchange: { status: ExchangeStatus; simulated: boolean; qualityResult: QualityResult | null; receivedQuantity: number | null }): boolean {
  return (
    exchange.status === "completed" &&
    !exchange.simulated &&
    exchange.qualityResult !== null &&
    exchange.qualityResult !== "rejected" &&
    (exchange.receivedQuantity ?? 0) > 0
  );
}

/** Reference shown to both parties, like the KW-/RQ- numbers of listings. */
export function negotiationRef(id: number): string {
  return `NG-${String(id).padStart(6, "0")}`;
}

export function exchangeRef(id: number): string {
  return `EX-${String(id).padStart(6, "0")}`;
}

/** Lookup key of an open negotiation for one offer and the other site, seen from the viewer. */
export const pairKey = (offerId: number, otherSiteId: number) => `${offerId}:${otherSiteId}`;
