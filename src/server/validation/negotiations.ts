// Station 3 – validation of proposals and exchanges: shape and types of what the browser sends. Rules between fields
// and against the catalogue are in src/server/domain/negotiation.ts. Only zod + pure modules → the forms use it too.
import { z } from "zod";
import { DELIVERY_TERMS, VAT_BASES } from "../domain/listing";
import {
  COST_STATUSES,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  FREIGHT_PAYERS,
  MAX_PROPOSAL_VALIDITY_DAYS,
  PAYMENT_DIRECTIONS,
  QUALITY_RESULTS,
  TRANSPORT_ORGANISERS,
} from "../domain/negotiation";
import { HAS_LETTER_OR_DIGIT, decimal, idParam, isoDate, line, nullable, paragraph } from "./common";

const positive = (decimals: number, max?: number) => decimal(decimals, max).refine((value) => value > 0);
const expectedRevision = z.number().int().min(1);

/** The terms of one proposal. Fields the server sets itself (parties, Incoterms version, revision) are not part of it. */
export const termsInput = z.object({
  quantity: positive(3),
  unitKey: line(10).min(1),
  paymentDirection: z.enum(PAYMENT_DIRECTIONS),
  priceAmount: nullable(decimal(2, 1e8)),
  priceUnitKey: nullable(line(10)),
  vatBasis: z.enum(VAT_BASES).default("net"),
  deliveryTerm: z.enum(DELIVERY_TERMS),
  namedPlace: nullable(line(200)),
  transportOrganiser: z.enum(TRANSPORT_ORGANISERS),
  freightAmount: nullable(decimal(2, 1e7)),
  freightCostStatus: nullable(z.enum(COST_STATUSES)),
  freightPayer: nullable(z.enum(FREIGHT_PAYERS)),
  offererSharePercent: nullable(z.number().int().min(0).max(100)),
  deliveryFrom: nullable(isoDate),
  deliveryUntil: nullable(isoDate),
  technicalConditions: nullable(paragraph(2000)),
});
export type TermsInput = z.infer<typeof termsInput>;

const proposal = {
  terms: termsInput,
  /** Why this proposal or change – shown in the history. */
  note: nullable(paragraph(1000)),
  validityDays: z.number().int().min(1).max(MAX_PROPOSAL_VALIDITY_DAYS).default(DEFAULT_PROPOSAL_VALIDITY_DAYS),
};

/** Body of POST /api/my/negotiations: the first proposal for an offer, optionally for a request. */
export const negotiationStart = z.object({ offerId: idParam, requestId: nullable(idParam), ...proposal });
export type NegotiationStart = z.infer<typeof negotiationStart>;

/** Body of POST /api/my/negotiations/[id]/revisions: a counterproposal (or a fresh one after expiry). */
export const counterProposal = z.object({ expectedRevision, ...proposal });
export type CounterProposal = z.infer<typeof counterProposal>;

/** Body of POST …/accept, …/decline, …/withdraw: the revision the page showed – an outdated one is a 409. */
export const negotiationDecision = z.object({ expectedRevision });

/** Body of POST /api/my/negotiations/[id]/exchange. */
export const exchangePlan = z.object({ plannedDate: isoDate, planNote: nullable(paragraph(1000)) });
export type ExchangePlan = z.infer<typeof exchangePlan>;

/** Body of PUT /api/my/exchanges/[id]. */
export const exchangeUpdate = exchangePlan.extend({ expectedRevision });
export type ExchangeUpdate = z.infer<typeof exchangeUpdate>;

/** Body of POST /api/my/exchanges/[id]/complete: what arrived and the receiver's quality check. */
export const exchangeCompletion = z.object({
  expectedRevision,
  receivedQuantity: decimal(3),
  receivedUnitKey: line(10).min(1),
  receivedOn: isoDate,
  qualityResult: z.enum(QUALITY_RESULTS),
  qualityNote: nullable(paragraph(1000)),
});
export type ExchangeCompletion = z.infer<typeof exchangeCompletion>;

/** Body of POST /api/my/exchanges/[id]/cancel. */
export const exchangeCancel = z.object({ expectedRevision, reason: paragraph(1000).min(3).regex(HAS_LETTER_OR_DIGIT) });
