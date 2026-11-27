// Exchanges / history (PG-25, L2-011): planned, completed and cancelled exchanges of the own site. The counts keep
// simulated and verified completions apart – a demo exchange never counts as a real outcome (D13, X-05).
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { listExchanges } from "@/server/dal/exchanges";
import { BackLink, EmptyState, PageHeader, Section, Stat, buttonSecondary } from "@/components/ui/elements";
import { CalendarIcon, CheckIcon, TruckIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { ExchangeList } from "@/components/exchanges/exchange-list";
import { TradeTabs } from "@/components/negotiations/trade-tabs";
import { platformPage } from "../gate";

export default async function ExchangesPage() {
  const page = await platformPage("site", ROUTES.exchanges);
  const p = page.t.platform;
  const x = p.exchanges;
  const back = <BackLink href={ROUTES.dashboard}>{p.trade.backToDashboard}</BackLink>;
  if (page.blocked) return <><PageHeader title={x.title} back={back} />{page.blocked}</>;

  const [{ exchanges, summary }, catalogue] = await Promise.all([listExchanges(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const planned = exchanges.filter((item) => item.status === "planned");
  const ended = exchanges.filter((item) => item.status !== "planned");

  return (
    <>
      <PageHeader title={x.title} intro={x.intro} back={back} />
      <TradeTabs current="exchanges" t={p} />
      <div className="grid gap-3">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={summary.planned} label={x.planned} />
          <Stat value={summary.verifiedCompleted} label={x.verifiedCompleted} />
          <Stat value={summary.simulatedCompleted} label={x.simulatedCompleted} />
          <Stat value={summary.cancelled} label={x.cancelled} />
        </dl>
        <p className="max-w-[68ch] text-[13px] leading-normal text-pretty text-muted">{x.countsText}</p>
      </div>
      {exchanges.length === 0 ? (
        <EmptyState icon={<TruckIcon size={20} />} title={x.none} text={x.noneText} action={<Link href={ROUTES.negotiations} className={buttonSecondary}>{x.toNegotiations}</Link>} />
      ) : (
        <>
          <Section title={`${x.planned} (${planned.length})`} icon={<CalendarIcon size={18} />} id="planned">
            {planned.length === 0 ? <p className="text-[15px]">{p.negotiations.emptyGroup}</p> : <ExchangeList items={planned} t={p} format={format} />}
          </Section>
          <Section title={`${x.completed} · ${x.cancelled} (${ended.length})`} icon={<CheckIcon size={18} />} id="history">
            {ended.length === 0 ? <p className="text-[15px]">{p.negotiations.emptyGroup}</p> : <ExchangeList items={ended} t={p} format={format} />}
          </Section>
        </>
      )}
    </>
  );
}
