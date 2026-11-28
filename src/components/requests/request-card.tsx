// Result card of a material request (L2-002): the same in the request search, under My requests and on the
// dashboard. Shows only what the server put into the card projection (src/server/dal/request-view.ts).
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { Catalogue } from "@/server/domain/catalogue";
import type { ClosureReason } from "@/server/domain/listing";
import type { RequestCard as RequestCardData } from "@/server/dal/request-view";
import { Badge } from "@/components/ui/elements";
import { BuildingIcon, CalendarIcon, LayersIcon, MapPinIcon, SearchIcon, TruckIcon } from "@/components/ui/icons";
import { FormPhotos } from "@/components/ui/material-photo";
import { requestPath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";
import { deliveryList, maxPrice, names } from "./format-request";

type Props = {
  request: RequestCardData;
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
  catalogue: Pick<Catalogue, "units">;
  /** Hide the distance where there is no searching site (My requests). */
  showDistance?: boolean;
  /** Extra line in the badge row, e.g. the comparison result. */
  badge?: ReactNode;
  footer?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** "row" (request list only): from 1024 px one full-width row with fixed columns – title, the three facts,
   *  details – so the same fact sits at the same place in every row. "split" (matches list only): from 1024 px
   *  title and facts left, details right, footer below both. Below 1024 px both are the card as everywhere else. */
  layout?: "card" | "row" | "split";
};

export function RequestCard({ request, t, locale, format, catalogue, showDistance = true, badge, footer, headingLevel = 3, layout = "card" }: Props) {
  const row = layout === "row";
  const split = layout === "split";
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const c = t.requestCard;
  const types = names(request.types, locale, t.common.notStated);
  const forms = names(request.forms, locale, c.anyForm);

  return (
    <article className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:p-5">
      {/* Pictures of all accepted forms with a "wanted" band (decision of 2026-11-28, preview Gesuch:B): same frame as
          the offer card, but the band says the material is sought, not available. */}
      <FormPhotos forms={request.forms.map((form) => form.key)} sizes="120px" className="hidden h-[5.625rem] w-[7.5rem] sm:grid">
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-brand py-0.5 text-[13px] font-semibold text-white">
          <SearchIcon size={13} strokeWidth={2.2} />
          {c.wanted}
        </span>
      </FormPhotos>
      <div
        className={`grid min-w-0 gap-3 ${
          row ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] lg:items-start lg:gap-x-7" : split ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-x-7" : ""
        }`}
      >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Heading className={`leading-snug font-semibold text-balance break-words ${headingLevel === 4 ? "text-base" : "text-lg"}`}>
            <Link href={requestPath(request.id)} className="rounded hover:underline">
              {request.title}
            </Link>
          </Heading>
          <p className="mt-0.5 text-[13px] text-muted">
            {types} · <span translate="no">{request.ref}</span>
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-1.5">
          {badge}
          {request.status !== "active" && <Badge tone={request.status === "draft" ? "outline" : "attention"}>{t.labels.offerStatus[request.status]}</Badge>}
          {request.closureReason && <Badge tone="outline">{t.l2labels.closureReason[request.closureReason as ClosureReason]}</Badge>}
          {request.provenance === "synthetic" && <Badge tone="outline">{t.common.demo}</Badge>}
        </div>
      </div>

      <dl className={`grid min-w-0 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3 ${row ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] lg:gap-x-4" : ""}`}>
        <div className="min-w-0">
          <dt className="text-[13px] text-muted">{c.needed}</dt>
          <dd className="font-semibold tabular-nums">{format.quantity(request.quantity, request.unitKey)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] text-muted">{t.requestDetail.frequency}</dt>
          <dd className="font-semibold break-words hyphens-auto">{format.frequency(request.frequency, request.recurrencePeriod)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] text-muted">{c.maxPrice}</dt>
          <dd className="font-semibold tabular-nums">{maxPrice(request.maxPriceAmount, request.maxPriceUnitKey, locale, t, catalogue)}</dd>
        </div>
      </dl>

      <ul className={`grid min-w-0 gap-1.5 text-[13px] leading-normal ${split ? "lg:col-start-2 lg:row-span-2 lg:row-start-1" : ""}`}>
        <li className="flex items-start gap-2">
          <LayersIcon size={15} className="mt-px" />
          <span className="min-w-0 break-words">
            {c.accepts}: {forms}
            {request.minLot != null && ` · ${c.minLot} ${format.quantity(request.minLot, request.unitKey)}`}
          </span>
        </li>
        {request.deliveryTerms.length > 0 && (
          <li className="flex items-start gap-2">
            <TruckIcon size={15} className="mt-px" />
            <span>{deliveryList(request.deliveryTerms, t)}</span>
          </li>
        )}
        {request.neededUntil && (
          <li className="flex items-start gap-2">
            <CalendarIcon size={15} className="mt-px" />
            <span>
              {c.neededBy} {format.date(request.neededUntil)}
            </span>
          </li>
        )}
        <li className="flex items-start gap-2">
          <BuildingIcon size={15} className="mt-px" />
          <span className="min-w-0 break-words">
            {request.site.companyName} – {request.site.name}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <MapPinIcon size={15} className="mt-px" />
          <span>
            {[request.site.parkName, request.site.city].filter(Boolean).join(", ")}
            {showDistance && ` · ${format.distance(request.distanceKm, request.hasLocation)}`}
          </span>
        </li>
      </ul>
        {(row || split) && footer ? <div className={row ? "lg:col-span-3" : "lg:col-span-2"}>{footer}</div> : footer}
      </div>
    </article>
  );
}
