// Offer detail (L1-016, wireframe "offer detail"): head, material specifications, quantity and logistics, delivery
// arrangements with the logistics responsibility, evidence; next to them the key facts, the enquiry and the offerer. The preview before publishing renders
// this same component, so both follow the same visibility rules.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { applicableAttributes, formatAttributeValue, isUnknown } from "@/server/domain/attributes";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import { RESPONSIBILITIES, isFormalTerm, type Party } from "@/server/domain/delivery";
import type {
  Capability,
  DeliveryPricing,
  DocumentAccess,
  EvidenceStatus,
  Industry,
  LegalStatus,
  LoadingEquipment,
  Origin,
  Packaging,
  SampleAvailability,
} from "@/server/domain/listing";
import type { OfferDetail } from "@/server/dal/offer-view";
import { Badge, Facts, KeyFacts, Notice, Section, grid12, linkClass, stack } from "@/components/ui/elements";
import { BuildingIcon, CalendarIcon, FileTextIcon, FlaskIcon, InfoIcon, MapPinIcon, PackageIcon, RulerIcon, ShieldCheckIcon, TruckIcon } from "@/components/ui/icons";
import { sitePath } from "@/components/layout/links";
import { FormIllustration } from "./form-illustration";
import type { Formatters } from "./format";

type Props = {
  offer: OfferDetail;
  catalogue: Catalogue;
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
  /** Contact form or the reason why contact is not possible; rendered in the right column above the offerer. */
  contact?: ReactNode;
  /** How the viewer's own requests compare with this offer; rendered next to the evidence. */
  compatibility?: ReactNode;
  /** false in the preview: the offerer's own profile link would lead away from the draft. */
  linkSupplier?: boolean;
};

export function OfferDetailView({ offer, catalogue, t, locale, format, contact, compatibility, linkSupplier = true }: Props) {
  const d = t.detail;
  const price = format.price(offer);
  const party = (value: Party | null) => (value === "offerer" ? d.offerer : value === "requester" ? d.requester : d.byArrangement);
  const definitions = applicableAttributes(catalogue.attributes, offer.category?.id ?? null, offer.form?.key ?? null);
  // Populated attributes are shown; empty optional ones are hidden; empty critical ones stay visible as unknown.
  const attributeRows = definitions
    .filter((definition) => !isUnknown(offer.attributes[definition.key]) || definition.critical)
    .map((definition) => {
      const value = offer.attributes[definition.key];
      return {
        label: nameOf(definition, locale),
        value: isUnknown(value) ? <span className="font-medium">{t.common.unknown}</span> : formatAttributeValue(definition, value, locale),
        note: isUnknown(value) ? d.criticalUnknown : undefined,
      };
    });
  const formal = offer.deliveryOptions.filter((option) => isFormalTerm(option.term));
  const custom = offer.deliveryOptions.find((option) => option.term === "custom");
  const keyFacts: { label: string; value: string; numeric?: boolean }[] = [
    { label: d.available, value: format.quantity(offer.quantity, offer.unitKey), numeric: true },
    { label: price.notes.length > 0 ? price.notes.join(" · ") : d.priceBasis, value: price.main, numeric: true },
    {
      label: offer.frequency === "recurring" && offer.recurrencePeriod ? t.labels.period[offer.recurrencePeriod as keyof typeof t.labels.period] : t.offerForm.frequency,
      value: format.frequency(offer.frequency, null),
    },
  ];
  // two short sections side by side from 768 px
  const pair = "grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-2";

  return (
    // Layout "Detail:A" (user, 2026-11-28) on the shared 12-column grid: left (8 columns) the head and every material
    // section, short ones side by side; right (4 columns) what a reader acts on – key facts, enquiry, offerer. Below
    // 1024 px one column: the two stacks dissolve (`contents`) and `order` puts the key facts right under the head.
    <div className={grid12}>
      <div className={`${stack} max-lg:contents lg:col-span-8`}>
        <div className="min-w-0 max-lg:order-1">
          <section className="grid min-w-0 gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="offer-title">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {offer.urgent && offer.status === "active" && (
                    <Badge tone="attention" icon={<CalendarIcon size={14} />}>
                      {t.search.urgent}
                    </Badge>
                  )}
                  {offer.status !== "active" && <Badge tone={offer.status === "draft" ? "outline" : "attention"}>{t.labels.offerStatus[offer.status]}</Badge>}
                  <Badge>
                    {t.common.listing} <span translate="no">{offer.ref}</span>
                  </Badge>
                  {offer.provenance === "synthetic" && <Badge tone="outline">{t.common.demo}</Badge>}
                </div>
                <h1 id="offer-title" className="mt-3 text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance break-words hyphens-auto sm:text-[2rem]">
                  {offer.title}
                </h1>
                <p className="mt-2 flex items-start gap-2 text-[15px]">
                  <MapPinIcon size={18} className="mt-0.5 flex-none" />
                  <span>
                    {[offer.site.parkName, offer.site.city].filter(Boolean).join(", ")}
                    {!offer.isOwner && ` · ${format.distance(offer.distanceKm, offer.hasLocation)}`}
                  </span>
                </p>
                {offer.description && <p className="mt-4 text-[15px] leading-relaxed text-pretty whitespace-pre-line">{offer.description}</p>}
              </div>
              <figure className="grid content-start gap-2">
                <FormIllustration form={offer.form?.key} className="w-full" />
                <figcaption className="text-[13px] leading-normal text-muted">{d.illustration}</figcaption>
              </figure>
            </div>

            {offer.provenance === "synthetic" && <p className="text-[13px] font-medium">{t.common.synthetic}</p>}
          </section>
        </div>
        <div className="min-w-0 max-lg:order-3">
          <Section title={d.specs} icon={<RulerIcon size={18} />} id="specs">
            <Facts
              rows={[
                { label: d.category, value: offer.category ? nameOf(offer.category, locale) : t.common.notStated },
                { label: d.type, value: offer.type ? nameOf(offer.type, locale) : t.common.notStated },
                { label: d.form, value: offer.form ? nameOf(offer.form, locale) : t.common.notStated },
                { label: d.origin, value: offer.origin ? (t.labels.origin[offer.origin as Origin] ?? offer.origin) : t.common.notStated },
                { label: d.legalStatus, value: offer.legalStatus ? (t.labels.legalStatus[offer.legalStatus as LegalStatus] ?? offer.legalStatus) : t.common.notStated },
                { label: d.wasteCode, value: offer.wasteCode },
                ...attributeRows,
              ]}
            />
            <p className="mt-3 text-[13px] leading-normal text-muted">{d.technicalNote}</p>
          </Section>
        </div>
        <div className={`${pair} max-lg:order-4`}>
          <Section title={d.availability} icon={<CalendarIcon size={18} />} id="availability">
            <Facts
              rows={[
                { label: d.currentStock, value: <span className="tabular-nums">{format.quantity(offer.quantity, offer.unitKey)}</span> },
                {
                  label: d.expectedOutput,
                  value:
                    offer.frequency === "recurring" && offer.recurrenceQuantity != null ? (
                      <span className="tabular-nums">
                        {format.quantity(offer.recurrenceQuantity, offer.unitKey)}
                        {offer.recurrencePeriod ? ` ${t.labels.period[offer.recurrencePeriod as keyof typeof t.labels.period]}` : ""}
                      </span>
                    ) : null,
                  note: d.notIncluded,
                },
                { label: d.minLot, value: offer.minLot != null ? format.quantity(offer.minLot, offer.unitKey) : null },
                { label: d.availableFrom, value: offer.availableFrom ? format.date(offer.availableFrom) : null },
                { label: d.collectionUntil, value: offer.collectionUntil ? format.date(offer.collectionUntil) : null },
                { label: d.visibleUntil, value: offer.expiresAt ? format.date(offer.expiresAt) : null },
              ]}
            />
            {price.notes.length > 0 && <p className="mt-3 text-[13px] leading-normal text-muted">{d.indicative}</p>}
          </Section>
          <Section title={d.logistics} icon={<PackageIcon size={18} />} id="logistics">
            <Facts
              rows={[
                { label: d.packaging, value: offer.packaging ? (t.labels.packaging[offer.packaging as Packaging] ?? offer.packaging) : t.common.notStated },
                { label: d.loadingEquipment, value: offer.loadingEquipment ? (t.labels.loadingEquipment[offer.loadingEquipment as LoadingEquipment] ?? offer.loadingEquipment) : t.common.notStated },
                { label: d.deliveryQuotation, value: offer.deliveryPricing ? (t.labels.deliveryPricing[offer.deliveryPricing as DeliveryPricing] ?? offer.deliveryPricing) : null },
                { label: d.maxDistance, value: offer.maxDeliveryDistanceKm != null ? `${format.number.format(offer.maxDeliveryDistanceKm)} km` : null },
              ]}
            />
          </Section>
        </div>
        <div className="min-w-0 max-lg:order-5">
          <Section title={d.deliveryTitle} icon={<TruckIcon size={18} />} id="delivery">
            {offer.deliveryOptions.length === 0 ? (
              <p className="text-[15px]">{t.common.notStated}</p>
            ) : (
              <div className="grid gap-5">
                {formal.length > 0 && (
                  <div className="scroll-thin overflow-x-auto">
                    <table className="w-full min-w-[30rem] border-collapse text-left text-[15px]">
                      <thead>
                        <tr>
                          <td className="border-b border-line py-2 pr-4" />
                          {formal.map((option) => (
                            <th key={option.term} scope="col" className="border-b border-line px-3 py-2 font-semibold">
                              {t.labels.deliveryTerm[option.term].name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(["loading", "transport", "unloading"] as const).map((step) => (
                          <tr key={step}>
                            <th scope="row" className="border-b border-line py-2 pr-4 font-medium">
                              {d[step]}
                            </th>
                            {formal.map((option) => (
                              <td key={option.term} className="border-b border-line px-3 py-2">
                                {party(RESPONSIBILITIES[option.term][step])}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr>
                          <th scope="row" className="py-2 pr-4 font-medium">
                            {d.place}
                          </th>
                          {formal.map((option) => (
                            <td key={option.term} className="px-3 py-2 break-words">
                              {option.namedPlace ?? t.common.notStated}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                {formal.length > 0 && (
                  <div>
                    <h3 className="text-lg leading-tight font-semibold">{d.responsibility}</h3>
                    {/* Who does what, as a grid: dark = offerer, light = requester; the word is always written too. */}
                    <div className="mt-3 grid gap-2 text-[13px]">
                      {formal.map((option) => (
                        <div key={option.term} className="grid grid-cols-3 items-center gap-2 sm:grid-cols-[3.5rem_repeat(3,minmax(0,1fr))]">
                          <span className="col-span-3 font-semibold sm:col-span-1">{option.term.toUpperCase()}</span>
                          {(["loading", "transport", "unloading"] as const).map((step) => {
                            const who = RESPONSIBILITIES[option.term][step];
                            return (
                              <span
                                key={step}
                                className={`grid min-h-11 min-w-0 content-center rounded-lg px-1.5 py-1 text-center leading-tight break-words hyphens-auto ${who === "offerer" ? "bg-brand text-white" : "border border-ink/25 bg-canvas text-ink"}`}
                              >
                                <span className="block font-medium">{d[step]}</span>
                                <span className="block">{party(who)}</span>
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[13px] leading-normal text-muted">{d.responsibilityNote}</p>
                  </div>
                )}
                {custom && (
                  <div className="rounded-xl border border-line bg-canvas px-4 py-3">
                    <p className="text-[15px] font-semibold">{t.labels.deliveryTerm.custom.name}</p>
                    <p className="text-[13px] text-muted">{d.notIncoterm}</p>
                    {custom.customNote && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line">{custom.customNote}</p>}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>
        <div className={`${compatibility ? pair : "min-w-0"} max-lg:order-6`}>
          <Section title={d.evidence} icon={<FlaskIcon size={18} />} id="evidence">
            <Facts
              rows={[
                { label: d.evidenceStatus, value: offer.evidenceStatus ? (t.labels.evidence[offer.evidenceStatus as EvidenceStatus] ?? offer.evidenceStatus) : t.common.notStated },
                {
                  label: d.datasheet,
                  value: offer.datasheetAvailable
                    ? `${d.datasheetYes} · ${t.labels.documentAccess[offer.datasheetAccess as DocumentAccess] ?? offer.datasheetAccess}`
                    : d.datasheetNo,
                },
                { label: d.photos, value: offer.photosAvailable ? d.photosYes : null },
                { label: d.sample, value: t.labels.sample[offer.sampleAvailable as SampleAvailability] ?? offer.sampleAvailable },
              ]}
            />
            <p className="mt-3 flex items-start gap-2 text-[13px] leading-normal text-muted">
              <FileTextIcon size={15} className="mt-px flex-none" />
              {d.evidenceNote}
            </p>
          </Section>
          {compatibility}
        </div>
      </div>

      <div className={`${stack} max-lg:contents lg:col-span-4`}>
        <div className="min-w-0 max-lg:order-2">
          <Section title={d.keyFacts} icon={<InfoIcon size={18} />} id="key-facts">
            <KeyFacts rows={keyFacts} />
          </Section>
        </div>
        {contact && <div className="min-w-0 max-lg:order-7">{contact}</div>}
        <div className="min-w-0 max-lg:order-8">
          <Section title={d.supplier} icon={<BuildingIcon size={18} />} id="supplier" level={2}>
            <p className="text-[15px] font-semibold break-words">{offer.supplier.companyName}</p>
            <p className="text-[15px] break-words">{offer.supplier.name}</p>
            <p className="mt-1 text-[13px] text-muted">
              {t.labels.industry[offer.supplier.industry as Industry] ?? offer.supplier.industry} · {[offer.supplier.parkName, offer.supplier.city].filter(Boolean).join(", ")}
            </p>
            {offer.supplier.verified && (
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-normal">
                <ShieldCheckIcon size={16} className="mt-px flex-none" />
                <span>
                  <span className="font-semibold">{d.supplierVerified}.</span> {d.supplierVerifiedNote}
                </span>
              </p>
            )}
            {offer.supplier.capabilities.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {offer.supplier.capabilities.map((capability) => (
                  <li key={capability}>
                    <Badge>{t.labels.capability[capability as Capability] ?? capability}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-line pt-3 text-[15px]">
              <p className="font-medium">{d.contact}</p>
              {offer.supplier.contact ? (
                <p className="mt-1 leading-relaxed break-words">
                  {offer.supplier.contact.name}
                  <br />
                  <a href={`mailto:${offer.supplier.contact.email}`} className={linkClass}>
                    {offer.supplier.contact.email}
                  </a>
                  {offer.supplier.contact.phone && (
                    <>
                      <br />
                      {offer.supplier.contact.phone}
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-[13px] leading-normal text-muted">{d.contactHidden}</p>
              )}
            </div>
            {linkSupplier && (
              <p className="mt-3">
                <Link href={sitePath(offer.supplier.id)} className={`${linkClass} text-[15px]`}>
                  {d.viewProfile}
                </Link>
              </p>
            )}
          </Section>
        </div>
      </div>

      {offer.provenance === "synthetic" && (
        <div className="min-w-0 max-lg:order-9 lg:col-span-12">
          <Notice>{t.common.synthetic}</Notice>
        </div>
      )}
    </div>
  );
}
