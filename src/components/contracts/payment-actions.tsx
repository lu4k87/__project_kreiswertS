"use client";
// Actions of the simulated payment. Every create, capture, cancel and refund carries an idempotency key generated
// once per mounted form, so a double click or a retried request does the step once. The checkout buttons stand in
// for the provider's payment page: the server answers with a signed confirmation and checks it like a real one.
import type { FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import type { PaymentAction } from "@/server/domain/payment";
import { Notice, buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { Field, TextArea } from "@/components/ui/form";
import { CheckIcon, EuroIcon } from "@/components/ui/icons";
import { useAction, useIdempotencyKey } from "./use-action";

export function StartPaymentButton({ exchangeId, t }: { exchangeId: number; t: PlatformMessages }) {
  const key = useIdempotencyKey();
  const { busy, error, run } = useAction(t);
  return (
    <div className="grid gap-2">
      <button type="button" disabled={busy !== null} onClick={() => run("start", `/api/my/exchanges/${exchangeId}/payments`, { idempotencyKey: key })} className={`${buttonPrimary} justify-self-start`}>
        <EuroIcon size={18} />
        {busy ? t.negotiationDetail.working : t.payment.start}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function PaymentButtons({ paymentId, actions, t }: { paymentId: number; actions: PaymentAction[]; t: PlatformMessages }) {
  const m = t.payment;
  const key = useIdempotencyKey();
  const { busy, error, run } = useAction(t);
  const label = (name: string, text: string) => (busy === name ? t.negotiationDetail.working : text);
  const base = `/api/my/payments/${paymentId}`;
  const has = (action: PaymentAction) => actions.includes(action);
  if (!has("authorise") && !has("capture") && !has("cancel")) return null;
  return (
    <div className="grid gap-3">
      {has("authorise") && (
        <div className="grid gap-3 rounded-xl border border-line p-4">
          <p className="font-semibold">{m.checkout}</p>
          <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{m.checkoutText}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} onClick={() => run("authorise", `${base}/checkout`, { outcome: "authorise" })} className={buttonPrimary}>
              <CheckIcon size={18} />
              {label("authorise", m.authorise)}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("fail", `${base}/checkout`, { outcome: "fail" })} className={buttonSecondary}>
              {label("fail", m.fail)}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {has("capture") && (
          <button type="button" disabled={busy !== null} onClick={() => run("capture", `${base}/capture`, { idempotencyKey: key })} className={buttonPrimary}>
            <EuroIcon size={18} />
            {label("capture", m.capture)}
          </button>
        )}
        {has("cancel") && (
          <button type="button" disabled={busy !== null} onClick={() => run("cancel", `${base}/cancel`, { idempotencyKey: key })} className={buttonQuiet}>
            {label("cancel", m.cancel)}
          </button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function RefundForm({ paymentId, t }: { paymentId: number; t: PlatformMessages }) {
  const m = t.payment;
  const key = useIdempotencyKey();
  const { busy, error, run } = useAction(t);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    void run("refund", `/api/my/payments/${paymentId}/refund`, { idempotencyKey: key, reason });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <Field id={`refund-${paymentId}`} label={m.refundReason} required>
        <TextArea id={`refund-${paymentId}`} name="reason" rows={2} maxLength={1000} required minLength={3} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy !== null} className={`${buttonSecondary} justify-self-start`}>
        {busy ? t.negotiationDetail.working : m.refund}
      </button>
    </form>
  );
}
