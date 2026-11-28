// Industrial map (PG-13): an interactive map of parks, verified sites, the offers of the same search as the list –
// same filters, same results (L1-019) – the open requests of the same area (Level 2) and the potential collection
// groups of the matching offers (L2-010). Selecting a site (in the map or the list) shows its offers and requests;
// highlighting a group marks its sites on the map. The list below repeats everything the map shows.
import Link from "next/link";
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { memberMap } from "@/server/dal/map";
import type { CollectionGroup } from "@/server/domain/aggregation";
import { nameOf } from "@/server/domain/catalogue";
import type { Capability, Origin, RecurrencePeriod } from "@/server/domain/listing";
import { idParam } from "@/server/validation/common";
import { offerSearchQuery } from "@/server/validation/offers";
import { Badge, EmptyState, Notice, PageHeader, Section, buttonSecondary, linkClass } from "@/components/ui/elements";
import { BuildingIcon, LayersIcon, MapIcon, PackageIcon } from "@/components/ui/icons";
import { ROUTES, offerPath, requestPath, sitePath } from "@/components/layout/links";
import { LiveMap, type LiveMapMarker } from "@/components/map/live-map";
import { markerClass, type MarkerKind } from "@/components/map/marker-style";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { SearchFilters, searchParamsOf } from "@/components/offers/search-filters";
import { platformPage } from "../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const GROUP_KEY = /^\d{1,9}-\d{1,9}$/;

export default async function MapPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.map);
  const p = page.t.platform;
  const m = p.map;
  if (page.blocked) return <><PageHeader title={m.title} />{page.blocked}</>;

  const raw = await searchParams;
  const parsed = offerSearchQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : offerSearchQuery.parse({});
  const selectedId = idParam.safeParse(raw.site).data ?? null;
  const groupKey = typeof raw.group === "string" && GROUP_KEY.test(raw.group) ? raw.group : null;
  const [data, catalogue, parks] = await Promise.all([memberMap(page.viewer, query), getCatalogue(), listParks()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const own = page.viewer.role === "member" ? page.viewer.site : null;
  const params = (overrides: { site?: number; group?: string } = {}) => searchParamsOf(query, { group: groupKey ?? undefined, ...overrides });

  const groups = data.aggregation.groups.filter((group) => group.offerIds.length > 1);
  const singles = data.aggregation.groups.length - groups.length;
  const highlighted = groups.find((group) => group.key === groupKey) ?? null;
  const materialName = (group: CollectionGroup) =>
    [catalogue.types.find((type) => type.id === group.typeId), catalogue.forms.find((form) => form.id === group.formId)]
      .map((entry) => (entry ? nameOf(entry, page.locale) : p.common.notStated))
      .join(" · ");

  // Sites with matching offers or requests first, then the own site, then the rest – numbered in that order.
  const active = (site: (typeof data.sites)[number]) => site.offerIds.length > 0 || site.requestIds.length > 0;
  const sites = [...data.sites].sort((a, b) => Number(active(b)) - Number(active(a)) || Number(b.isOwn) - Number(a.isOwn) || a.name.localeCompare(b.name));
  const kindOf = (site: (typeof sites)[number]): MarkerKind =>
    site.isOwn ? "own" : site.offerIds.length > 0 && site.requestIds.length > 0 ? "both" : site.offerIds.length > 0 ? "offers" : site.requestIds.length > 0 ? "requests" : "plain";
  const parkName = (id: number | null) => data.parks.find((park) => park.id === id)?.name ?? null;
  const counts = (site: (typeof sites)[number]) => `${m.matching}:\u00a0${site.offerIds.length} · ${m.requests}:\u00a0${site.requestIds.length}`;

  const markers: LiveMapMarker[] = sites.map((site, index) => ({
    id: site.id,
    label: String(index + 1),
    latitude: site.latitude,
    longitude: site.longitude,
    kind: kindOf(site),
    title: site.companyName,
    subtitle: site.name,
    place: parkName(site.parkId) ?? p.common.notStated,
    stats: [
      { label: m.matching, value: String(site.offerIds.length) },
      { label: m.requests, value: String(site.requestIds.length) },
    ],
    lines: [],
    links: [
      { href: `${ROUTES.map}?${params({ site: site.id })}#site-${site.id}`, label: m.showInList },
      { href: sitePath(site.id), label: m.viewSite },
    ],
    selected: site.id === selectedId,
    highlighted: highlighted?.siteIds.includes(site.id) ?? false,
  }));
  const mapParks = data.parks.map((park) => ({
    ...park,
    links: [{ href: `${ROUTES.map}?${searchParamsOf(query, { scope: "park", parkId: park.id })}`, label: m.searchPark }],
  }));
  const radius = query.scope === "radius" && own?.latitude != null && own.longitude != null ? { latitude: own.latitude, longitude: own.longitude, km: query.radiusKm } : null;

  const legend: { kind: MarkerKind; label: string; show: boolean }[] = [
    { kind: "offers", label: m.legendSiteOffers, show: true },
    { kind: "requests", label: m.legendSiteRequests, show: true },
    { kind: "both", label: m.legendSiteBoth, show: true },
    { kind: "plain", label: m.legendSite, show: true },
    { kind: "own", label: m.legendOwn, show: own !== null },
  ];

  return (
    <>
      <PageHeader
        title={m.title}
        intro={m.intro}
        actions={
          <Link href={`${ROUTES.offers}?${searchParamsOf(query)}`} className={buttonSecondary}>
            <PackageIcon size={18} />
            {p.search.viewList}
          </Link>
        }
      />

      <Section title={`${m.matching}: ${data.search.total} · ${m.requests}: ${data.requests.total}`} icon={<MapIcon size={18} />} id="map">
        <LiveMap parks={mapParks} markers={markers} radius={radius} label={m.label} t={m} interactive />
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]" aria-label={m.legend}>
          {legend
            .filter((entry) => entry.show)
            .map((entry) => (
              <li key={entry.kind} className="flex items-center gap-2">
                <span className={`${markerClass(entry.kind)} pointer-events-none size-6! shadow-none`} aria-hidden="true" />
                {entry.label}
              </li>
            ))}
          <li className="flex items-center gap-2">
            <span className="size-6 flex-none rounded-full border-2 border-map-park bg-map-park/30" aria-hidden="true" />
            {m.legendPark}
          </li>
          {radius && (
            <li className="flex items-center gap-2">
              <span className="size-6 flex-none rounded-full border-2 border-dashed border-map-radius" aria-hidden="true" />
              {m.legendRadius}
            </li>
          )}
          {highlighted && (
            <li className="flex items-center gap-2">
              <span className={`${markerClass("offers", true)} pointer-events-none !size-6`} aria-hidden="true" />
              {m.legendHighlight}
            </li>
          )}
        </ul>
        <p className="prose-justify mt-3 text-[13px] leading-normal text-muted">
          {m.approx} {m.requestsNote} {m.tiles}
        </p>
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

      <Section title={m.groups} icon={<LayersIcon size={18} />} id="groups">
        <p className="prose-justify text-[15px] leading-relaxed">{m.groupsIntro}</p>
        {groups.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={m.noGroups} />
          </div>
        ) : (
          <ul className="mt-4 grid items-start gap-4 md:grid-cols-2">
            {groups.map((group) => {
              const isHighlighted = group.key === highlighted?.key;
              const groupOffers = data.search.offers.filter((offer) => group.offerIds.includes(offer.id));
              return (
                <li key={group.key} className={`grid content-start gap-3 rounded-xl border p-4 ${isHighlighted ? "border-ink bg-canvas" : "border-line"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <h3 className="min-w-0 text-lg leading-snug font-semibold text-balance">{materialName(group)}</h3>
                    {isHighlighted && <Badge tone="outline">{m.selected}</Badge>}
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[28px] leading-tight font-semibold whitespace-nowrap tabular-nums">{format.quantity(group.currentKg, "kg")}</span>
                    <span className="text-[15px]">{m.groupNow}</span>
                  </p>
                  {Object.entries(group.recurringKg).length > 0 && (
                    <ul className="grid gap-1 text-[15px]">
                      {Object.entries(group.recurringKg).map(([period, kg]) => (
                        <li key={period}>
                          <span className="font-semibold whitespace-nowrap tabular-nums">+ {format.quantity(kg ?? 0, "kg")}</span> {m.groupPer[period as RecurrencePeriod]}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[13px] leading-normal text-muted">
                    {m.groupBatches}: {group.offerIds.length} · {m.groupSites}: {group.siteIds.length} · {m.groupOrigins}:{" "}
                    {Object.entries(group.origins)
                      .map(([origin, count]) => `${p.labels.origin[origin as Origin]} ${count}`)
                      .join(", ")}
                  </p>
                  <ul className="grid gap-1 text-[15px]">
                    {groupOffers.map((offer) => (
                      <li key={offer.id} className="flex flex-wrap gap-x-3">
                        <Link href={offerPath(offer.id)} className={linkClass}>
                          {offer.title}
                        </Link>
                        <span className="whitespace-nowrap tabular-nums">{format.quantity(offer.quantity, offer.unitKey)}</span>
                        {group.notComparable.includes(offer.id) && <span className="text-[13px] text-muted">{m.groupNotComparable}</span>}
                      </li>
                    ))}
                  </ul>
                  <p>
                    <Link href={`${ROUTES.map}?${params({ group: isHighlighted ? undefined : group.key })}#map`} className={linkClass}>
                      {isHighlighted ? m.groupHide : m.groupShow}
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {(singles > 0 || data.aggregation.excluded > 0) && (
          <p className="mt-3 text-[13px] leading-normal text-muted">
            {[singles > 0 && `${m.groupSingles}: ${singles}`, data.aggregation.excluded > 0 && `${m.groupExcluded}: ${data.aggregation.excluded}`].filter(Boolean).join(" · ")}
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
                const requests = data.requests.requests.filter((request) => site.requestIds.includes(request.id));
                const selected = site.id === selectedId;
                return (
                  <li key={site.id} id={`site-${site.id}`} className={`grid scroll-mt-6 gap-3 rounded-xl border p-4 ${selected ? "border-ink bg-canvas" : "border-line"}`}>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <span className={`${markerClass(kindOf(site), highlighted?.siteIds.includes(site.id))} pointer-events-none size-7! shadow-none`} aria-hidden="true">
                        {index + 1}
                      </span>
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
                      <span>{counts(site)}</span>
                      {!selected && (
                        <Link href={`${ROUTES.map}?${params({ site: site.id })}#map`} className={linkClass}>
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
                              <Link href={offerPath(offer.id)} className={linkClass}>
                                {offer.title}
                              </Link>
                              <span className="whitespace-nowrap tabular-nums">{format.quantity(offer.quantity, offer.unitKey)}</span>
                            </li>
                          ))}
                        </ul>
                      ))}
                    {requests.length > 0 && (
                      <div className="grid gap-1">
                        <h4 className="text-base leading-snug font-semibold">{m.requests}</h4>
                        <ul className="grid gap-1 text-[15px]">
                          {requests.map((request) => (
                            <li key={request.id} className="flex flex-wrap gap-x-3">
                              <Link href={requestPath(request.id)} className={linkClass}>
                                {request.title}
                              </Link>
                              <span className="whitespace-nowrap tabular-nums">{format.quantity(request.quantity, request.unitKey)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
