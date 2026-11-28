// Result card of an offer (L1-015): the same in the search list, on the map, on site profiles and under My offers.
// Shows only what the server put into the card projection (src/server/dal/offer-view.ts).
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf } from "@/server/domain/catalogue";
import { deliveryMode } from "@/server/domain/delivery";
import type { Origin } from "@/server/domain/listing";
import type { OfferCard as OfferCardData } from "@/server/dal/offer-view";
import { Badge } from "@/components/ui/elements";
import { BuildingIcon, CalendarIcon, MapPinIcon, RefreshIcon, TruckIcon } from "@/components/ui/icons";
import { offerPath } from "@/components/layout/links";
import { FormIllustration } from "./form-illustration";
import type { Formatters } from "./format";

type Props = {
  offer: OfferCardData;
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
  /** Link of the title; default: the offer detail page. */
  href?: string;
  /** Hide the distance where there is no searching site (My offers, the administrator). */
  showDistance?: boolean;
  /** Buttons or extra lines under the card (My offers). */
  footer?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** "row" (offer list only): from 1024 px one full-width row with fixed columns – image, title, the three facts,
   *  details – so the same fact sits at the same place in every row. Below that the card as everywhere else. */
  layout?: "card" | "row";
};

export function OfferCard({ offer, t, locale, format, href, showDistance = true, footer, headingLevel = 3, layout = "card" }: Props) {
  const row = layout === "row";
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const price = format.price(offer);
  const material = [offer.type && nameOf(offer.type, locale), offer.form && nameOf(offer.form, locale)].filter(Boolean).join(" · ");
  const collects = offer.deliveryTerms.some((term) => deliveryMode(term) === "collection");
  const delivers = offer.deliveryTerms.some((term) => deliveryMode(term) === "delivered");
  const handover = [collects && t.search.deliveryCollection, delivers && t.search.deliveryDelivered].filter(Boolean).join(" · ");

  return (
    <article
      className={`grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:p-5 ${
        row ? "lg:grid-cols-[4.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] lg:items-start lg:gap-x-7" : ""
      }`}
    >
      <FormIllustration form={offer.form?.key} className={`hidden h-[5.4rem] w-[7.5rem] sm:block ${row ? "lg:h-[3.25rem] lg:w-[4.5rem]" : ""}`} />
      {/* row: the three blocks below become columns of the article */}
      <div className={`grid min-w-0 gap-3 ${row ? "lg:contents" : ""}`}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <Heading className={`leading-snug font-semibold text-balance break-words ${headingLevel === 4 ? "text-[15px]" : "text-lg"}`}>
              <Link href={href ?? offerPath(offer.id)} className="rounded hover:underline">
                {offer.title}
              </Link>
            </Heading>
            <p className="mt-0.5 text-[13px] text-muted">
              {material || t.common.notStated} · <span translate="no" className="whitespace-nowrap">{offer.ref}</span>
            </p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-1.5">
            {offer.urgent && offer.status === "active" && (
              <Badge tone="attention" icon={<CalendarIcon size={14} />}>
                {t.search.urgent}
              </Badge>
            )}
            {offer.status !== "active" && <Badge tone={offer.status === "draft" ? "outline" : "attention"}>{t.labels.offerStatus[offer.status]}</Badge>}
            {offer.provenance === "synthetic" && <Badge tone="outline">{t.common.demo}</Badge>}
          </div>
        </div>

        <dl className={`grid min-w-0 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3 ${row ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-4" : ""}`}>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{t.search.available}</dt>
            <dd className="font-semibold tabular-nums">{format.quantity(offer.quantity, offer.unitKey)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{t.detail.price}</dt>
            <dd className="font-semibold tabular-nums">{price.main}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{t.offerForm.frequency}</dt>
            <dd className="font-semibold break-words hyphens-auto">{format.frequency(offer.frequency, offer.recurrencePeriod)}</dd>
          </div>
        </dl>

        <ul className="grid min-w-0 gap-1.5 text-[13px] leading-normal">
          {offer.frequency === "recurring" && offer.recurrenceQuantity != null && (
            <li className="flex items-start gap-2">
              <RefreshIcon size={15} className="mt-px flex-none" />
              <span>
                {t.search.expected}: {format.quantity(offer.recurrenceQuantity, offer.unitKey)} {offer.recurrencePeriod ? t.labels.period[offer.recurrencePeriod as keyof typeof t.labels.period] : ""}
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <TruckIcon size={15} className="mt-px flex-none" />
            <span>
              {handover || t.common.notStated}
              {offer.deliveryTerms.length > 0 && ` (${offer.deliveryTerms.filter((term) => term !== "custom").map((term) => term.toUpperCase()).join(", ") || t.detail.byArrangement})`}
            </span>
          </li>
          {offer.collectionUntil && (
            <li className="flex items-start gap-2">
              <CalendarIcon size={15} className="mt-px flex-none" />
              <span>
                {t.search.collectBy} {format.date(offer.collectionUntil)}
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <BuildingIcon size={15} className="mt-px flex-none" />
            <span className="min-w-0 break-words">
              {offer.site.companyName} – {offer.site.name}
              {offer.origin && ` · ${t.labels.origin[offer.origin as Origin] ?? offer.origin}`}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MapPinIcon size={15} className="mt-px flex-none" />
            <span>
              {[offer.site.parkName, offer.site.city].filter(Boolean).join(", ")}
              {showDistance && ` · ${format.distance(offer.distanceKm, offer.hasLocation)}`}
            </span>
          </li>
        </ul>
        {row && footer ? <div className="lg:col-span-3 lg:col-start-2">{footer}</div> : footer}
      </div>
    </article>
  );
}
