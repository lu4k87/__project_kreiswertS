// Company circularity overview (PG-27, L2-008, L2-011, D13): the own site's outcome indicators. Realised = completed,
// not simulated, not rejected exchanges; environmental results only when the owner released them, and they stay
// estimates. Demo (simulated) records are summed apart and never mixed in.
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { getImpactOverview, type ImpactTotals } from "@/server/dal/assessments";
import { BackLink, Badge, EmptyState, Notice, PageHeader, Section, Stat, buttonSecondary } from "@/components/ui/elements";
import { RecycleIcon, TruckIcon } from "@/components/ui/icons";
import { ROUTES, matchPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { platformPage } from "../gate";

const NBSP = "\u00a0";

export default async function ImpactPage() {
  const page = await platformPage("site", ROUTES.impact);
  const p = page.t.platform;
  const i = p.impact;
  const back = <BackLink href={ROUTES.dashboard}>{p.trade.backToDashboard}</BackLink>;
  if (page.blocked) return <><PageHeader title={i.title} back={back} />{page.blocked}</>;

  const [overview, catalogue] = await Promise.all([getImpactOverview(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const number = new Intl.NumberFormat(page.locale, { maximumFractionDigits: 1 });
  const kg = (value: number) => `${number.format(value)}${NBSP}kg`;
  const co2 = (value: number) => `${number.format(value)}${NBSP}kg${NBSP}CO₂e`;
  const { exchanges } = overview;

  const totals = (title: string, values: ImpactTotals, note?: string) => (
    <div className="grid content-start gap-3">
      <h3 className="text-lg leading-tight font-semibold">{title}</h3>
      {note && <p className="max-w-[68ch] text-[13px] leading-normal text-pretty">{note}</p>}
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat value={values.count} label={i.count} />
        <Stat value={kg(values.displacementKg)} label={i.displacement} />
        <div className="grid content-start gap-1 rounded-2xl border border-line bg-surface p-5">
          <dt className="text-[13px] font-medium">{i.lifecycle}</dt>
          <dd className="text-[1.5rem] leading-tight font-semibold tabular-nums">{values.lifecycleCount > 0 ? co2(values.lifecycleDifferenceKg) : p.common.unknown}</dd>
          <dd className="text-[13px] leading-normal">{i.fromCount.replace("{count}", String(values.lifecycleCount))}</dd>
        </div>
        <div className="grid content-start gap-1 rounded-2xl border border-line bg-surface p-5">
          <dt className="text-[13px] font-medium">{i.transport}</dt>
          <dd className="text-[1.5rem] leading-tight font-semibold tabular-nums">{values.transportCount > 0 ? co2(values.transportDifferenceKg) : p.common.unknown}</dd>
          <dd className="text-[13px] leading-normal">{i.fromTransport.replace("{count}", String(values.transportCount))}</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <>
      <PageHeader title={i.title} intro={i.intro} back={back} />

      <Section title={i.exchanges} icon={<TruckIcon size={18} />} id="exchanges">
        <p className="mb-4 max-w-[68ch] text-[15px] leading-relaxed text-pretty">{i.exchangesText}</p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={exchanges.verifiedCompleted} label={i.verifiedCompleted} href={ROUTES.exchanges} />
          <Stat value={exchanges.simulatedCompleted} label={i.simulatedCompleted} href={ROUTES.exchanges} />
          <Stat value={exchanges.planned} label={i.planned} href={ROUTES.exchanges} />
          <Stat value={exchanges.cancelled} label={i.cancelled} href={ROUTES.exchanges} />
        </dl>
        <p className="mt-4 text-[15px]">
          <span className="font-medium">{i.received}:</span>{" "}
          {exchanges.verifiedReceived.length === 0 ? i.receivedNone : exchanges.verifiedReceived.map((item) => format.quantity(item.quantity, item.unitKey)).join(", ")}
        </p>
      </Section>

      <Section title={i.assessments} icon={<RecycleIcon size={18} />} id="assessments">
        <div className="mb-5 grid gap-3">
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-pretty">{i.assessmentsText}</p>
          {overview.illustrative && <Notice tone="attention">{p.environment.exampleWarning}</Notice>}
        </div>
        {overview.approved.length === 0 ? (
          <EmptyState icon={<RecycleIcon size={20} />} title={i.none} text={i.noneText} action={<Link href={ROUTES.matches} className={buttonSecondary}>{i.toMatches}</Link>} />
        ) : (
          <div className="grid gap-6">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {totals(i.actual, overview.totals.actual)}
              {totals(i.simulated, overview.totals.simulated, i.simulatedText)}
            </div>
            <ul className="grid gap-3">
              {overview.approved.map((card) => (
                <li key={card.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 text-[15px] font-semibold break-words">
                      {card.request ? `${card.request.ref} ${card.request.title}` : ""} · {card.offer.ref} {card.offer.title}
                    </span>
                    <Badge tone={card.result.status === "complete" ? "solid" : "neutral"}>{p.assessmentLabels.environmentStatus[card.result.status]}</Badge>
                    {card.simulated && <Badge tone="outline">{p.trade.simulated}</Badge>}
                  </div>
                  <p className="text-[15px] tabular-nums">
                    {i.quantity}: {card.result.quantityKg != null ? kg(card.result.quantityKg) : p.common.unknown} · {i.displacement}: {card.result.displacementKg != null ? kg(card.result.displacementKg) : p.common.unknown}
                    {card.result.lifecycle && <> · {i.lifecycle}: {co2(card.result.lifecycle.differenceKg)}</>}
                    {card.result.transport && <> · {i.transport}: {co2(card.result.transport.differenceKg)}</>}
                  </p>
                  {card.illustrative && <p className="text-[13px] leading-normal">{i.illustrative}</p>}
                  {card.request && (
                    <Link href={`${matchPath(card.request.id, card.offer.id)}#environment`} className="w-fit text-[15px] font-medium underline underline-offset-4">
                      {i.openMatch}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {overview.drafts > 0 && <p className="mt-4 text-[15px]">{i.drafts.replace("{count}", String(overview.drafts))}</p>}
      </Section>
    </>
  );
}
