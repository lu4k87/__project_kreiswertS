// Individual negotiation (PG-24, L2-006, D16): status and whose move it is, the current terms, accept / decline /
// counter / withdraw, the viewer's private commercial comparison (L2-007), every earlier version with the terms it
// changed, the exchange and the contract once agreed, and the combined chain benefit both sites released.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getNegotiationFeasibility } from "@/server/dal/assessments";
import { getNegotiation } from "@/server/dal/negotiations";
import { getChainView } from "@/server/dal/chain";
import { contractSummaryFor } from "@/server/dal/contracts";
import { calendarDay } from "@/server/domain/dates";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Facts, Notice, PageHeader, Section, buttonSecondary } from "@/components/ui/elements";
import { CalendarIcon, FileTextIcon, HandshakeIcon, LayersIcon, PackageIcon, TruckIcon } from "@/components/ui/icons";
import { ROUTES, exchangePath, offerPath, requestPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { NegotiationActions } from "@/components/negotiations/negotiation-actions";
import { NegotiationStatusBadge } from "@/components/negotiations/negotiation-list";
import { ProposalForm } from "@/components/negotiations/proposal-form";
import { TermsFacts } from "@/components/negotiations/terms-view";
import { NegotiationFeasibilitySection } from "@/components/assessments/assessment-sections";
import { PlanForm } from "@/components/exchanges/exchange-forms";
import { ChainSection, ContractSection } from "@/components/contracts/contract-sections";
import { ExchangeStatusBadge } from "@/components/exchanges/exchange-list";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function NegotiationPage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", `/negotiations/${id.data}`);
  const p = page.t.platform;
  const d = p.negotiationDetail;
  const g = p.trade;
  const back = <BackLink href={ROUTES.negotiations}>{p.negotiations.title}</BackLink>;
  if (page.blocked) return <><PageHeader title={p.negotiations.title} back={back} />{page.blocked}</>;

  let negotiation;
  try {
    negotiation = await getNegotiation(page.viewer, id.data);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const [catalogue, feasibility, contract, chain] = await Promise.all([
    getCatalogue(),
    getNegotiationFeasibility(page.viewer, negotiation),
    contractSummaryFor(page.viewer, negotiation.id),
    getChainView(page.viewer, negotiation),
  ]);
  const verified = page.viewer.site.status === "verified";
  const format = makeFormatters(page.locale, p, catalogue.units);
  const units = negotiation.permittedUnits.map((key) => ({ key, label: format.unitName(key) || key }));
  const { status, current } = negotiation;
  const statusText =
    status === "open" ? (negotiation.awaiting === "you" ? d.yourMove : d.theirMove) : status === "expired" ? d.expiredText : status === "agreed" ? d.agreedText : status === "declined" ? d.declinedText : d.withdrawnText;
  const canCounter = negotiation.actions.includes("counter") || negotiation.actions.includes("repropose");
  const counterLabel = negotiation.actions.includes("repropose") ? d.repropose : d.counter;
  const byText = (by: "you" | "other") => (by === "you" ? g.byYou : g.byOther);

  return (
    <>
      <PageHeader
        title={negotiation.offer.title}
        back={back}
        intro={`${negotiation.ref} · ${negotiation.role === "offerer" ? g.youOffer : g.youRequest} · ${g.with}: ${negotiation.otherSite.companyName} – ${negotiation.otherSite.name}`}
      />

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="status">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="status" className="flex items-center gap-2.5 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-mint"><HandshakeIcon size={18} /></span>
            {d.status}
          </h2>
          <NegotiationStatusBadge status={status} awaitingYou={negotiation.awaiting === "you"} t={p} />
          {negotiation.simulated && <Badge tone="outline">{g.simulated}</Badge>}
        </div>
        <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{statusText}</p>
        <dl className="grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{g.revision}</dt>
            <dd className="font-semibold tabular-nums">{current.revision} · {byText(current.by)}</dd>
          </div>
          {(status === "open" || status === "expired") && (
            <div className="min-w-0">
              <dt className="text-[13px] text-muted">{g.validUntil}</dt>
              <dd className="font-semibold">{format.dateTime(current.validUntil)}</dd>
            </div>
          )}
          {negotiation.decidedAt && negotiation.decidedBy && (
            <div className="min-w-0">
              <dt className="text-[13px] text-muted">{d.decided}</dt>
              <dd className="font-semibold">{format.dateTime(negotiation.decidedAt)} · {negotiation.decidedBy === "you" ? d.decidedByYou : d.decidedByOther}</dd>
            </div>
          )}
        </dl>
        {negotiation.simulated && <p className="max-w-[68ch] text-[13px] leading-normal text-pretty">{g.simulatedText}</p>}
        <NegotiationActions negotiationId={negotiation.id} revision={current.revision} actions={negotiation.actions} t={p} />
        {canCounter && (
          <details className="rounded-xl border border-line" open={negotiation.actions.includes("repropose") || undefined}>
            <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold">{counterLabel}</summary>
            <div className="grid gap-4 border-t border-line p-4">
              <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{negotiation.actions.includes("repropose") ? d.reproposeText : d.counterText}</p>
              <ProposalForm target={{ kind: "counter", negotiationId: negotiation.id, expectedRevision: current.revision }} defaults={current.terms} units={units} t={p} idPrefix="counter" />
            </div>
          </details>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Section title={status === "agreed" ? `${d.agreedTerms} (${g.revision} ${current.revision})` : d.terms} icon={<FileTextIcon size={18} />} id="terms">
            <TermsFacts terms={current.terms} t={p} locale={page.locale} format={format} />
          </Section>

          <NegotiationFeasibilitySection view={feasibility} negotiationId={negotiation.id} revision={current.revision} t={p} locale={page.locale} format={format} units={units} />

          <ChainSection view={chain} negotiationId={negotiation.id} verified={verified} locale={page.locale} t={p} />

          <Section title={`${d.history} (${negotiation.revisions.length})`} icon={<LayersIcon size={18} />} id="history">
            <p className="mb-4 text-[13px] leading-normal text-pretty text-muted">{d.historyText}</p>
            <ol className="grid gap-3">
              {negotiation.revisions.map((revision) => (
                <li key={revision.revision} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[15px] font-semibold tabular-nums">{g.revision} {revision.revision}</span>
                    <Badge tone={revision.state === "accepted" ? "solid" : revision.state === "pending" || revision.state === "expired" ? "attention" : "neutral"}>{p.tradeLabels.revisionState[revision.state]}</Badge>
                    <span className="text-[13px] text-muted">{byText(revision.by)} · {format.dateTime(revision.createdAt)}</span>
                  </div>
                  <p className="text-[15px] break-words">
                    <span className="font-medium">{d.changed}:</span>{" "}
                    {revision.changed.length === 0 ? d.changedNone : revision.changed.map((key) => p.tradeLabels.term[key]).join(", ")}
                  </p>
                  {revision.note && (
                    <p className="max-w-[68ch] text-[15px] leading-relaxed break-words whitespace-pre-line">
                      <span className="font-medium">{d.noteLabel}:</span> {revision.note}
                    </p>
                  )}
                  <details className="rounded-lg border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-[15px] font-semibold">{d.showTerms}</summary>
                    <div className="border-t border-line px-3">
                      <TermsFacts terms={revision.terms} changed={revision.changed} t={p} locale={page.locale} format={format} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="grid min-w-0 gap-6">
          <Section title={d.exchange} icon={<TruckIcon size={18} />} id="exchange">
            {negotiation.exchange ? (
              <div className="grid gap-3">
                <p className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span translate="no">{negotiation.exchange.ref}</span>
                  <ExchangeStatusBadge status={negotiation.exchange.status} t={p} />
                </p>
                <Link href={exchangePath(negotiation.exchange.id)} className={`${buttonSecondary} justify-self-start`}>
                  <CalendarIcon size={18} />
                  {d.openExchange}
                </Link>
              </div>
            ) : negotiation.canPlanExchange ? (
              <div className="grid gap-4">
                <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{d.exchangeText}</p>
                <PlanForm t={p} today={calendarDay()} negotiationId={negotiation.id} />
              </div>
            ) : (
              <p className="text-[15px] text-pretty">{d.exchangeNotYet}</p>
            )}
          </Section>

          <ContractSection negotiationId={negotiation.id} contract={contract} agreed={status === "agreed"} canCreate={verified} t={p} />

          <Section title={d.listings} icon={<PackageIcon size={18} />} id="listings">
            <Facts
              rows={[
                { label: g.offer, value: <Link href={offerPath(negotiation.offer.id)} className="font-medium underline underline-offset-4">{negotiation.offer.title}</Link>, note: negotiation.offer.ref },
                {
                  label: g.request,
                  value: negotiation.request ? <Link href={requestPath(negotiation.request.id)} className="font-medium underline underline-offset-4">{negotiation.request.title}</Link> : g.noRequest,
                  note: negotiation.request?.ref,
                },
              ]}
            />
          </Section>
          <Notice>{g.nonBinding}</Notice>
        </div>
      </div>
    </>
  );
}
