// Negotiations as a list (PG-23): status, whose move it is, the listings, the other site and the current proposal.
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import type { NegotiationDisplayStatus } from "@/server/domain/negotiation";
import type { NegotiationCard } from "@/server/dal/negotiations";
import { Badge } from "@/components/ui/elements";
import { negotiationPath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";

const TONE: Record<NegotiationDisplayStatus, "neutral" | "solid" | "attention"> = { open: "neutral", expired: "attention", agreed: "solid", declined: "neutral", withdrawn: "neutral" };

export function NegotiationStatusBadge({ status, awaitingYou, t }: { status: NegotiationDisplayStatus; awaitingYou?: boolean; t: PlatformMessages }) {
  return <Badge tone={awaitingYou ? "attention" : TONE[status]}>{awaitingYou ? t.negotiations.awaitingYou : t.tradeLabels.negotiationStatus[status]}</Badge>;
}

export function NegotiationList({ items, t, format }: { items: NegotiationCard[]; t: PlatformMessages; format: Formatters }) {
  const g = t.trade;
  return (
    <ul className="grid gap-3">
      {items.map((item) => {
        const terms = item.current.terms;
        const price = terms.priceAmount == null ? t.tradeLabels.paymentDirection[terms.paymentDirection] : format.price({ priceMode: "fixed", priceAmount: terms.priceAmount, priceUnitKey: terms.priceUnitKey, vatBasis: terms.vatBasis, payer: null }).main;
        return (
          <li key={item.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <NegotiationStatusBadge status={item.status} awaitingYou={item.awaiting === "you"} t={t} />
              {item.simulated && <Badge tone="outline">{g.simulated}</Badge>}
              <span className="text-[13px] text-muted">
                {g.updated}: {format.dateTime(item.updatedAt)}
              </span>
            </div>
            <Link href={negotiationPath(item.id)} className="block w-fit max-w-full text-[15px] leading-snug font-semibold break-words underline underline-offset-4">
              {item.offer.title}
            </Link>
            <p className="text-[13px] leading-normal text-muted">
              <span translate="no">{item.ref}</span> · {item.role === "offerer" ? g.youOffer : g.youRequest} · {g.with}: {item.otherSite.companyName} – {item.otherSite.name}
            </p>
            <p className="text-[15px]">
              <span className="font-medium">
                {g.revision} {item.current.revision}:
              </span>{" "}
              <span className="whitespace-nowrap">{format.quantity(terms.quantity, terms.unitKey)}</span> · {price}
              {item.status === "open" && (
                <span className="text-muted">
                  {" "}
                  · {g.validUntil} {format.dateTime(item.current.validUntil)}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
