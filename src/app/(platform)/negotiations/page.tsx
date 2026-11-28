// Negotiations (PG-23, L2-006): the own site's proposals with other sites, grouped by whose move it is. Reached
// through the dashboard (page tree, main navigation) and from matches and responses.
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { listNegotiations } from "@/server/dal/negotiations";
import { BackLink, EmptyState, stepsOf, PageHeader, Section, buttonSecondary } from "@/components/ui/elements";
import { CheckIcon, ClockIcon, HandshakeIcon, SearchIcon, SendIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { NegotiationList } from "@/components/negotiations/negotiation-list";
import { TradeTabs } from "@/components/negotiations/trade-tabs";
import { platformPage } from "../gate";

export default async function NegotiationsPage() {
  const page = await platformPage("site", ROUTES.negotiations);
  const p = page.t.platform;
  const n = p.negotiations;
  const back = <BackLink href={ROUTES.dashboard}>{p.trade.backToDashboard}</BackLink>;
  if (page.blocked) return <><PageHeader title={n.title} back={back} />{page.blocked}</>;

  const [items, catalogue] = await Promise.all([listNegotiations(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const groups = [
    { id: "awaiting-you", title: n.awaitingYou, icon: <SendIcon size={18} />, items: items.filter((item) => item.awaiting === "you") },
    { id: "awaiting-other", title: n.awaitingOther, icon: <ClockIcon size={18} />, items: items.filter((item) => item.awaiting === "other") },
    { id: "closed", title: n.closed, icon: <CheckIcon size={18} />, items: items.filter((item) => item.awaiting === null) },
  ];

  return (
    <>
      <PageHeader title={n.title} intro={n.intro} back={back} />
      <TradeTabs current="negotiations" t={p} />
      {items.length === 0 ? (
        <EmptyState icon={<HandshakeIcon size={20} />} title={n.none} text={n.noneText} action={<Link href={ROUTES.matches} className={buttonSecondary}>{n.toMatches}</Link>} photo="bales" steps={stepsOf(p.emptySteps.negotiations, [<SearchIcon key="s" size={20} />, <SendIcon key="p" size={20} />, <HandshakeIcon key="h" size={20} />])} />
      ) : (
        groups.map((group) => (
          <Section key={group.id} id={group.id} title={`${group.title} (${group.items.length})`} icon={group.icon}>
            {group.items.length === 0 ? <p className="text-[15px]">{n.emptyGroup}</p> : <NegotiationList items={group.items} t={p} format={format} />}
          </Section>
        ))
      )}
    </>
  );
}
