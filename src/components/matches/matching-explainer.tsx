// Side note of the request form: how a request is compared with offers (D15) – the four results with their badge,
// and what requirements and preferences do. Fills the column next to the form like the offer form's live preview.
import type { PlatformMessages } from "@/i18n/platform";
import { MATCH_RESULTS } from "@/server/domain/matching";
import { HandshakeIcon } from "@/components/ui/icons";
import { MatchBadge } from "./match-badge";

export function MatchingExplainer({ t }: { t: PlatformMessages }) {
  const e = t.matchingExplainer;
  return (
    <aside className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-6" aria-labelledby="matching-explainer">
      <h2 id="matching-explainer" className="flex items-center gap-2.5 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
        <span className="grid size-9 flex-none place-items-center rounded-lg bg-mint">
          <HandshakeIcon size={18} />
        </span>
        {e.title}
      </h2>
      <p className="text-[15px] leading-relaxed text-pretty">{e.text}</p>
      <ul className="grid gap-3">
        {MATCH_RESULTS.map((result) => (
          <li key={result} className="grid gap-1.5 border-b border-line pb-3 last:border-b-0 last:pb-0">
            <div>
              <MatchBadge result={result} t={t} />
            </div>
            <p className="text-[13px] leading-normal text-pretty">{t.l2labels.matchResultText[result]}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
