// Company directory (PG-11, L1-018): verified sites with their capabilities, park and number of active offers.
// Filters live in the URL (plain GET form).
import Link from "next/link";
import { listParks } from "@/server/dal/catalogue";
import { listSites } from "@/server/dal/sites";
import { CAPABILITIES, INDUSTRIES, type Capability, type Industry } from "@/server/domain/listing";
import { siteDirectoryQuery } from "@/server/validation/sites";
import { Badge, EmptyState, PageHeader, buttonPrimary, linkClass } from "@/components/ui/elements";
import { Field, Select, TextInput } from "@/components/ui/form";
import type { ReactNode } from "react";
import { BuildingIcon, DiscIcon, FactoryIcon, LayersIcon, MapPinIcon, PackageIcon, RecycleIcon, ScissorsIcon, SearchIcon, SortIcon, TruckIcon } from "@/components/ui/icons";
import { INDUSTRY_PHOTOS, StockPhoto } from "@/components/ui/material-photo";
import { ROUTES, sitePath } from "@/components/layout/links";
import { platformPage } from "../gate";

// Decision of 2026-11-28 (preview Firma:A + Firma:C): an example picture of the kind of company on top of the card,
// the kind of company and every processing step with its own symbol.
const INDUSTRY_ICONS: Record<string, ReactNode> = {
  manufacturing: <FactoryIcon size={18} />, recycling: <RecycleIcon size={18} />, packaging: <PackageIcon size={18} />,
  construction: <BuildingIcon size={18} />, logistics: <TruckIcon size={18} />, other: <BuildingIcon size={18} />,
};
const CAPABILITY_ICONS: Record<string, ReactNode> = {
  cutting: <ScissorsIcon size={15} />, grinding: <DiscIcon size={15} />, sorting: <SortIcon size={15} />, regranulation: <RecycleIcon size={15} />, compounding: <LayersIcon size={15} />,
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CompaniesPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.companies);
  const p = page.t.platform;
  const c = p.companies;
  if (page.blocked) return <><PageHeader title={c.title} />{page.blocked}</>;

  const parsed = siteDirectoryQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const [sites, parks] = await Promise.all([listSites(page.viewer, query), listParks()]);

  return (
    <>
      <PageHeader title={c.title} intro={c.intro} />
      <form method="get" action={ROUTES.companies} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <Field id="q" label={c.searchLabel}>
          <TextInput id="q" name="q" type="search" defaultValue={query.q ?? ""} maxLength={100} autoComplete="off" />
        </Field>
        <Field id="industry" label={c.industry}>
          <Select id="industry" name="industry" defaultValue={query.industry ?? ""}>
            <option value="">{p.common.all}</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {p.labels.industry[industry]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="capability" label={c.capability}>
          <Select id="capability" name="capability" defaultValue={query.capability ?? ""}>
            <option value="">{p.common.all}</option>
            {CAPABILITIES.map((capability) => (
              <option key={capability} value={capability}>
                {p.labels.capability[capability]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="parkId" label={c.park}>
          <Select id="parkId" name="parkId" defaultValue={query.parkId ?? ""}>
            <option value="">{p.common.all}</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </Select>
        </Field>
        <button type="submit" className={buttonPrimary}>
          <SearchIcon size={18} />
          {c.apply}
        </button>
      </form>

      <section className="grid gap-4" aria-labelledby="sites">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 id="sites" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
            {c.count}: {sites.length}
          </h2>
          <Link href={ROUTES.companies} className={`${linkClass} text-[15px]`}>
            {p.common.resetFilters}
          </Link>
        </div>
        {sites.length === 0 ? (
          <EmptyState icon={<BuildingIcon size={20} />} title={c.none} />
        ) : (
          <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => (
              <li key={site.id} className="grid content-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-5">
                {INDUSTRY_PHOTOS[site.industry] && (
                  <div className="relative -mx-5 -mt-5 mb-1">
                    <StockPhoto photo={INDUSTRY_PHOTOS[site.industry]} sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw" className="h-32 w-full rounded-none" />
                    <span className="absolute right-2 bottom-2 rounded-md bg-surface/90 px-2 py-0.5 text-[13px] text-ink">{c.examplePicture}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 text-lg leading-snug font-semibold text-balance break-words">
                    <Link href={sitePath(site.id)} className="rounded hover:underline">
                      {site.companyName} – {site.name}
                    </Link>
                  </h3>
                  {site.provenance === "synthetic" && <Badge tone="outline">{p.common.demo}</Badge>}
                </div>
                <p className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <span className="grid size-8 flex-none place-items-center rounded-lg bg-mint">{INDUSTRY_ICONS[site.industry] ?? <BuildingIcon size={18} />}</span>
                  {p.labels.industry[site.industry as Industry] ?? site.industry}
                </p>
                <p className="flex items-start gap-2 text-[15px]">
                  <MapPinIcon size={16} className="mt-0.5" />
                  {[site.parkName, site.city].filter(Boolean).join(", ")}
                </p>
                <p className="flex items-center gap-2 text-[15px]">
                  <PackageIcon size={16} />
                  {c.offers}: <span className="tabular-nums">{site.activeOffers}</span>
                </p>
                {site.capabilities.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {site.capabilities.map((capability) => (
                      <li key={capability}>
                        <Badge icon={CAPABILITY_ICONS[capability]}>{p.labels.capability[capability as Capability] ?? capability}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">{c.noCapabilities}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
