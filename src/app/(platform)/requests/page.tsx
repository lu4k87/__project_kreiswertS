// Material requests (PG-19, L2-002): open requests of other verified sites – own industrial park first, wider area
// by radius with the same filters. Verified sites and the administrator.
import Link from "next/link";
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { searchRequests } from "@/server/dal/requests";
import { requestSearchQuery } from "@/server/validation/requests";
import { EmptyState, Notice, PageHeader, buttonPrimary, buttonSecondary } from "@/components/ui/elements";
import { FileTextIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { RequestCard } from "@/components/requests/request-card";
import { RequestFilters, requestParamsOf } from "@/components/requests/request-filters";
import { platformPage } from "../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RequestsPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.requests);
  const p = page.t.platform;
  const r = p.requestSearch;
  if (page.blocked) return <><PageHeader title={r.title} />{page.blocked}</>;

  const parsed = requestSearchQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : requestSearchQuery.parse({});
  const [result, catalogue, parks] = await Promise.all([searchRequests(page.viewer, query), getCatalogue(), listParks()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const s = p.search;
  const member = page.viewer.role === "member";
  const heading =
    result.scope === "radius"
      ? `${r.resultsRadius} ${result.radiusKm} km: ${result.total}`
      : result.park
        ? `${r.resultsPark} ${result.park.name}: ${result.total}`
        : `${r.resultsAll}: ${result.total}`;

  return (
    <>
      <PageHeader
        title={r.title}
        intro={r.intro}
        actions={
          member && (
            <Link href={ROUTES.newRequest} className={buttonPrimary}>
              <PlusIcon size={18} />
              {p.nav.createRequest}
            </Link>
          )
        }
      />

      {/* Like the offer list (layout "Liste:B", user 2026-11-28): the filters as a bar at full width, then the
          requests as rows with fixed columns. */}
      <RequestFilters action={ROUTES.requests} query={query} catalogue={catalogue} parks={parks} t={p} locale={page.locale} hasOwnPark={member && page.viewer.role === "member" && page.viewer.site.parkId != null} />

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
                <Link href={`${ROUTES.requests}?${requestParamsOf(query, { scope: "radius" })}`} className={buttonSecondary}>
                  <SearchIcon size={18} />
                  {s.widen}
                </Link>
              ) : (
                <Link href={`${ROUTES.requests}?${requestParamsOf(query, { scope: "park" })}`} className={buttonSecondary}>
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
            {result.requests.length === 0 ? (
              <EmptyState icon={<FileTextIcon size={20} />} title={r.none} text={result.scope === "park" ? r.noneLocalHint : r.noneWiderHint} />
            ) : (
              <ul className="grid gap-4">
                {result.requests.map((request) => (
                  <li key={request.id}>
                    <RequestCard request={request} t={p} locale={page.locale} format={format} catalogue={catalogue} showDistance={member} layout="row" />
                  </li>
                ))}
              </ul>
            )}
            {result.total > result.requests.length && (
              <p className="text-[13px] text-muted">
                {s.limited} {result.requests.length}.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
