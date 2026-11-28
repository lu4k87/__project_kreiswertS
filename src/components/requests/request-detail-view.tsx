// Individual request (PG-20): required material, technical acceptance criteria, quantity and demand frequency,
// commercial and delivery requirements, the requesting site. Shows only the detail projection of the server.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import type { Capability, ClosureReason, Industry } from "@/server/domain/listing";
import type { RequestDetail } from "@/server/dal/request-view";
import { Badge, Facts, KeyFacts, PageHeader, Section, grid12, linkClass, stack } from "@/components/ui/elements";
import { BuildingIcon, EuroIcon, FlaskIcon, InfoIcon, LayersIcon, RulerIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { sitePath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";
import { deliveryList, formatCriterion, maxPrice, names, originList } from "./format-request";

type Props = {
  request: RequestDetail;
  catalogue: Catalogue;
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
  back?: ReactNode;
  /** Owner actions, respond form or compatibility – placed in the side column. */
  aside?: ReactNode;
};

export function RequestDetailView({ request, catalogue, t, locale, format, back, aside }: Props) {
  const d = t.requestDetail;
  const criteria = Object.entries(request.criteria)
    .map(([key, criterion]) => ({
      definition: catalogue.attributes.find((candidate) => candidate.categoryId === request.category?.id && candidate.key === key),
      criterion,
    }))
    .filter((entry) => entry.definition !== undefined);
  const keyFacts = [
    { label: d.needed, value: format.quantity(request.quantity, request.unitKey), numeric: true },
    { label: d.maxPrice, value: maxPrice(request.maxPriceAmount, request.maxPriceUnitKey, locale, t, catalogue), numeric: true },
    { label: d.frequency, value: format.frequency(request.frequency, request.recurrencePeriod) },
  ];

  return (
    <>
      <PageHeader
        title={request.title}
        back={back}
        intro={`${request.ref} · ${request.requester.companyName} – ${request.requester.name}`}
        actions={
          <>
            {request.status !== "active" && <Badge tone={request.status === "draft" ? "outline" : "attention"}>{t.labels.offerStatus[request.status]}</Badge>}
            {request.closureReason && <Badge tone="outline">{`${d.closedAs}: ${t.l2labels.closureReason[request.closureReason as ClosureReason]}`}</Badge>}
            {request.provenance === "synthetic" && <Badge tone="outline">{t.common.demo}</Badge>}
          </>
        }
      />
      {request.provenance === "synthetic" && <p className="-mt-4 text-[13px] text-muted">{d.synthetic}</p>}

      {/* Like the offer detail ("Detail:A", user 2026-11-28) on the shared 12-column grid: left (8 columns) every
          section of the request; right (4 columns) what a reader acts on – key facts, responses or the respond form,
          the requesting site. Below 1024 px one column: the stacks dissolve and `order` puts the key facts first. */}
      <div className={grid12}>
        <div className={`${stack} max-lg:contents lg:col-span-8`}>
          <div className="min-w-0 max-lg:order-2">
            <Section title={d.material} icon={<LayersIcon size={18} />} id="material">
              {request.description && <p className="mb-4 text-[15px] leading-relaxed text-pretty whitespace-pre-line">{request.description}</p>}
              <Facts
                rows={[
                  { label: d.category, value: request.category ? nameOf(request.category, locale) : t.common.notStated },
                  { label: d.acceptedTypes, value: names(request.types, locale, t.common.notStated) },
                  { label: d.acceptedForms, value: names(request.forms, locale, t.common.notStated) },
                  { label: d.acceptedOrigins, value: originList(request.origins, t) },
                ]}
              />
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-3">
            <Section title={d.quantitySection} icon={<RulerIcon size={18} />} id="quantity">
              <Facts
                rows={[
                  { label: d.needed, value: format.quantity(request.quantity, request.unitKey) },
                  { label: d.minLot, value: request.minLot != null ? format.quantity(request.minLot, request.unitKey) : d.minLotNone },
                  { label: d.frequency, value: format.frequency(request.frequency, request.recurrencePeriod) },
                  { label: d.neededFrom, value: request.neededFrom ? format.date(request.neededFrom) : null },
                  { label: d.neededUntil, value: request.neededUntil ? format.date(request.neededUntil) : null },
                  { label: d.expires, value: request.status === "active" && request.expiresAt ? format.date(request.expiresAt) : null },
                ]}
              />
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-4">
            <Section title={d.criteria} icon={<FlaskIcon size={18} />} id="criteria">
              <p className="mb-4 text-[13px] leading-normal text-pretty text-muted">{d.criteriaText}</p>
              {criteria.length === 0 ? (
                <p className="text-[15px]">{d.noCriteria}</p>
              ) : (
                // A list instead of a table: on narrow screens a third column (requirement / preference) would scroll out of view.
                <dl className="grid">
                  {criteria.map(({ definition, criterion }) => (
                    <div
                      key={definition!.key}
                      className="grid gap-x-4 gap-y-1 border-b border-line py-2.5 text-[15px] last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] sm:items-start"
                    >
                      <dt className="min-w-0 font-medium break-words">{nameOf(definition!, locale)}</dt>
                      <dd className="min-w-0 tabular-nums">{formatCriterion(definition!, criterion, locale)}</dd>
                      <dd>
                        <Badge tone={criterion.kind === "required" ? "solid" : "outline"}>{t.l2labels.criterionKind[criterion.kind]}</Badge>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-4">
                <Facts
                  rows={[
                    {
                      label: d.minEvidence,
                      value: request.evidenceStatus ? t.labels.evidence[request.evidenceStatus as keyof typeof t.labels.evidence] : d.anyEvidence,
                    },
                    { label: d.sampleRequired, value: request.sampleRequired ? t.common.yes : t.common.no },
                  ]}
                />
              </div>
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-5">
            <Section title={d.commercial} icon={<EuroIcon size={18} />} id="commercial">
              <Facts
                rows={[
                  {
                    label: d.maxPrice,
                    value: maxPrice(request.maxPriceAmount, request.maxPriceUnitKey, locale, t, catalogue),
                    note: request.maxPriceAmount != null ? d.priceNote : undefined,
                  },
                  { label: d.delivery, value: deliveryList(request.deliveryTerms, t) },
                ]}
              />
            </Section>
          </div>
        </div>

        <div className={`${stack} max-lg:contents lg:col-span-4`}>
          <div className="min-w-0 max-lg:order-1">
            <Section title={t.detail.keyFacts} icon={<InfoIcon size={18} />} id="key-facts">
              <KeyFacts rows={keyFacts} />
            </Section>
          </div>
          {aside && <div className={`${stack} max-lg:order-6`}>{aside}</div>}
          <div className="min-w-0 max-lg:order-7">
            <Section title={d.requester} icon={<BuildingIcon size={18} />} id="requester" level={2}>
              <Facts
                layout="rail"
                rows={[
                  { label: t.site.company, value: request.requester.companyName },
                  {
                    label: t.site.siteInfo,
                    value: `${request.requester.name} · ${t.labels.industry[request.requester.industry as Industry] ?? request.requester.industry}`,
                  },
                  { label: t.site.location, value: [request.requester.parkName, request.requester.city].filter(Boolean).join(", ") },
                  {
                    label: t.site.capabilities,
                    value:
                      request.requester.capabilities.length > 0
                        ? request.requester.capabilities.map((capability) => t.labels.capability[capability as Capability] ?? capability).join(", ")
                        : null,
                  },
                  { label: t.detail.distance, value: request.isOwner ? null : format.distance(request.distanceKm, request.hasLocation) },
                ]}
              />
              <p className="mt-3">
                <Link href={sitePath(request.requester.id)} className={`${linkClass} text-[15px]`}>
                  {t.detail.viewProfile}
                </Link>
              </p>
              {request.requester.verified && (
                <p className="mt-3 flex items-center gap-2 text-[13px]">
                  <ShieldCheckIcon size={16} />
                  {t.labels.verification.verified}
                </p>
              )}
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
