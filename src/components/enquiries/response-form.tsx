"use client";
// The supplier answers a received enquiry once (D11). After sending, the page data is refreshed.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { Notice, buttonSecondary } from "@/components/ui/elements";
import { Field, TextArea } from "@/components/ui/form";

export function ResponseForm({ enquiryId, t }: { enquiryId: number; t: PlatformMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = String(new FormData(event.currentTarget).get("response"));
    setBusy(true);
    setError("");
    const result = await apiRequest("POST", `/api/my/enquiries/${enquiryId}/response`, { response });
    setBusy(false);
    if (!result.ok) return setError(apiErrorText(result.error, t.errors));
    router.refresh();
  }

  const id = `response-${enquiryId}`;
  return (
    <details className="rounded-lg border border-line">
      <summary className="px-3 py-2 text-[15px] font-semibold">{t.enquiry.respond}</summary>
      <form onSubmit={onSubmit} className="grid gap-3 border-t border-line p-3">
        <Field id={id} label={t.enquiry.responseLabel} required>
          <TextArea id={id} name="response" required minLength={2} maxLength={2000} rows={4} autoComplete="off" />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" disabled={busy} className={`${buttonSecondary} justify-self-start`}>
          {busy ? t.common.saving : t.enquiry.sendResponse}
        </button>
      </form>
    </details>
  );
}
