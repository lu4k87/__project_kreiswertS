// Matches (PG-21, L2-005): the own active requests with the offers of other sites that fit, and the own active
// offers with the requests that fit – each with its explained result. Incompatible pairs are counted, not listed.
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { listMatches } from "@/server/dal/matches";
import { EmptyState, PageHeader, Section, buttonQuiet, grid12 } from "@/components/ui/elements";
import { FileTextIcon, PackageIcon } from "@/components/ui/icons";
import { ROUTES, matchPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { MatchBadge } from "@/components/matches/match-badge";
import { matchFacts } from "@/components/matches/own-match-list";
import { ListingTabs } from "@/components/requests/listing-tabs";
import { RequestCard } from "@/components/requests/request-card";
import { platformPage } from "../gate";

export default async function MatchesPage() {
  const page = await platformPage("site", ROUTES.matches);
  const p = page.t.platform;
  const m = p.matches;
  if (page.blocked) return <><PageHeader title={m.title} />{page.blocked}</>;
  if (page.viewer.site.status !== "verified") {
    const gate = await platformPage("browse", ROUTES.matches);
    return <><PageHeader title={m.title} /><ListingTabs current="matches" t={p} />{gate.blocked}</>;
  }

  const [overview, catalogue] = await Promise.all([listMatches(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const footer = (href: string, facts: string) => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
      <p className="text-[13px] text-muted">{facts}</p>
      <Link href={href} className={buttonQuiet}>
        {m.open}
      </Link>
    </div>
  );
  const hidden = (more: number, incompatible: number) => (
    <>
      {more > 0 && <p className="text-[13px] text-muted">{`${m.moreHidden}: ${more}`}</p>}
      {incompatible > 0 && <p className="text-[13px] text-muted">{`${m.incompatibleHidden}: ${incompatible}`}</p>}
    </>
  );

  // Layout "Treffer:C" (user, 2026-11-28) on the shared 12-column grid: per own listing a quiet box on the left
  // (4 columns: title, number, hidden counts) and its candidates on the right (8 columns); one column below 1024 px.
  const group = `${grid12} border-t border-line pt-6 first:border-t-0 first:pt-0`;
  const ownBox = "grid min-w-0 content-start gap-2 rounded-xl bg-canvas p-4 lg:col-span-4";
  const candidatesColumn = "grid min-w-0 gap-4 lg:col-span-8";

  return (
    <>
      <PageHeader title={m.title} intro={m.intro} />
      <ListingTabs current="matches" t={p} />

      <Section title={m.forRequests} icon={<FileTextIcon size={18} />} id="for-requests">
        {overview.forRequests.length === 0 ? (
          <EmptyState title={m.noRequests} action={<Link href={ROUTES.newRequest} className={buttonQuiet}>{p.nav.createRequest}</Link>} />
        ) : (
          <div className="grid gap-6">
            {overview.forRequests.map(({ request, candidates, more, incompatible }) => (
              <div key={request.id} className={group}>
                <div className={ownBox}>
                  <h3 className="text-lg leading-snug font-semibold text-balance break-words">
                    <Link href={`/requests/${request.id}`} className="hover:underline">{request.title}</Link>{" "}
                    <span className="text-[13px] font-normal text-muted" translate="no">{request.ref}</span>
                  </h3>
                  {hidden(more, incompatible)}
                </div>
                <div className={candidatesColumn}>
                  {candidates.length === 0 ? (
                    <EmptyState title={m.noCandidates} />
                  ) : (
                    <ul className="grid gap-4">
                      {candidates.map((offer) => (
                        <li key={offer.id}>
                          <OfferCard
                            offer={offer}
                            t={p}
                            locale={page.locale}
                            format={format}
                            headingLevel={4}
                            layout="split"
                            footer={
                              <>
                                <div><MatchBadge result={offer.match.result} t={p} /></div>
                                {footer(matchPath(request.id, offer.id), matchFacts(offer.match, p))}
                              </>
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={m.forOffers} icon={<PackageIcon size={18} />} id="for-offers">
        {overview.forOffers.length === 0 ? (
          <EmptyState title={m.noOffers} />
        ) : (
          <div className="grid gap-6">
            {overview.forOffers.map(({ offer, candidates, more, incompatible }) => (
              <div key={offer.id} className={group}>
                <div className={ownBox}>
                  <h3 className="text-lg leading-snug font-semibold text-balance break-words">
                    <Link href={`/offers/${offer.id}`} className="hover:underline">{offer.title}</Link>{" "}
                    <span className="text-[13px] font-normal text-muted" translate="no">{offer.ref}</span>
                  </h3>
                  {hidden(more, incompatible)}
                </div>
                <div className={candidatesColumn}>
                  {candidates.length === 0 ? (
                    <EmptyState title={m.noCandidates} />
                  ) : (
                    <ul className="grid gap-4">
                      {candidates.map((request) => (
                        <li key={request.id}>
                          <RequestCard
                            request={request}
                            t={p}
                            locale={page.locale}
                            format={format}
                            catalogue={catalogue}
                            headingLevel={4}
                            layout="split"
                            badge={<MatchBadge result={request.match.result} t={p} />}
                            footer={footer(matchPath(request.id, offer.id), matchFacts(request.match, p))}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
