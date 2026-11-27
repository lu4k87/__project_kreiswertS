// Bodies of the contract, payment and chain-consent routes (Level 2). Only zod and pure modules → usable in the
// browser too.
import { z } from "zod";
import { IDEMPOTENCY_KEY } from "../domain/payment";
import { PROVIDER_EVENT_TYPES } from "../payments/provider";
import { HAS_LETTER_OR_DIGIT, paragraph } from "./common";

const revision = z.number().int().min(1).max(1_000_000);
const reason = paragraph(1000).min(3).regex(HAS_LETTER_OR_DIGIT);

/** POST /api/my/contracts/[id]/sign: the hash of the snapshot the page showed and the explicit confirmation. */
export const contractSign = z.object({
  expectedRevision: revision,
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/),
  confirm: z.literal(true),
});
export type ContractSign = z.infer<typeof contractSign>;

/** POST /api/my/contracts/[id]/void */
export const contractVoid = z.object({ expectedRevision: revision, reason });
export type ContractVoid = z.infer<typeof contractVoid>;

/** A key the browser generates once per form; a repeated request with the same key is the same operation. */
export const idempotencyKey = z.string().regex(IDEMPOTENCY_KEY);

/** POST /api/my/exchanges/[id]/payments */
export const paymentCreate = z.object({ idempotencyKey });

/** POST /api/my/payments/[id]/checkout: the simulated checkout of the payer (authorise or refuse). */
export const paymentCheckout = z.object({ outcome: z.enum(["authorise", "fail"]) });

/** POST /api/my/payments/[id]/capture and …/cancel */
export const paymentStep = z.object({ idempotencyKey });

/** POST /api/my/payments/[id]/refund */
export const paymentRefund = z.object({ idempotencyKey, reason });
export type PaymentRefund = z.infer<typeof paymentRefund>;

/** Body of a provider confirmation (after the signature was checked). */
export const providerEvent = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  type: z.enum(PROVIDER_EVENT_TYPES),
  providerRef: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("EUR"),
  created: z.number().int().positive(),
});

/** POST /api/my/negotiations/[id]/chain-consent: release the saved comparison of this revision, or withdraw. */
export const chainConsent = z.discriminatedUnion("consent", [
  z.object({ consent: z.literal(true), assessmentRevision: revision, termsRevision: revision }),
  z.object({ consent: z.literal(false) }),
]);
export type ChainConsentInput = z.infer<typeof chainConsent>;
