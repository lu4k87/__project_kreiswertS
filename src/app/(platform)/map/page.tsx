// Industrial map (PG-13): parks, verified sites and the offers of the same search as the list – same filters,
// same results (L1-019). Selecting a site (in the map or the list) shows its matching offers as previews.
import Link from "next/link";
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { memberMap } from "@/server/dal/map";
import type { Capability } from "@/server/domain/listing";
import { idParam } from "@/server/validation/common";
import { offerSearchQuery } from "@/server/validation/offers";
import { Badge, EmptyState, Notice, PageHeader, Section, buttonSecondary, linkClass } from "@/components/ui/elements";
import { BuildingIcon, MapIcon, PackageIcon } from "@/components/ui/icons";
import { ROUTES, sitePath } from "@/components/layout/links";
import { RegionMap, type MapMarker } from "@/components/map/region-map";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { SearchFilters, searchParamsOf } from "@/components/offers/search-filters";
import { platformPage } from "../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MapPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.map);
  const p = page.t.platform;
  const m = p.map;
  if (page.blocked) return <><PageHeader title={m.title} />{page.blocked}</>;

  const raw = await searchParams;
  const parsed = offerSearchQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : offerSearchQuery.parse({});
  const selectedId = idParam.safeParse(raw.site).data ?? null;
  const [data, catalogue, parks] = await Promise.all([memberMap(page.viewer, query), getCatalogue(), listParks()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const own = page.viewer.role === "member" ? page.viewer.site : null;
  const params = (site?: number) => searchParamsOf(query, { site });

  // Sites with matching offers first, then the own site, then the rest – numbered in that order.
  const sites = [...data.sites].sort((a, b) => Number(b.offerIds.length > 0) - Number(a.offerIds.length > 0) || Number(b.isOwn) - Number(a.isOwn) || a.name.localeCompare(b.name));
  const markers: MapMarker[] = sites.map((site, index) => ({
    id: site.id,
    number: index + 1,
    latitude: site.latitude,
    longitude: site.longitude,
    kind: site.isOwn ? "own" : site.offerIds.length > 0 ? "offers" : "plain",
    href: `${ROUTES.map}?${params(site.id)}#site-${site.id}`,
    title: `${site.companyName} – ${site.name}`,
    selected: site.id === selectedId,
  }));
  const radius = query.scope === "radius" && own?.latitude != null && own.longitude != null ? { latitude: own.latitude, longitude: own.longitude, km: query.radiusKm } : null;
  const parkName = (id: number | null) => data.parks.find((park) => park.id === id)?.name ?? null;

  return (
    <>
      <PageHeader
        title={m.title}
        intro={m.intro}
        actions={
          <Link href={`${ROUTES.offers}?${params()}`} className={buttonSecondary}>
            <PackageIcon size={18} />
            {p.search.viewList}
          </Link>
        }
      />

      <Section title={`${m.matching}: ${data.search.total}`} icon={<MapIcon size={18} />} id="map">
        <RegionMap parks={data.parks} markers={markers} radius={radius} label={m.label} t={m} parkHref={(id) => `${ROUTES.map}?${searchParamsOf(query, { scope: "park", parkId: id })}`} />
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]" aria-label={m.legend}>
          <li className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-brand text-[13px] leading-none font-semibold text-white">1</span>
            {m.legendSiteOffers}
          </li>
          <li className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full border border-ink bg-surface text-[13px] leading-none font-semibold">2</span>
            {m.legendSite}
          </li>
          {own && (
            <li className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full border-2 border-dashed border-surface bg-brand text-[13px] leading-none font-semibold text-white outline outline-1 outline-ink">3</span>
              {m.legendOwn}
            </li>
          )}
          {radius && (
            <li className="flex items-center gap-2">
              <span className="size-5 rounded-full border border-dashed border-ink" aria-hidden="true" />
              {m.legendRadius}
            </li>
          )}
        </ul>
        {data.search.needsArea && (
          <div className="mt-4">
            <Notice tone="attention" title={p.search.needsAreaTitle}>{p.search.needsAreaText}</Notice>
          </div>
        )}
        {data.search.originUnknown && (
          <div className="mt-4">
            <Notice tone="attention">{p.search.originUnknown}</Notice>
          </div>
        )}
        {(data.search.withoutLocation > 0 || data.sitesWithoutLocation > 0) && (
          <p className="mt-3 text-[13px] leading-normal text-muted">
            {[data.search.withoutLocation > 0 && `${m.missing}: ${data.search.withoutLocation}`, data.sitesWithoutLocation > 0 && `${m.sitesMissing}: ${data.sitesWithoutLocation}`].filter(Boolean).join(" · ")}
          </p>
        )}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <SearchFilters action={ROUTES.map} query={query} catalogue={catalogue} parks={parks} t={p} locale={page.locale} hasOwnPark={own?.parkId != null} />

        <Section title={m.sites} icon={<BuildingIcon size={18} />} id="sites">
          {sites.length === 0 ? (
            <EmptyState title={m.noSites} />
          ) : (
            <ol className="grid gap-3">
              {sites.map((site, index) => {
                const offers = data.search.offers.filter((offer) => site.offerIds.includes(offer.id));
                const selected = site.id === selectedId;
                return (
                  <li key={site.id} id={`site-${site.id}`} className={`grid scroll-mt-6 gap-3 rounded-xl border p-4 ${selected ? "border-ink bg-canvas" : "border-line"}`}>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <span className={`grid size-7 flex-none place-items-center rounded-full text-[13px] font-semibold ${site.offerIds.length > 0 || site.isOwn ? "bg-brand text-white" : "border border-ink bg-surface"}`}>{index + 1}</span>
                      <div className="min-w-[12rem] flex-1">
                        <h3 className="text-lg leading-snug font-semibold break-words">
                          {site.companyName} – {site.name}
                        </h3>
                        <p className="text-[13px] text-muted">{parkName(site.parkId) ?? p.common.notStated}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {site.isOwn && <Badge tone="solid">{p.search.yourSite}</Badge>}
                        {selected && <Badge tone="outline">{m.selected}</Badge>}
                        {site.provenance === "synthetic" && <Badge tone="outline">{p.common.demo}</Badge>}
                      </div>
                    </div>
                    {site.capabilities.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {site.capabilities.map((capability) => (
                          <li key={capability}>
                            <Badge>{p.labels.capability[capability as Capability] ?? capability}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
                      <span>
                        {m.matching}: {offers.length}
                      </span>
                      {!selected && (
                        <Link href={`${ROUTES.map}?${params(site.id)}#site-${site.id}`} className={linkClass}>
                          {m.showOnMap}
                        </Link>
                      )}
                      <Link href={sitePath(site.id)} className={linkClass}>
                        {m.viewSite}
                      </Link>
                    </p>
                    {offers.length > 0 &&
                      (selected ? (
                        <ul className="grid gap-3">
                          {offers.map((offer) => (
                            <li key={offer.id}>
                              <OfferCard offer={offer} t={p} locale={page.locale} format={format} showDistance={own !== null} headingLevel={4} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="grid gap-1 text-[15px]">
                          {offers.map((offer) => (
                            <li key={offer.id} className="flex flex-wrap gap-x-3">
                              <Link href={`/offers/${offer.id}`} className={linkClass}>
                                {offer.title}
                              </Link>
                              <span className="tabular-nums">{format.quantity(offer.quantity, offer.unitKey)}</span>
                            </li>
                          ))}
                        </ul>
                      ))}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
