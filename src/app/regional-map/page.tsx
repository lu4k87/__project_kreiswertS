// Public regional map and overview (PG-03, L1-020): park areas, sites that chose to be named, general material
// categories and simulated pathways. Everything comes from the public projection (publicMap) – this page cannot
// show a contact, an address, a quantity or a price, because the server never hands them over. The interactive
// map places parks only – listed sites are named in the park popup, never at an address.
import Link from "next/link";
import { headers } from "next/headers";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getCatalogue } from "@/server/dal/catalogue";
import { publicMap, type PublicMap } from "@/server/dal/map";
import { nameOf } from "@/server/domain/catalogue";
import { getViewerOrGuest } from "@/server/viewer";
import { Badge, EmptyState, Notice, PageHeader, Section, buttonInverse } from "@/components/ui/elements";
import { BuildingIcon, MapIcon, RecycleIcon, RefreshIcon } from "@/components/ui/icons";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROUTES } from "@/components/layout/links";
import { LiveMap } from "@/components/map/live-map";
import { CategoryTiles } from "@/components/offers/category-tiles";

async function load(): Promise<{ map: PublicMap; categories: Awaited<ReturnType<typeof getCatalogue>>["categories"] } | null> {
  try {
    const [map, catalogue] = await Promise.all([publicMap(), getCatalogue()]);
    return { map, categories: catalogue.categories };
  } catch (error) {
    console.error("Regional map: data could not be loaded", error instanceof Error ? error.name : "");
    return null; // the page still renders with a notice
  }
}

export default async function RegionalMapPage() {
  const locale = await getLocale();
  const t = messages[locale];
  const p = t.platform;
  const r = p.regional;
  const [viewer, data] = await Promise.all([getViewerOrGuest(await headers()), load()]);
  const parkOf = (id: number | null) => data?.map.parks.find((park) => park.id === id) ?? null;
  const parkName = (id: number | null) => parkOf(id)?.name ?? null;

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="public" current="regionalMap" isMember={viewer.role !== "guest"} />
      <main id="content" className="mx-auto grid w-full max-w-[1328px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        <PageHeader title={r.title} intro={r.lead} />
        <Notice>{r.publicNote}</Notice>
        {!data ? (
          <Notice tone="error">{p.common.loadError}</Notice>
        ) : (
          <>
            <Section title={r.parks} icon={<MapIcon size={18} />} id="parks">
              <LiveMap
                parks={data.map.parks.map((park) => ({
                  ...park,
                  lines: park.sites.length > 0 ? [`${p.map.listedSites}: ${park.sites.map((site) => `${site.companyName} – ${site.name}`).join(", ")}`] : [r.noSites],
                }))}
                pathways={data.map.pathways.flatMap((pathway) => {
                  const from = parkOf(pathway.fromParkId);
                  const to = parkOf(pathway.toParkId);
                  if (!from) return [];
                  return [{ code: pathway.code, from, to: to && to.id !== from.id ? to : null, title: locale === "de" ? pathway.titleDe : pathway.titleEn, lines: [`${from.name} ${r.fromTo} ${to?.name ?? r.noReceiver}`, p.about.simulated] }];
                })}
                label={r.mapLabel}
                t={p.map}
              />
              <p className="mt-3 max-w-[68ch] text-[13px] leading-normal text-pretty text-muted">
                {p.map.approx} {p.map.tiles}
              </p>
            </Section>

            <Section title={r.sites} icon={<BuildingIcon size={18} />} id="sites">
              <ul className="grid items-start gap-4 md:grid-cols-2">
                {data.map.parks.map((park) => (
                  <li key={park.id} className="grid content-start gap-2 rounded-xl border border-line p-4">
                    <h3 className="text-lg leading-snug font-semibold text-balance">{park.name}</h3>
                    <p className="text-[13px] text-muted">{park.city}</p>
                    {park.sites.length === 0 ? (
                      <p className="text-[15px]">{r.noSites}</p>
                    ) : (
                      <ul className="grid gap-1.5 text-[15px]">
                        {park.sites.map((site) => (
                          <li key={`${site.companyName}-${site.name}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words">
                              {site.companyName} – {site.name}
                            </span>
                            {site.provenance === "synthetic" && <Badge tone="outline">{p.common.demo}</Badge>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title={p.search.categoriesTitle} icon={<RecycleIcon size={18} />} id="categories">
              <CategoryTiles categories={data.categories} t={p} locale={locale} />
              <p className="mt-3 text-[15px]">
                <span className="font-semibold">{r.categories}:</span>{" "}
                {data.map.categories.length > 0 ? data.map.categories.map((category) => nameOf(category, locale)).join(", ") : r.noCategories}
              </p>
              <p className="mt-1 max-w-[68ch] text-[13px] leading-normal text-pretty text-muted">{p.search.categoriesNote}</p>
            </Section>

            <Section title={r.flows} icon={<RefreshIcon size={18} />} id="flows">
              <p className="max-w-[68ch] text-[15px] leading-relaxed text-pretty">{r.flowsNote}</p>
              {data.map.pathways.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title={r.noCategories} />
                </div>
              ) : (
                <ul className="mt-4 grid items-start gap-3 md:grid-cols-2">
                  {data.map.pathways.map((pathway) => (
                    <li key={pathway.code} className="grid content-start gap-2 rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-7 flex-none place-items-center rounded-full border border-ink text-[13px] font-semibold">{pathway.code}</span>
                        <Badge tone="attention">{p.about.simulated}</Badge>
                        <Badge>{p.labels.pathway[pathway.pathway]}</Badge>
                      </div>
                      <h3 className="text-lg leading-snug font-semibold text-balance">{locale === "de" ? pathway.titleDe : pathway.titleEn}</h3>
                      <p className="text-[15px] leading-relaxed text-pretty">{locale === "de" ? pathway.textDe : pathway.textEn}</p>
                      <p className="text-[13px] text-muted">
                        {parkName(pathway.fromParkId) ?? p.common.notStated} {r.fromTo} {parkName(pathway.toParkId) ?? r.noReceiver}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-brand p-5 text-white sm:p-6">
          <p className="min-w-[14rem] flex-1 text-[15px] leading-relaxed">{r.membersCta}</p>
          <Link href={viewer.role === "guest" ? ROUTES.register : ROUTES.map} className={buttonInverse}>
            {viewer.role === "guest" ? p.nav.registerCompany : p.nav.map}
          </Link>
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
