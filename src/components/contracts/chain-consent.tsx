"use client";
// Release or withdraw the own commercial comparison for the combined chain benefit. The release names the saved
// revision and the proposal the page showed – the server refuses an outdated one.
import type { PlatformMessages } from "@/i18n/platform";
import { Notice, buttonPrimary, buttonQuiet } from "@/components/ui/elements";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { useAction } from "./use-action";

export function ChainConsentButtons({ negotiationId, assessmentRevision, termsRevision, released, t }: { negotiationId: number; assessmentRevision: number; termsRevision: number; released: boolean; t: PlatformMessages }) {
  const c = t.chain;
  const { busy, error, run } = useAction(t);
  const path = `/api/my/negotiations/${negotiationId}/chain-consent`;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {!released && (
          <button type="button" disabled={busy !== null} onClick={() => run("release", path, { consent: true, assessmentRevision, termsRevision })} className={buttonPrimary}>
            <ShieldCheckIcon size={18} />
            {busy === "release" ? t.negotiationDetail.working : c.release}
          </button>
        )}
        {released && (
          <button type="button" disabled={busy !== null} onClick={() => run("withdraw", path, { consent: false })} className={buttonQuiet}>
            {busy === "withdraw" ? t.negotiationDetail.working : c.withdraw}
          </button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
