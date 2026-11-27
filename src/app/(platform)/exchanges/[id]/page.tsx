// Individual exchange (PG-26, L2-011): status, plan, receipt and quality check, the agreed terms of the accepted
// version, the simulated payment under the signed contract and the history. Only the receiving site records receipt;
// both can move the date or cancel.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getExchange } from "@/server/dal/exchanges";
import { getExchangePayment } from "@/server/dal/payments";
import { calendarDay } from "@/server/domain/dates";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Facts, Notice, PageHeader, Section } from "@/components/ui/elements";
import { CheckIcon, FileTextIcon, LayersIcon, TruckIcon } from "@/components/ui/icons";
import { ROUTES, negotiationPath, offerPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { TermsFacts } from "@/components/negotiations/terms-view";
import { CancelForm, PlanForm, ReceiptForm } from "@/components/exchanges/exchange-forms";
import { ExchangeStatusBadge } from "@/components/exchanges/exchange-list";
import { PaymentSection } from "@/components/contracts/contract-sections";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function ExchangePage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", `/exchanges/${id.data}`);
  const p = page.t.platform;
  const x = p.exchangeDetail;
  const g = p.trade;
  const back = <BackLink href={ROUTES.exchanges}>{x.backToExchanges}</BackLink>;
  if (page.blocked) return <><PageHeader title={p.exchanges.title} back={back} />{page.blocked}</>;

  let exchange;
  try {
    exchange = await getExchange(page.viewer, id.data);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const [catalogue, payment] = await Promise.all([getCatalogue(), getExchangePayment(page.viewer, exchange.id)]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const today = calendarDay();
  const units = exchange.permittedUnits.map((key) => ({ key, label: format.unitName(key) || key }));
  const statusText = exchange.status === "planned" ? x.plannedText : exchange.status === "completed" ? x.completedText : x.cancelledText;
  const can = (action: "update" | "complete" | "cancel") => exchange.actions.includes(action);
  const events = p.tradeLabels.exchangeEvent;

  return (
    <>
      <PageHeader
        title={exchange.offer.title}
        back={back}
        intro={`${exchange.ref} · ${exchange.role === "offerer" ? g.youOffer : g.youRequest} · ${g.with}: ${exchange.otherSite.companyName} – ${exchange.otherSite.name}`}
      />

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="status">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="status" className="flex items-center gap-2.5 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-mint"><TruckIcon size={18} /></span>
            {x.status}
          </h2>
          <ExchangeStatusBadge status={exchange.status} t={p} />
          {exchange.simulated && <Badge tone="outline">{g.simulated}</Badge>}
        </div>
        <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{statusText}</p>
        <dl className="grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{p.exchanges.agreed}</dt>
            <dd className="font-semibold whitespace-nowrap">{format.quantity(exchange.agreed.quantity, exchange.agreed.unitKey)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{exchange.received ? p.exchanges.received : p.exchanges.plannedFor}</dt>
            <dd className="font-semibold">
              {exchange.received ? (
                <><span className="whitespace-nowrap">{format.quantity(exchange.received.quantity, exchange.received.unitKey)}</span> · {format.date(exchange.received.on)}</>
              ) : (
                format.date(exchange.plannedDate)
              )}
            </dd>
          </div>
          {exchange.qualityResult && (
            <div className="min-w-0">
              <dt className="text-[13px] text-muted">{p.exchanges.quality}</dt>
              <dd className="font-semibold">{p.tradeLabels.qualityResult[exchange.qualityResult]}</dd>
            </div>
          )}
        </dl>
        {exchange.status === "completed" && <p className="text-[15px] font-medium">{exchange.verifiedOutcome ? x.verifiedOutcome : x.notVerifiedOutcome}</p>}
        {exchange.simulated && <p className="max-w-[68ch] text-[13px] leading-normal text-pretty">{g.simulatedText}</p>}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          {can("complete") && (
            <Section title={x.receipt} icon={<CheckIcon size={18} />} id="receipt">
              <ReceiptForm t={p} today={today} exchange={{ id: exchange.id, revision: exchange.revision, unitKey: exchange.agreed.unitKey, quantity: exchange.agreed.quantity }} units={units} />
            </Section>
          )}
          <PaymentSection view={payment} role={exchange.role} locale={page.locale} t={p} dateTime={format.dateTime} />
          <Section title={`${x.agreedTerms} (${g.revision} ${exchange.acceptedRevision})`} icon={<FileTextIcon size={18} />} id="terms">
            <TermsFacts terms={exchange.terms} t={p} locale={page.locale} format={format} />
          </Section>
        </div>

        <div className="grid min-w-0 gap-6">
          <Section title={x.plan} icon={<TruckIcon size={18} />} id="plan">
            <div className="grid gap-4">
              <Facts
                rows={[
                  { label: x.planDate, value: format.date(exchange.plannedDate) },
                  { label: x.planNote, value: exchange.planNote },
                  { label: x.qualityNote, value: exchange.qualityNote },
                  { label: x.cancelReasonLabel, value: exchange.cancelReason },
                  { label: x.negotiation, value: <Link href={negotiationPath(exchange.negotiation.id)} className="font-medium underline underline-offset-4">{exchange.negotiation.ref}</Link> },
                  { label: g.offer, value: <Link href={offerPath(exchange.offer.id)} className="font-medium underline underline-offset-4">{exchange.offer.ref}</Link> },
                ]}
              />
              {exchange.status === "planned" && !can("complete") && <p className="text-[13px] leading-normal text-pretty text-muted">{x.receiverOnly}</p>}
              {can("update") && (
                <details className="rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-[15px] font-semibold">{x.changePlan}</summary>
                  <div className="border-t border-line p-3">
                    <PlanForm t={p} today={today} exchange={{ id: exchange.id, revision: exchange.revision, plannedDate: exchange.plannedDate, planNote: exchange.planNote }} />
                  </div>
                </details>
              )}
              {can("cancel") && (
                <details className="rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-[15px] font-semibold">{x.cancel}</summary>
                  <div className="border-t border-line p-3">
                    <CancelForm t={p} exchange={{ id: exchange.id, revision: exchange.revision }} />
                  </div>
                </details>
              )}
            </div>
          </Section>

          <Section title={x.history} icon={<LayersIcon size={18} />} id="history">
            <ol className="grid gap-2">
              {exchange.events.map((event) => (
                <li key={event.revision} className="grid gap-0.5 border-b border-line py-2 text-[15px] last:border-b-0">
                  <span className="font-medium">{events[event.action as keyof typeof events] ?? event.action}</span>
                  <span className="text-[13px] text-muted">{event.by === "you" ? g.byYou : g.byOther} · {format.dateTime(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Section>
          <Notice>{g.nonBinding}</Notice>
        </div>
      </div>
    </>
  );
}
