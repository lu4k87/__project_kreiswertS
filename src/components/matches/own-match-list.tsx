// "Compatibility" on a request or offer page (L2-005): the viewer's own listings compared with the one shown, each
// with its result and a link to the full comparison.
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import type { MatchSummary, OwnMatch } from "@/server/dal/matches";
import { Section, linkClass } from "@/components/ui/elements";
import { HandshakeIcon } from "@/components/ui/icons";
import { MatchBadge } from "./match-badge";

/** "2 unknown · 1 of 2 preferences met" – the counts behind a result, never a score. */
export function matchFacts(match: MatchSummary, t: PlatformMessages): string {
  const m = t.matches;
  const parts: string[] = [];
  if (match.steps.length > 0) parts.push(match.steps.map((step) => t.labels.capability[step]).join(" → "));
  if (match.unknown > 0) parts.push(`${match.unknown} ${m.unknownCount}`);
  if (match.preferences > 0) parts.push(`${match.preferencesMet}/${match.preferences} ${m.preferencesMet}`);
  return parts.join(" · ");
}

type Props = {
  items: OwnMatch[];
  /** Link of one item to its comparison page. */
  hrefOf: (item: OwnMatch) => string;
  text: string;
  empty: string;
  t: PlatformMessages;
};

export function OwnMatchList({ items, hrefOf, text, empty, t }: Props) {
  return (
    <Section title={t.matches.compatibilityTitle} icon={<HandshakeIcon size={18} />} id="compatibility">
      <p className="mb-3 text-[13px] leading-normal text-pretty text-muted">{text}</p>
      {items.length === 0 ? (
        <p className="text-[15px]">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const facts = matchFacts(item.match, t);
            return (
              <li key={item.id} className="grid gap-1.5 border-b border-line py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="min-w-0 text-[15px] font-medium break-words">{item.title}</span>
                  <MatchBadge result={item.match.result} t={t} />
                </div>
                <p className="text-[13px] text-muted">
                  <span translate="no">{item.ref}</span>
                  {facts && ` · ${facts}`}
                </p>
                <Link href={hrefOf(item)} className={`${linkClass} w-fit text-[13px]`}>
                  {t.matches.open}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
