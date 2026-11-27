"use client";
// Contact offerer / Request quotation (L1-017): one message about this offer. The server takes the sender from the
// session and the receiver from the offer; the form only sends topic and text.
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { ENQUIRY_TOPICS } from "@/server/domain/listing";
import { apiErrorText, apiRequest, fieldErrorText, problemsByField } from "@/lib/api-client";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { Field, Select, TextArea } from "@/components/ui/form";
import { SendIcon } from "@/components/ui/icons";

export function EnquiryForm({ offerId, t }: { offerId: number; t: PlatformMessages }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setFields({});
    const result = await apiRequest<{ id: number }>("POST", `/api/offers/${offerId}/enquiries`, {
      topic: String(form.get("topic")),
      message: String(form.get("message")),
    });
    setBusy(false);
    if (result.ok) return setSent(true);
    setFields(problemsByField(result.error.fields));
    setError(apiErrorText(result.error, t.errors));
  }

  if (sent) return <Notice tone="success" live>{t.enquiry.sent}</Notice>;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <p className="text-[13px] leading-normal text-pretty text-muted">{t.enquiry.intro}</p>
      <Field id="enquiry-topic" label={t.enquiry.topic} required>
        <Select id="enquiry-topic" name="topic" defaultValue="quotation" required>
          {ENQUIRY_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {t.labels.enquiryTopic[topic]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="enquiry-message" label={t.enquiry.message} required hint={t.enquiry.messageHint} error={fields.message && fieldErrorText(fields.message, t.errors)}>
        <TextArea id="enquiry-message" name="message" required minLength={10} maxLength={2000} rows={5} hasHint error={fields.message} autoComplete="off" />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={buttonPrimary}>
        <SendIcon size={18} />
        {busy ? t.enquiry.sending : t.enquiry.send}
      </button>
    </form>
  );
}
