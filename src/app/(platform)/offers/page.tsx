// Material offers (PG-09): local search in the own industrial park, wider search by radius with the same filters,
// result cards, link to the map view. Verified sites and the administrator.
import Link from "next/link";
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { searchOffers } from "@/server/dal/offers";
import { offerSearchQuery } from "@/server/validation/offers";
import { EmptyState, Notice, PageHeader, Section, buttonSecondary } from "@/components/ui/elements";
import { MapIcon, PackageIcon, RecycleIcon, SearchIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { CategoryTiles } from "@/components/offers/category-tiles";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { SearchFilters, searchParamsOf } from "@/components/offers/search-filters";
import { platformPage } from "../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OffersPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.offers);
  const p = page.t.platform;
  if (page.blocked) return <><PageHeader title={p.search.title} />{page.blocked}</>;

  const parsed = offerSearchQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : offerSearchQuery.parse({}); // an invalid filter counts as no filter
  const [result, catalogue, parks] = await Promise.all([searchOffers(page.viewer, query), getCatalogue(), listParks()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const s = p.search;
  const ownPark = page.viewer.role === "member" && page.viewer.site.parkId != null;
  const heading =
    result.scope === "radius"
      ? `${s.resultsRadius} ${result.radiusKm} km: ${result.total}`
      : result.park
        ? `${s.resultsPark} ${result.park.name}: ${result.total}`
        : `${s.resultsAll}: ${result.total}`;

  return (
    <>
      <PageHeader
        title={s.title}
        intro={s.intro}
        actions={
          <Link href={`${ROUTES.map}?${searchParamsOf(query)}`} className={buttonSecondary}>
            <MapIcon size={18} />
            {s.viewMap}
          </Link>
        }
      />

      <Section title={s.categoriesTitle} icon={<RecycleIcon size={18} />} id="categories">
        <CategoryTiles categories={catalogue.categories} t={p} locale={page.locale} />
        <p className="mt-3 max-w-[68ch] text-[13px] leading-normal text-pretty text-muted">{s.categoriesNote}</p>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <SearchFilters action={ROUTES.offers} query={query} catalogue={catalogue} parks={parks} t={p} locale={page.locale} hasOwnPark={ownPark} />

        <section className="grid min-w-0 gap-4" aria-labelledby="results">
          {result.needsArea ? (
            <Notice tone="attention" title={s.needsAreaTitle}>
              {s.needsAreaText}
            </Notice>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <h2 id="results" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] text-balance">
                  {heading}
                </h2>
                {result.scope === "park" ? (
                  <Link href={`${ROUTES.offers}?${searchParamsOf(query, { scope: "radius" })}`} className={buttonSecondary}>
                    <SearchIcon size={18} />
                    {s.widen}
                  </Link>
                ) : (
                  <Link href={`${ROUTES.offers}?${searchParamsOf(query, { scope: "park" })}`} className={buttonSecondary}>
                    {s.backToPark}
                  </Link>
                )}
              </div>
              {result.scope === "park" && <p className="text-[13px] text-muted">{s.widenText}</p>}
              {result.originUnknown && <Notice tone="attention">{s.originUnknown}</Notice>}
              {result.withoutLocation > 0 && (
                <p className="text-[13px] text-muted">
                  {s.withoutLocation}: {result.withoutLocation}
                </p>
              )}
              {result.offers.length === 0 ? (
                <EmptyState
                  icon={<PackageIcon size={20} />}
                  title={s.none}
                  text={result.scope === "park" ? s.noneLocalHint : s.noneWiderHint}
                  action={
                    result.scope === "radius" &&
                    page.viewer.role === "member" && (
                      <Link href={ROUTES.newRequest} className={buttonSecondary}>
                        {p.nav.createRequest}
                      </Link>
                    )
                  }
                />
              ) : (
                <ul className="grid gap-4">
                  {result.offers.map((offer) => (
                    <li key={offer.id}>
                      <OfferCard offer={offer} t={p} locale={page.locale} format={format} showDistance={page.viewer.role === "member"} />
                    </li>
                  ))}
                </ul>
              )}
              {result.total > result.offers.length && (
                <p className="text-[13px] text-muted">
                  {s.limited} {result.offers.length}.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
