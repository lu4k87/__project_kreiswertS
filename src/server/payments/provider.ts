// Payment provider port: what the platform needs from a payment service. The prototype plugs in the
// SimulatedProvider (simulated.ts); a real provider (card, SEPA, …) is a second adapter with the same interface –
// the data model, the states, the idempotency keys and the signed confirmation stay as they are.
import type { PaymentProviderName } from "../domain/payment";

export type ProviderPayment = { amountCents: number; currency: string; reference: string; idempotencyKey: string };

/** Events the provider confirms through the signed endpoint POST /api/payments/webhook. */
export const PROVIDER_EVENT_TYPES = ["payment.authorised", "payment.failed"] as const;
export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[number];
export type ProviderEvent = { id: string; type: ProviderEventType; providerRef: string; amountCents: number; currency: string; created: number };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** Starts a payment; the payer authorises it at the provider, which confirms through the webhook. */
  create(payment: ProviderPayment): Promise<{ providerRef: string }>;
  /** Takes the reserved money. The same key twice is one capture at the provider. */
  capture(providerRef: string, idempotencyKey: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Releases a reservation that was not captured. */
  cancel(providerRef: string, idempotencyKey: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Pays captured money back. */
  refund(providerRef: string, amountCents: number, idempotencyKey: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Secret of the confirmation signature (HMAC). */
  webhookSecret(): string;
}
