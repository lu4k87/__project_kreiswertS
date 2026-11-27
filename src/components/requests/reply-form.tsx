"use client";
// The requester replies once to a received response. After sending, the page data is refreshed.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { Notice, buttonSecondary } from "@/components/ui/elements";
import { Field, TextArea } from "@/components/ui/form";

export function ReplyForm({ responseId, t }: { responseId: number; t: PlatformMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = String(new FormData(event.currentTarget).get("reply"));
    setBusy(true);
    setError("");
    const result = await apiRequest("POST", `/api/my/responses/${responseId}/reply`, { reply });
    setBusy(false);
    if (!result.ok) return setError(apiErrorText(result.error, t.errors));
    router.refresh();
  }

  const id = `reply-${responseId}`;
  return (
    <details className="rounded-lg border border-line">
      <summary className="px-3 py-2 text-[15px] font-semibold">{t.responses.reply}</summary>
      <form onSubmit={onSubmit} className="grid gap-3 border-t border-line p-3">
        <Field id={id} label={t.responses.replyLabel} required>
          <TextArea id={id} name="reply" required minLength={2} maxLength={2000} rows={4} autoComplete="off" />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" disabled={busy} className={`${buttonSecondary} justify-self-start`}>
          {busy ? t.common.saving : t.responses.replySend}
        </button>
      </form>
    </details>
  );
}
