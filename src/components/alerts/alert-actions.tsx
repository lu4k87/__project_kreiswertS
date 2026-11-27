"use client";
// Buttons of the Notifications page (function no. 19): mark all notices as read, delete a saved search.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { buttonQuiet, buttonSecondary } from "@/components/ui/elements";

function useAction(t: PlatformMessages) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(method: "POST" | "DELETE", path: string, body?: unknown) {
    setBusy(true);
    setError("");
    const result = await apiRequest(method, path, body);
    setBusy(false);
    if (!result.ok) return setError(apiErrorText(result.error, t.errors));
    router.refresh();
  }
  return { busy, error, run };
}

function ErrorText({ text }: { text: string }) {
  return text ? (
    <span role="alert" className="text-[13px] font-medium text-danger">
      {text}
    </span>
  ) : null;
}

export function MarkAllRead({ t }: { t: PlatformMessages }) {
  const { busy, error, run } = useAction(t);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button type="button" className={buttonSecondary} disabled={busy} onClick={() => run("POST", "/api/my/notifications/read", {})}>
        {busy ? t.alerts.marking : t.alerts.markAllRead}
      </button>
      <ErrorText text={error} />
    </span>
  );
}

export function DeleteSavedSearch({ id, name, t }: { id: number; name: string; t: PlatformMessages }) {
  const { busy, error, run } = useAction(t);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonQuiet}
        disabled={busy}
        aria-label={`${t.alerts.delete}: ${name}`}
        onClick={() => window.confirm(t.alerts.confirmDelete) && run("DELETE", `/api/my/saved-searches/${id}`)}
      >
        {busy ? t.alerts.deleting : t.alerts.delete}
      </button>
      <ErrorText text={error} />
    </span>
  );
}
