"use client";
// Buttons that change the state of an own offer: publish, renew, close, delete a draft (L1-005, L1-012, D05).
// Closing and deleting ask first. The server decides whether the action is allowed; a refusal is shown as a sentence.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { RefreshIcon, TrashIcon } from "@/components/ui/icons";

export type OfferActionKind = "publish" | "renew" | "close" | "delete";

type Props = {
  offerId: number;
  revision: number;
  actions: OfferActionKind[];
  t: PlatformMessages;
  /** Where to go after the action; default: stay and refresh the data. */
  afterPath?: string;
  /** Publish as the primary button (preview page) instead of a secondary one (list). */
  primary?: OfferActionKind;
};

export function OfferActions({ offerId, revision, actions, t, afterPath, primary }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<OfferActionKind | null>(null);
  const [error, setError] = useState("");
  const m = t.myOffers;
  const labels: Record<OfferActionKind, string> = { publish: m.publish, renew: m.renew, close: m.close, delete: m.delete };

  async function run(action: OfferActionKind) {
    if (action === "close" && !window.confirm(m.confirmClose)) return;
    if (action === "delete" && !window.confirm(m.confirmDelete)) return;
    setBusy(action);
    setError("");
    const result =
      action === "delete"
        ? await apiRequest("DELETE", `/api/my/offers/${offerId}`)
        : await apiRequest("POST", `/api/my/offers/${offerId}/${action}`, action === "close" ? {} : { expectedRevision: revision });
    if (!result.ok) {
      setBusy(null);
      // Field problems (incomplete offer) are listed on the preview page; here the summary sentence is enough.
      return setError(apiErrorText(result.error, t.errors));
    }
    if (afterPath) router.push(afterPath);
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
            className={action === primary ? buttonPrimary : action === "delete" || action === "close" ? buttonQuiet : buttonSecondary}
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
