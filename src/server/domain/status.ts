// Status flows of the platform: which statuses exist and which changes are allowed.
// Pure data + functions without a database → testable on their own (status.test.ts).
// New flow = new table in the same format.

/** Allowed changes per status; an empty list = final status */
import type { ContractStatus } from "./contract";
import type { ExchangeStatus, NegotiationStatus } from "./negotiation";
import type { PaymentStatus } from "./payment";

export type Flow<S extends string> = Readonly<Record<S, readonly S[]>>;

// ── Level 2: negotiation and exchange (docs/FEATURES.md "Level 2, part 2") ──────────────────────────────────

/** Open → agreed (counterpart accepts), declined (counterpart refuses) or withdrawn (a party ends it). Counter-
 *  proposals add revisions and keep the negotiation open. An agreement is final: its terms are locked (D16). */
export const negotiationFlow: Flow<NegotiationStatus> = {
  open: ["agreed", "declined", "withdrawn"],
  agreed: [],
  declined: [],
  withdrawn: [],
};

/** An exchange starts planned for an agreed negotiation and ends completed or cancelled (L2-011). */
export const exchangeFlow: Flow<ExchangeStatus> = {
  planned: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// ── Level 2: contract and simulated payment (docs/FEATURES.md "Level 2, part 4") ───────────────────────────────

/** Created from the accepted revision → signed once both sites signed, or voided by one site before that. Signed is
 *  final: the snapshot is bound, the execution (delivery, payment) is derived from the exchange and the payment. */
export const contractFlow: Flow<ContractStatus> = {
  awaiting_signatures: ["signed", "voided"],
  signed: [],
  voided: [],
};

/** pending → authorised or failed at the provider, or cancelled by the payer; authorised → captured after delivery
 *  or cancelled (the reservation released); captured → refunded by the payee. */
export const paymentFlow: Flow<PaymentStatus> = {
  pending: ["authorised", "failed", "cancelled"],
  authorised: ["captured", "cancelled"],
  captured: ["refunded"],
  failed: [],
  cancelled: [],
  refunded: [],
};

export function canTransition<S extends string>(flow: Flow<S>, from: S, to: S): boolean {
  return flow[from].includes(to);
}

export function isFinal<S extends string>(flow: Flow<S>, status: S): boolean {
  return flow[status].length === 0;
}

// ── Level 1: offer lifecycle and site verification (docs/FEATURES.md) ───────────────────────────────────

/** Stored statuses of an offer (column offers.status). "expired" is derived, see effectiveOfferStatus(). */
export const OFFER_STATUSES = ["draft", "active", "closed"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** What users see: the stored statuses plus "expired". */
export const OFFER_DISPLAY_STATUSES = ["draft", "active", "expired", "closed"] as const;
export type OfferDisplayStatus = (typeof OFFER_DISPLAY_STATUSES)[number];

/** Draft → active → closed; an expired listing can be renewed (back to active) or closed (D05). */
export const offerFlow: Flow<OfferDisplayStatus> = {
  draft: ["active"],
  active: ["closed", "expired"],
  expired: ["active", "closed"],
  closed: [],
};

/** Active with an expiry date in the past counts as expired – no background job has to flip a status. */
export function effectiveOfferStatus(status: OfferStatus, expiresAt: Date | null, now: Date = new Date()): OfferDisplayStatus {
  if (status === "active" && expiresAt && expiresAt.getTime() <= now.getTime()) return "expired";
  return status;
}

/** Only active listings are discoverable and can be contacted. */
export function isDiscoverable(status: OfferStatus, expiresAt: Date | null, now: Date = new Date()): boolean {
  return effectiveOfferStatus(status, expiresAt, now) === "active";
}

export function expiryDate(validityDays: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + validityDays * 24 * 60 * 60 * 1000);
}

/** Verification of a site by an administrator (column sites.verification_status, D03). */
export const VERIFICATION_STATUSES = ["pending", "verified", "declined"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** A decision can be revised: verified ↔ declined, and both can be set back to pending for a new review. */
export const verificationFlow: Flow<VerificationStatus> = {
  pending: ["verified", "declined"],
  verified: ["declined", "pending"],
  declined: ["verified", "pending"],
};
