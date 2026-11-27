// First proposal (L2-006): from a match (request + offer) or a response that names an offer. The server works out
// who negotiates with whom; an open negotiation of the same pair is linked instead of starting a second one.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getNegotiationStart } from "@/server/dal/negotiations";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Facts, Notice, PageHeader, Section, buttonPrimary } from "@/components/ui/elements";
import { FileTextIcon, HandshakeIcon } from "@/components/ui/icons";
import { ROUTES, negotiationPath, offerPath, requestPath } from "@/components/layout/links";
import { apiErrorText } from "@/lib/api-client";
import { makeFormatters } from "@/components/offers/format";
import { ProposalForm } from "@/components/negotiations/proposal-form";
import { platformPage } from "../../gate";

type Props = { searchParams: Promise<{ offer?: string; request?: string }> };

export default async function NewNegotiationPage({ searchParams }: Props) {
  const query = await searchParams;
  const offerId = idParam.safeParse(query.offer);
  const requestId = query.request === undefined ? null : idParam.safeParse(query.request);
  if (!offerId.success || (requestId && !requestId.success)) notFound();
  const path = `/negotiations/new?offer=${offerId.data}${requestId ? `&request=${requestId.data}` : ""}`;
  const page = await platformPage("site", path);
  const p = page.t.platform;
  const f = p.proposalForm;
  const back = <BackLink href={ROUTES.negotiations}>{p.negotiations.title}</BackLink>;
  if (page.blocked) return <><PageHeader title={f.newTitle} back={back} />{page.blocked}</>;
  if (page.viewer.site.status !== "verified") {
    const gate = await platformPage("browse", path);
    return <><PageHeader title={f.newTitle} back={back} />{gate.blocked}</>;
  }

  let start;
  try {
    start = await getNegotiationStart(page.viewer, offerId.data, requestId ? requestId.data : null);
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    return (
      <>
        <PageHeader title={f.newTitle} back={back} />
        <Notice tone="attention">{apiErrorText({ code: error.code, status: error.status, fields: [], reason: error.details?.reason as string | undefined }, p.errors)}</Notice>
      </>
    );
  }
  const catalogue = await getCatalogue();
  const format = makeFormatters(page.locale, p, catalogue.units);
  const g = p.trade;
  const units = start.permittedUnits.map((key) => ({ key, label: format.unitName(key) || key }));

  return (
    <>
      <PageHeader title={f.newTitle} intro={f.newIntro} back={back} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title={f.formTitle} icon={<HandshakeIcon size={18} />} id="proposal">
          {start.existingId != null ? (
            <div className="grid gap-4">
              <Notice>{f.existing}</Notice>
              <Link href={negotiationPath(start.existingId)} className={`${buttonPrimary} justify-self-start`}>{f.openExisting}</Link>
            </div>
          ) : (
            <ProposalForm target={{ kind: "start", offerId: start.offer.id, requestId: start.request?.id ?? null }} defaults={start.defaults} units={units} t={p} />
          )}
        </Section>
        <div className="grid min-w-0 gap-6">
          <Section title={p.negotiationDetail.listings} icon={<FileTextIcon size={18} />} id="listings">
            <Facts
              rows={[
                { label: g.with, value: `${start.otherSite.companyName} – ${start.otherSite.name}`, note: start.role === "offerer" ? g.youOffer : g.youRequest },
                {
                  label: g.offer,
                  value: <Link href={offerPath(start.offer.id)} className="font-medium underline underline-offset-4">{start.offer.title}</Link>,
                  note: `${start.offer.ref} · ${f.offerStates}: ${format.quantity(start.offer.quantity, start.offer.unitKey)}`,
                },
                {
                  label: g.request,
                  value: start.request ? <Link href={requestPath(start.request.id)} className="font-medium underline underline-offset-4">{start.request.title}</Link> : g.noRequest,
                  note: start.request ? `${start.request.ref} · ${f.requestStates}: ${format.quantity(start.request.quantity, start.request.unitKey)}` : undefined,
                },
              ]}
            />
            {start.simulated && <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] leading-normal"><Badge tone="outline">{g.simulated}</Badge>{g.simulatedText}</p>}
          </Section>
          <Notice>{g.nonBinding}</Notice>
        </div>
      </div>
    </>
  );
}
