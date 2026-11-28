// Company dashboard (PG-06): own active offers and drafts, the figures at a glance, recent enquiries, and the ways on –
// create an offer or a request, explore materials, see the matches, negotiations, exchanges and the circularity overview. The administrator gets the overview of the verification work instead.
import Link from "next/link";
import type { ReactNode } from "react";
import { listSitesForReview } from "@/server/dal/admin";
import { getCatalogue } from "@/server/dal/catalogue";
import { listEnquiries } from "@/server/dal/enquiries";
import { listMyOffers } from "@/server/dal/offers";
import { listExchanges } from "@/server/dal/exchanges";
import { listNegotiations } from "@/server/dal/negotiations";
import { listMyRequests, listResponses } from "@/server/dal/requests";
import { getMySite } from "@/server/dal/sites";
import { Badge, EmptyState, Notice, PageHeader, Section, Stat, buttonPrimary, buttonSecondary, buttonSmall, grid12, linkClass, stack } from "@/components/ui/elements";
import { ArrowUpRightIcon, DashboardIcon, FileTextIcon, HandshakeIcon, LayersIcon, MailIcon, PackageIcon, PencilIcon, PlusIcon, RecycleIcon, SearchIcon, SendIcon, ShieldCheckIcon, TruckIcon } from "@/components/ui/icons";
import { ROUTES, editOfferPath } from "@/components/layout/links";
import { EnquiryList } from "@/components/enquiries/enquiry-list";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { platformPage } from "../gate";

export default async function DashboardPage() {
  const page = await platformPage("account", ROUTES.dashboard);
  const p = page.t.platform;
  const d = p.dashboard;

  if (page.viewer.role === "admin") {
    const { counts } = await listSitesForReview(page.viewer, { status: "pending" });
    return (
      <>
        <PageHeader title={d.adminTitle} intro={d.adminText} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={counts.pending} label={d.adminPending} href={ROUTES.adminVerification} />
          <Stat value={counts.pending + counts.verified + counts.declined} label={d.adminSites} href={`${ROUTES.adminVerification}?status=verified`} />
        </dl>
        <p className="flex flex-wrap gap-3">
          <Link href={ROUTES.adminVerification} className={buttonPrimary}>
            <ShieldCheckIcon size={18} />
            {p.nav.verification}
          </Link>
          <Link href={ROUTES.adminReferenceData} className={buttonSecondary}>
            {p.nav.referenceData}
          </Link>
        </p>
      </>
    );
  }

  const viewer = page.viewer;
  const [site, offers, enquiries, catalogue, requests, responses, negotiations, exchanges] = await Promise.all([
    getMySite(viewer),
    listMyOffers(viewer),
    listEnquiries(viewer),
    getCatalogue(),
    listMyRequests(viewer),
    listResponses(viewer),
    listNegotiations(viewer),
    listExchanges(viewer),
  ]);
  const trade = p.dashboardTrade;
  const l2 = p.dashboardL2;
  const activeRequests = requests.filter((request) => request.status === "active");
  const openResponses = responses.filter((response) => response.direction === "received" && !response.reply);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const active = offers.filter((offer) => offer.status === "active");
  const drafts = offers.filter((offer) => offer.status === "draft");
  const ended = offers.filter((offer) => offer.status === "closed" || offer.status === "expired");
  const unanswered = enquiries.filter((enquiry) => enquiry.direction === "received" && !enquiry.response);
  const verified = site.verificationStatus === "verified";
  const glance: { value: number; label: string; href?: string }[] = [
    { value: active.length, label: d.activeOffers, href: ROUTES.myOffers },
    { value: drafts.length, label: d.draftOffers, href: ROUTES.myOffers },
    { value: ended.length, label: d.closedOffers, href: ROUTES.myOffers },
    { value: unanswered.length, label: d.openEnquiries },
    { value: activeRequests.length, label: l2.activeRequests, href: ROUTES.myRequests },
    { value: openResponses.length, label: l2.newResponses, href: `${ROUTES.myRequests}#received` },
    { value: negotiations.filter((item) => item.awaiting === "you").length, label: trade.awaitingYou, href: `${ROUTES.negotiations}#awaiting-you` },
    { value: exchanges.summary.planned, label: trade.plannedExchanges, href: ROUTES.exchanges },
  ];
  // the ways on: what the row is about, and the button that goes there (the first one is the main action)
  const quick: { title: string; href: string; label: string; icon: ReactNode }[] = [
    { title: p.nav.createOffer, href: ROUTES.newOffer, label: p.nav.createOffer, icon: <PlusIcon size={16} /> },
    { title: d.explore, href: ROUTES.offers, label: p.nav.offers, icon: <SearchIcon size={16} /> },
    { title: p.nav.createRequest, href: ROUTES.newRequest, label: p.nav.createRequest, icon: <FileTextIcon size={16} /> },
    { title: l2.matchesTitle, href: ROUTES.matches, label: l2.matchesTitle, icon: <HandshakeIcon size={16} /> },
    { title: p.negotiations.title, href: ROUTES.negotiations, label: p.negotiations.title, icon: <SendIcon size={16} /> },
    { title: p.exchanges.title, href: ROUTES.exchanges, label: p.exchanges.title, icon: <TruckIcon size={16} /> },
    { title: p.dashboardImpact.title, href: ROUTES.impact, label: p.dashboardImpact.open, icon: <RecycleIcon size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title={d.title}
        intro={`${d.welcome}, ${site.companyName} – ${site.name}`}
        actions={<Badge tone={verified ? "solid" : "attention"} icon={verified ? <ShieldCheckIcon size={14} /> : undefined}>{p.labels.verification[site.verificationStatus]}</Badge>}
      />
      {site.verificationStatus === "pending" && <Notice tone="attention" title={p.gate.pendingTitle}>{p.gate.pendingText}</Notice>}
      {site.verificationStatus === "declined" && (
        <Notice tone="attention" title={p.gate.declinedTitle}>
          {p.gate.declinedText}
          {site.verificationNote && ` ${p.gate.declinedReason}: ${site.verificationNote}`}
        </Notice>
      )}

      {/* Layout "Dash:A" (user, 2026-11-28): the own listings on the left (8 of 12 columns), on the right the figures
          as rows, the newest enquiries and the ways on. Below 1024 px one column: figures first, then the lists. */}
      <div className={grid12}>
        <div className={`${stack} max-lg:contents lg:col-span-8`}>
          <div className="min-w-0 max-lg:order-2">
            <Section
              title={d.myActive}
              icon={<PackageIcon size={18} />}
              id="active"
              aside={<Link href={ROUTES.myOffers} className={`${linkClass} text-[15px]`}>{d.allOffers}</Link>}
            >
              {active.length === 0 ? (
                <EmptyState title={d.noActive} />
              ) : (
                <ul className="grid gap-3">
                  {active.slice(0, 3).map((offer) => (
                    <li key={offer.id}>
                      <OfferCard offer={offer} t={p} locale={page.locale} format={format} showDistance={false} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-3">
            <Section title={d.drafts} icon={<LayersIcon size={18} />} id="drafts">
              {drafts.length === 0 ? (
                <EmptyState title={d.noDrafts} />
              ) : (
                <ul className="grid gap-2">
                  {drafts.slice(0, 5).map((offer) => (
                    <li key={offer.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0">
                      <span className="min-w-0 text-[15px] font-medium break-words">{offer.title}</span>
                      <Link href={editOfferPath(offer.id)} className="inline-flex flex-none items-center gap-1.5 text-[13px] font-semibold hover:underline">
                        <PencilIcon size={14} />
                        {p.common.edit}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>

        <div className={`${stack} max-lg:contents lg:col-span-4`}>
          <div className="min-w-0 max-lg:order-1">
            <Section title={d.glance} icon={<DashboardIcon size={18} />} id="glance">
              <dl>
                {glance.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
                    <dt className="min-w-0 text-[15px] break-words hyphens-auto">
                      {row.href ? (
                        <Link href={row.href} className="rounded hover:underline">
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </dt>
                    {/* only a figure above zero is marked: it is what needs a look */}
                    <dd className={`min-w-9 flex-none rounded-lg px-1.5 py-1 text-center text-lg leading-tight font-semibold tabular-nums ${row.value > 0 ? "bg-mint" : ""}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-4">
            <Section title={d.recent} icon={<MailIcon size={18} />} id="enquiries">
              {enquiries.length === 0 ? <EmptyState title={d.noEnquiries} /> : <EnquiryList enquiries={enquiries.slice(0, 6)} t={p} format={format} canRespond={verified} />}
            </Section>
          </div>

          <div className="min-w-0 max-lg:order-5">
            <Section title={d.quick} icon={<ArrowUpRightIcon size={18} />} id="quick">
              <ul>
                {quick.map((row, index) => (
                  <li key={row.href} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                    <span className="min-w-0 text-[15px] leading-snug font-semibold break-words hyphens-auto">{row.title}</span>
                    <Link href={row.href} className={`${buttonSmall} ${index === 0 ? "bg-brand text-white hover:bg-brand-hover" : "border border-ink/30 bg-surface text-ink hover:bg-mint"}`}>
                      {row.icon}
                      {row.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
