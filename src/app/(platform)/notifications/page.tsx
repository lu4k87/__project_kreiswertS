// Notifications (function no. 19): new offers that match a saved search of the own site, and the saved searches
// themselves. Per site – every member of the site sees the same list; the administrator has no site.
import Link from "next/link";
import { listNotifications, listSavedSearches } from "@/server/dal/alerts";
import { getCatalogue, listParks } from "@/server/dal/catalogue";
import { Badge, EmptyState, PageHeader, Section, buttonSecondary, linkClass } from "@/components/ui/elements";
import { PackageIcon, SearchIcon } from "@/components/ui/icons";
import { ROUTES, offerPath } from "@/components/layout/links";
import { DeleteSavedSearch, MarkAllRead } from "@/components/alerts/alert-actions";
import { describeFilters } from "@/components/alerts/describe";
import { makeFormatters } from "@/components/offers/format";
import { searchParamsOf } from "@/components/offers/search-filters";
import { offerSearchQuery } from "@/server/validation/offers";
import { platformPage } from "../gate";

export default async function NotificationsPage() {
  const page = await platformPage("site", ROUTES.notifications);
  const p = page.t.platform;
  const a = p.alerts;
  if (page.blocked) return <><PageHeader title={a.title} />{page.blocked}</>;

  const [notices, searches, catalogue, parks] = await Promise.all([listNotifications(page.viewer), listSavedSearches(page.viewer), getCatalogue(), listParks()]);
  const format = makeFormatters(page.locale, p, catalogue.units);

  return (
    <>
      <PageHeader title={a.title} intro={a.intro} />

      <Section
        title={a.noticesTitle}
        icon={<PackageIcon size={18} />}
        id="notices"
        aside={notices.unread > 0 && <MarkAllRead t={p} />}
      >
        {notices.unread > 0 && (
          <p className="mb-3 text-[15px] font-medium tabular-nums">
            {notices.unread} {a.unread}
          </p>
        )}
        {notices.items.length === 0 ? (
          <EmptyState icon={<PackageIcon size={20} />} title={a.none} text={a.noneText} />
        ) : (
          <ul className="grid gap-2" data-testid="notifications">
            {notices.items.map((notice) => (
              <li
                key={notice.id}
                className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border px-4 py-3 ${notice.read ? "border-line" : "border-brand/40 bg-mint/40"}`}
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] leading-snug font-semibold">
                    {!notice.read && <Badge tone="solid">{a.newBadge}</Badge>}
                    {notice.offer.status === "active" ? (
                      <Link href={offerPath(notice.offer.id)} className="min-w-0 rounded break-words hover:underline">
                        {notice.offer.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 break-words">{notice.offer.title}</span>
                    )}
                    {notice.offer.status !== "active" && <Badge tone="attention">{p.labels.offerStatus[notice.offer.status]}</Badge>}
                  </p>
                  <p className="text-[13px] leading-normal">
                    <span translate="no">{notice.offer.ref}</span> · {a.matches} „{notice.search.name}“
                  </p>
                </div>
                <time dateTime={notice.createdAt} className="flex-none text-[13px] tabular-nums">
                  {format.dateTime(notice.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={a.searchesTitle} icon={<SearchIcon size={18} />} id="saved-searches">
        {searches.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={20} />}
            title={a.noSearches}
            text={a.noSearchesText}
            action={
              <Link href={ROUTES.offers} className={buttonSecondary}>
                {a.toOffers}
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-2" data-testid="saved-searches">
            {searches.map((search) => (
              <li key={search.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line px-4 py-3">
                <div className="grid min-w-0 gap-0.5">
                  <p className="text-[15px] leading-snug font-semibold break-words">{search.name}</p>
                  <p className="text-[13px] leading-normal text-pretty">{describeFilters(search.filters, catalogue, parks, p, page.locale)}</p>
                  <p className="text-[13px] leading-normal">
                    {a.savedOn} {format.date(search.createdAt.slice(0, 10))}
                  </p>
                </div>
                <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href={`${ROUTES.offers}?${searchParamsOf(offerSearchQuery.parse(search.filters))}`} className={`${linkClass} text-[15px]`}>
                    {a.showResults}
                  </Link>
                  <DeleteSavedSearch id={search.id} name={search.name} t={p} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
