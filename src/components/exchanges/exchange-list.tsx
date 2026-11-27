// Exchanges as a list (PG-25): status, the agreed and the received quantity, the other site. Simulated ones carry
// their label everywhere (D13).
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import type { ExchangeStatus } from "@/server/domain/negotiation";
import type { ExchangeCard } from "@/server/dal/exchanges";
import { Badge } from "@/components/ui/elements";
import { exchangePath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";

const TONE: Record<ExchangeStatus, "neutral" | "solid" | "attention"> = { planned: "neutral", completed: "solid", cancelled: "neutral" };

export function ExchangeStatusBadge({ status, t }: { status: ExchangeStatus; t: PlatformMessages }) {
  return <Badge tone={TONE[status]}>{t.tradeLabels.exchangeStatus[status]}</Badge>;
}

export function ExchangeList({ items, t, format }: { items: ExchangeCard[]; t: PlatformMessages; format: Formatters }) {
  const x = t.exchanges;
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ExchangeStatusBadge status={item.status} t={t} />
            {item.simulated && <Badge tone="outline">{t.trade.simulated}</Badge>}
            {item.qualityResult && <Badge tone={item.qualityResult === "rejected" ? "attention" : "neutral"}>{t.tradeLabels.qualityResult[item.qualityResult]}</Badge>}
          </div>
          <Link href={exchangePath(item.id)} className="block w-fit max-w-full text-[15px] leading-snug font-semibold break-words underline underline-offset-4">
            {item.offer.title}
          </Link>
          <p className="text-[13px] leading-normal text-muted">
            <span translate="no">{item.ref}</span> · {item.role === "offerer" ? t.trade.youOffer : t.trade.youRequest} · {t.trade.with}: {item.otherSite.companyName} – {item.otherSite.name}
          </p>
          <p className="text-[15px]">
            {x.agreed}: <span className="whitespace-nowrap">{format.quantity(item.agreed.quantity, item.agreed.unitKey)}</span>
            {item.received ? (
              <>
                {" "}
                · {x.received}: <span className="whitespace-nowrap">{format.quantity(item.received.quantity, item.received.unitKey)}</span> ({format.date(item.received.on)})
              </>
            ) : (
              item.status === "planned" && (
                <>
                  {" "}
                  · {x.plannedFor} {format.date(item.plannedDate)}
                </>
              )
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
