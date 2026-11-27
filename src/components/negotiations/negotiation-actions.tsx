"use client";
// Accept, decline or withdraw the current proposal (D16). Each asks first and sends the revision the page showed,
// so a decision never lands on a version the viewer has not seen. The server decides; a refusal is a sentence.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import type { NegotiationAction } from "@/server/domain/negotiation";
import { apiRequest } from "@/lib/api-client";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { CheckIcon } from "@/components/ui/icons";
import { tradeErrorText } from "./trade-errors";

type Decision = Extract<NegotiationAction, "accept" | "decline" | "withdraw">;

export function NegotiationActions({ negotiationId, revision, actions, t }: { negotiationId: number; revision: number; actions: NegotiationAction[]; t: PlatformMessages }) {
  const router = useRouter();
  const d = t.negotiationDetail;
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState("");
  const decisions = (["accept", "decline", "withdraw"] as const).filter((action) => actions.includes(action));
  const labels: Record<Decision, string> = { accept: d.accept, decline: d.decline, withdraw: d.withdraw };
  const confirms: Record<Decision, string> = { accept: d.confirmAccept, decline: d.confirmDecline, withdraw: d.confirmWithdraw };
  if (decisions.length === 0) return null;

  async function run(action: Decision) {
    if (!window.confirm(confirms[action])) return;
    setBusy(action);
    setError("");
    const result = await apiRequest("POST", `/api/my/negotiations/${negotiationId}/${action}`, { expectedRevision: revision });
    setBusy(null);
    if (!result.ok) return setError(tradeErrorText(result.error, t));
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {decisions.map((action) => (
          <button key={action} type="button" onClick={() => run(action)} disabled={busy !== null} className={action === "accept" ? buttonPrimary : action === "decline" ? buttonSecondary : buttonQuiet}>
            {action === "accept" && <CheckIcon size={18} />}
            {busy === action ? d.working : labels[action]}
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
