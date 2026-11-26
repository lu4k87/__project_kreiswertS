// Company dashboard (PG-06): own active offers, drafts, recent enquiries, and the two ways on – create an offer or
// explore materials. The administrator gets the overview of the verification work instead.
import Link from "next/link";
import { listSitesForReview } from "@/server/dal/admin";
import { getCatalogue } from "@/server/dal/catalogue";
import { listEnquiries } from "@/server/dal/enquiries";
import { listMyOffers } from "@/server/dal/offers";
import { getMySite } from "@/server/dal/sites";
import { Badge, EmptyState, Notice, PageHeader, Section, Stat, buttonInverse, buttonPrimary, buttonSecondary, linkClass } from "@/components/ui/elements";
import { LayersIcon, MailIcon, PackageIcon, PencilIcon, PlusIcon, SearchIcon, ShieldCheckIcon } from "@/components/ui/icons";
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
  const [site, offers, enquiries, catalogue] = await Promise.all([getMySite(viewer), listMyOffers(viewer), listEnquiries(viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const active = offers.filter((offer) => offer.status === "active");
  const drafts = offers.filter((offer) => offer.status === "draft");
  const ended = offers.filter((offer) => offer.status === "closed" || offer.status === "expired");
  const unanswered = enquiries.filter((enquiry) => enquiry.direction === "received" && !enquiry.response);
  const verified = site.verificationStatus === "verified";

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

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={active.length} label={d.activeOffers} href={ROUTES.myOffers} />
        <Stat value={drafts.length} label={d.draftOffers} href={ROUTES.myOffers} />
        <Stat value={ended.length} label={d.closedOffers} href={ROUTES.myOffers} />
        <Stat value={unanswered.length} label={d.openEnquiries} />
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand p-5 text-white sm:p-6">
          <div className="min-w-[14rem] flex-1">
            <h2 className="text-[1.375rem] leading-tight font-semibold">{p.nav.createOffer}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-on-brand-muted">{d.createText}</p>
          </div>
          <Link href={ROUTES.newOffer} className={buttonInverse}>
            <PlusIcon size={18} />
            {p.nav.createOffer}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="min-w-[14rem] flex-1">
            <h2 className="text-[1.375rem] leading-tight font-semibold">{d.explore}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">{d.exploreText}</p>
          </div>
          <Link href={ROUTES.offers} className={buttonSecondary}>
            <SearchIcon size={18} />
            {p.nav.offers}
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
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

        <Section title={d.recent} icon={<MailIcon size={18} />} id="enquiries">
          {enquiries.length === 0 ? <EmptyState title={d.noEnquiries} /> : <EnquiryList enquiries={enquiries.slice(0, 6)} t={p} format={format} canRespond={verified} />}
        </Section>
      </div>
    </>
  );
}
