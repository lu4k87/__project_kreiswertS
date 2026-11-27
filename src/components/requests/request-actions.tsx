"use client";
// Buttons that change the state of an own request: publish, renew, close as fulfilled or withdrawn, delete a draft
// (L2-004, D05). Closing and deleting ask first. The server decides; a refusal is shown as a sentence.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { RefreshIcon, TrashIcon } from "@/components/ui/icons";

export type RequestActionKind = "publish" | "renew" | "fulfilled" | "withdrawn" | "delete";

type Props = {
  requestId: number;
  revision: number;
  actions: RequestActionKind[];
  t: PlatformMessages;
  /** Publish as the primary button (detail page of a draft) instead of a secondary one. */
  primary?: RequestActionKind;
};

export function RequestActions({ requestId, revision, actions, t, primary }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<RequestActionKind | null>(null);
  const [error, setError] = useState("");
  const m = t.myRequests;
  const labels: Record<RequestActionKind, string> = { publish: m.publish, renew: m.renew, fulfilled: m.closeFulfilled, withdrawn: m.closeWithdrawn, delete: m.delete };

  async function run(action: RequestActionKind) {
    if ((action === "fulfilled" || action === "withdrawn") && !window.confirm(m.confirmClose)) return;
    if (action === "delete" && !window.confirm(m.confirmDelete)) return;
    setBusy(action);
    setError("");
    const base = `/api/my/requests/${requestId}`;
    const result =
      action === "delete"
        ? await apiRequest("DELETE", base)
        : action === "fulfilled" || action === "withdrawn"
          ? await apiRequest("POST", `${base}/close`, { reason: action })
          : await apiRequest("POST", `${base}/${action}`, { expectedRevision: revision });
    if (!result.ok) {
      setBusy(null);
      return setError(apiErrorText(result.error, t.errors));
    }
    if (action === "delete") router.push("/my-requests");
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={busy !== null}
            className={action === primary ? buttonPrimary : action === "publish" || action === "renew" ? buttonSecondary : buttonQuiet}
          >
            {action === "renew" && <RefreshIcon size={16} />}
            {action === "delete" && <TrashIcon size={16} />}
            {busy === action ? m.working : labels[action]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
