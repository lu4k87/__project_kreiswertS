// Contract of an agreed negotiation (Level 2, contract execution): the frozen content with its fingerprint, both
// signatures, the execution (delivery and payment) and the history. Only the two sites can open it.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getContract, type Signature } from "@/server/dal/contracts";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Facts, Notice, PageHeader, Section, buttonSecondary } from "@/components/ui/elements";
import { CalendarIcon, CheckIcon, FileTextIcon, LayersIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { ROUTES, exchangePath, negotiationPath, offerPath, requestPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { TermsFacts } from "@/components/negotiations/terms-view";
import { SignForm, VoidForm } from "@/components/contracts/contract-actions";
import { formatCents } from "@/components/contracts/contract-sections";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

export default async function ContractPage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", `/contracts/${id.data}`);
  const p = page.t.platform;
  const c = p.contract;
  const l = p.contractLabels;
  const g = p.trade;
  if (page.blocked) return <><PageHeader title={c.title} back={<BackLink href={ROUTES.negotiations}>{p.negotiations.title}</BackLink>} />{page.blocked}</>;

  let contract;
  try {
    contract = await getContract(page.viewer, id.data);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const catalogue = await getCatalogue();
  const format = makeFormatters(page.locale, p, catalogue.units);
  const { snapshot } = contract;
  const back = <BackLink href={negotiationPath(snapshot.negotiation.id)}>{c.backToNegotiation}</BackLink>;
  const signatureText = (signature: Signature) => (signature ? fill(c.signedBy, { name: signature.by, date: format.dateTime(signature.at) }) : c.notSigned);
  const party = (side: "offerer" | "requester") => {
    const entry = snapshot[side];
    return `${entry.company} – ${entry.site}${contract.role === side ? ` (${c.yourSite})` : ""}`;
  };
  const can = (action: "sign" | "void") => contract.actions.includes(action);
  const obligation = (state: keyof typeof l.obligation) => l.obligation[state];

  return (
    <>
      <PageHeader title={`${c.title} ${contract.ref}`} back={back} intro={`${snapshot.offer.title} · ${snapshot.negotiation.ref} · ${g.with}: ${contract.otherSite.companyName} – ${contract.otherSite.name}`} />

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="status">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="status" className="flex items-center gap-2.5 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-mint"><FileTextIcon size={18} /></span>
            {c.status}
          </h2>
          <Badge tone={contract.status === "signed" ? "solid" : "neutral"}>{l.contractStatus[contract.status]}</Badge>
          {contract.status === "signed" && <Badge tone="outline">{l.execution[contract.execution.state]}</Badge>}
          {contract.simulated && <Badge tone="outline">{g.simulated}</Badge>}
        </div>
        <dl className="grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[13px]">{c.offerer}</dt>
            <dd className="font-semibold break-words">{party("offerer")}</dd>
            <dd className="text-[15px]">{signatureText(contract.signatures.offerer)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px]">{c.requester}</dt>
            <dd className="font-semibold break-words">{party("requester")}</dd>
            <dd className="text-[15px]">{signatureText(contract.signatures.requester)}</dd>
          </div>
        </dl>
        {contract.voided && (
          <p className="text-[15px] text-pretty">
            {fill(c.voidedBy, { who: contract.voided.by === "you" ? c.you : c.other, date: format.dateTime(contract.voided.at) })}
            {contract.voided.reason ? ` – ${contract.voided.reason}` : ""}
          </p>
        )}
        {contract.simulated && <p className="max-w-[68ch] text-[13px] leading-normal text-pretty">{g.simulatedText}</p>}
        <Notice tone="attention">{c.prototypeNote}</Notice>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Section title={c.content} icon={<FileTextIcon size={18} />} id="content">
            <div className="grid gap-4">
              <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{c.contentText}</p>
              <Facts
                rows={[
                  { label: c.listing, value: <Link href={offerPath(snapshot.offer.id)} className="font-medium underline underline-offset-4">{snapshot.offer.title}</Link>, note: snapshot.offer.ref },
                  { label: c.request, value: snapshot.request ? <Link href={requestPath(snapshot.request.id)} className="font-medium underline underline-offset-4">{snapshot.request.title}</Link> : g.noRequest, note: snapshot.request?.ref },
                  { label: c.agreedVersion, value: `${g.revision} ${snapshot.acceptedRevision}` },
                  { label: c.agreedAt, value: snapshot.agreedAt ? format.dateTime(snapshot.agreedAt) : null },
                ]}
              />
              <TermsFacts terms={snapshot.terms} t={p} locale={page.locale} format={format} />
              <div className="grid gap-1 rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  <ShieldCheckIcon size={18} className="flex-none" />
                  {c.fingerprint}
                </p>
                <p className="font-mono text-[13px] break-all" translate="no">{contract.hash}</p>
                <p className="text-[15px]">{contract.intact ? c.intact : c.damaged}</p>
              </div>
            </div>
          </Section>
        </div>

        <div className="grid min-w-0 gap-6">
          {can("sign") && (
            <Section title={c.signTitle} icon={<CheckIcon size={18} />} id="sign">
              <SignForm contractId={contract.id} revision={contract.revision} hash={contract.hash} t={p} />
            </Section>
          )}

          <Section title={c.execution} icon={<CalendarIcon size={18} />} id="execution">
            <div className="grid gap-4">
              <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{c.executionText}</p>
              <Facts
                rows={[
                  { label: c.status, value: l.execution[contract.execution.state] },
                  { label: c.delivery, value: obligation(contract.execution.delivery), note: contract.exchange ? `${contract.exchange.ref} · ${p.tradeLabels.exchangeStatus[contract.exchange.status]}` : c.noExchange },
                  {
                    label: c.payment,
                    value: obligation(contract.execution.payment),
                    note: [
                      contract.payment.amount?.amountCents != null && contract.payment.amount.amountCents > 0 ? formatCents(page.locale, contract.payment.amount.amountCents) : null,
                      contract.payment.status ? l.paymentStatus[contract.payment.status] : null,
                      p.payment.badge,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  },
                ]}
              />
              {contract.exchange && (
                <Link href={exchangePath(contract.exchange.id)} className={`${buttonSecondary} justify-self-start`}>
                  <CalendarIcon size={18} />
                  {c.openExchange}
                </Link>
              )}
            </div>
          </Section>

          <Section title={c.history} icon={<LayersIcon size={18} />} id="history">
            <ol className="grid gap-2">
              {[...contract.events].reverse().map((event) => (
                <li key={event.revision} className="grid gap-0.5 border-b border-line py-2 text-[15px] last:border-b-0">
                  <span className="font-medium">{c.events[event.action] ?? event.action}</span>
                  <span className="text-[13px]">{event.by === "you" ? c.byYou : c.byOther} · {format.dateTime(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Section>

          {can("void") && (
            <details className="rounded-2xl border border-line bg-surface">
              <summary className="cursor-pointer px-5 py-4 text-[15px] font-semibold">{c.voidTitle}</summary>
              <div className="border-t border-line p-5">
                <VoidForm contractId={contract.id} revision={contract.revision} t={p} />
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
