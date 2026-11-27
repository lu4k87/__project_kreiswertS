"use client";
// A supplier responds to an open request (L2-003): a message and optionally one of its own active offers. One
// response per site; the server refuses another company's offer and a closed request.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest, fieldErrorText } from "@/lib/api-client";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { Field, Select, TextArea } from "@/components/ui/form";
import { SendIcon } from "@/components/ui/icons";

type Props = { requestId: number; ownOffers: { id: number; ref: string; title: string }[]; preselect?: number; t: PlatformMessages };

export function RespondForm({ requestId, ownOffers, preselect, t }: Props) {
  const router = useRouter();
  const r = t.responses;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const offer = String(data.get("offerId") ?? "");
    setBusy(true);
    setError("");
    setFieldError({});
    const result = await apiRequest("POST", `/api/requests/${requestId}/responses`, { message: String(data.get("message") ?? ""), offerId: offer === "" ? null : Number(offer) });
    setBusy(false);
    if (!result.ok) {
      if (result.error.fields.length > 0) setFieldError(Object.fromEntries(result.error.fields.map((problem) => [problem.field, fieldErrorText(problem.code, t.errors)])));
      return setError(apiErrorText(result.error, t.errors));
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{r.respondText}</p>
      <Field id="response-message" label={r.message} required hint={r.messageHint} error={fieldError.message}>
        <TextArea id="response-message" name="message" required minLength={10} maxLength={2000} rows={5} autoComplete="off" hasHint error={fieldError.message} />
      </Field>
      {ownOffers.length > 0 && (
        <Field id="response-offer" label={`${r.offer} (${t.common.optional})`} hint={r.offerHint} error={fieldError.offerId}>
          <Select id="response-offer" name="offerId" defaultValue={preselect ?? ""} hasHint error={fieldError.offerId}>
            <option value="">{r.offerNone}</option>
            {ownOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.title} ({offer.ref})
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={`${buttonPrimary} justify-self-start`}>
        <SendIcon size={18} />
        {busy ? r.sending : r.send}
      </button>
    </form>
  );
}
