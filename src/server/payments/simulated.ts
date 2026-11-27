// SimulatedProvider: behaves like a payment service but moves no money. It hands out provider references, accepts
// captures, cancellations and refunds at once, and plays the payer's checkout: on request it produces a signed
// confirmation (authorised or failed) that goes through exactly the same check as one from outside.
//
// Secret: PAYMENT_WEBHOOK_SECRET (at least 32 characters) when set – then a test script can sign events too.
// Without it, a random secret per server process: nobody outside can forge a confirmation, the simulated checkout
// still works (it signs inside the same process).
import { randomBytes, randomUUID } from "node:crypto";
import type { PaymentProvider, ProviderEvent, ProviderEventType, ProviderPayment } from "./provider";
import { signPayload } from "./signature";

const SECRET_KEY = Symbol.for("kreiswerts.simulatedPaymentSecret");

function secret(): string {
  const configured = process.env.PAYMENT_WEBHOOK_SECRET;
  if (configured && configured.length >= 32) return configured;
  const store = globalThis as unknown as Record<symbol, string | undefined>;
  store[SECRET_KEY] ??= randomBytes(32).toString("hex");
  return store[SECRET_KEY]!;
}

export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated" as const;

  async create(payment: ProviderPayment) {
    void payment; // a real adapter sends amount, currency, reference and key to the provider here
    return { providerRef: `sim_pay_${randomUUID().replace(/-/g, "")}` };
  }

  // a real adapter calls the provider with the reference and the idempotency key; the simulation always succeeds
  capture: PaymentProvider["capture"] = async () => ({ ok: true });
  cancel: PaymentProvider["cancel"] = async () => ({ ok: true });
  refund: PaymentProvider["refund"] = async () => ({ ok: true });

  webhookSecret(): string {
    return secret();
  }

  /** The simulated checkout: the confirmation the provider would send after the payer's decision. */
  checkoutDecision(payment: { providerRef: string; amountCents: number; currency: string }, type: ProviderEventType): { body: string; signature: string } {
    const created = Math.floor(Date.now() / 1000);
    const event: ProviderEvent = { id: `sim_evt_${randomUUID().replace(/-/g, "")}`, type, providerRef: payment.providerRef, amountCents: payment.amountCents, currency: payment.currency, created };
    const body = JSON.stringify(event);
    return { body, signature: signPayload(this.webhookSecret(), body, created) };
  }
}

let provider: SimulatedProvider | null = null;

/** The provider in use. Only the simulated one exists in the prototype. */
export function paymentProvider(): SimulatedProvider {
  provider ??= new SimulatedProvider();
  return provider;
}
