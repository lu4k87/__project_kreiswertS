// Station 3 – validation of private assessments (L2-007, L2-008): shape and types of what the browser sends.
// Rules between fields are in src/server/domain/feasibility.ts and environment.ts. Only zod + pure modules → the
// forms use it too.
import { z } from "zod";
import { PAYMENT_DIRECTIONS, COST_STATUSES, FREIGHT_PAYERS } from "../domain/negotiation";
import { COST_BASES } from "../domain/feasibility";
import { HAS_LETTER_OR_DIGIT, decimal, idParam, line, nullable, paragraph } from "./common";

const MAX_COST_LINES = 8;
const percent = z.number().min(0).max(100).transform((value) => Math.round(value * 10) / 10);
/** A rate per unit; the offerer's baseline may be negative (today's route earns money). */
const rate = z.number().min(-1e6).max(1e6).transform((value) => Math.round(value * 1e4) / 1e4);
const expectedRevision = nullable(z.number().int().min(1));

const costLine = z.object({
  label: line(80).min(1).regex(HAS_LETTER_OR_DIGIT),
  basis: z.enum(COST_BASES),
  amount: nullable(decimal(4, 1e8)),
  status: z.enum(COST_STATUSES),
});

/** The viewer's own inputs: never shown to the other site. */
export const privateFeasibility = z.object({
  yieldPercent: nullable(percent),
  costs: z.array(costLine).max(MAX_COST_LINES).default([]),
  baseline: nullable(z.object({ rate: nullable(rate), status: z.enum(COST_STATUSES) })),
});
export type PrivateFeasibilityInput = z.infer<typeof privateFeasibility>;

/** On the match page the viewer also assumes the commercial terms (no proposal yet). */
export const matchFeasibility = privateFeasibility.extend({
  quantity: decimal(3).refine((value) => value > 0),
  unitKey: line(10).min(1),
  paymentDirection: z.enum(PAYMENT_DIRECTIONS),
  priceAmount: nullable(decimal(4, 1e8)),
  priceUnitKey: nullable(line(10)),
  priceStatus: z.enum(COST_STATUSES),
  priceIncludesFreight: z.boolean(),
  freight: nullable(
    z.object({
      amount: nullable(decimal(2, 1e7)),
      status: z.enum(COST_STATUSES),
      payer: z.enum(FREIGHT_PAYERS),
      offererSharePercent: nullable(z.number().int().min(0).max(100)),
    }),
  ),
});
export type MatchFeasibilityInput = z.infer<typeof matchFeasibility>;

const factorRef = nullable(idParam);

export const environmentalInput = z.object({
  quantity: decimal(3).refine((value) => value > 0),
  unitKey: line(10).min(1),
  yieldPercent: nullable(percent),
  substitutionPercent: nullable(percent),
  /** null = the existing route (baseline) is not described. */
  existing: nullable(z.object({ treatmentFactorId: factorRef, distanceKm: nullable(decimal(1, 20000)) })),
  /** "none" = no preparation needed; null = unknown. */
  processingFactorId: nullable(z.union([idParam, z.literal("none")])),
  proposedDistanceKm: nullable(decimal(1, 20000)),
  residueTreatmentFactorId: factorRef,
  virginProductionFactorId: factorRef,
  transportFactorId: factorRef,
  assumptions: nullable(paragraph(2000)),
});
export type EnvironmentalInput = z.infer<typeof environmentalInput>;

const matchSubject = z.object({ kind: z.literal("match"), requestId: idParam, offerId: idParam });
const negotiationSubject = z.object({ kind: z.literal("negotiation"), negotiationId: idParam });

/** Body of PUT /api/my/assessments: create or replace the viewer's assessment of one subject. */
export const assessmentSave = z.discriminatedUnion("type", [
  z.object({ type: z.literal("feasibility"), subject: matchSubject, expectedRevision, inputs: matchFeasibility }),
  z.object({ type: z.literal("negotiation_feasibility"), subject: negotiationSubject, expectedRevision, inputs: privateFeasibility }),
  z.object({ type: z.literal("environmental"), subject: matchSubject, expectedRevision, inputs: environmentalInput }),
]);
export type AssessmentSave = z.infer<typeof assessmentSave>;

/** Body of POST /api/my/assessments/[id]/approve. */
export const assessmentApproval = z.object({ expectedRevision: z.number().int().min(1) });
