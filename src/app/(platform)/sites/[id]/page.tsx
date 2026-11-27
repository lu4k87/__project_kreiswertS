// Individual site profile (PG-12, L1-018): company, site, verification status, capabilities, active offers, contact.
// Only the profile fields the site publishes to members; the street address never appears here.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError, canBrowse } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { listActiveOffersOfSite } from "@/server/dal/offers";
import { getSiteProfile } from "@/server/dal/sites";
import type { Capability, Industry } from "@/server/domain/listing";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, EmptyState, Facts, Notice, PageHeader, Section, buttonSecondary, linkClass } from "@/components/ui/elements";
import { BuildingIcon, MailIcon, PackageIcon, PencilIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { ROUTES, sitePath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { OfferCard } from "@/components/offers/offer-card";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function SitePage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("account", sitePath(id.data));
  const p = page.t.platform;
  const s = p.site;

  let site;
  try {
    site = await getSiteProfile(page.viewer, id.data);
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    const gate = await platformPage("browse", sitePath(id.data));
    return gate.blocked ?? notFound();
  }
  const browsable = canBrowse(page.viewer);
  const [offers, catalogue] = await Promise.all([browsable ? listActiveOffersOfSite(page.viewer, site.id) : [], getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);

  return (
    <>
      <PageHeader
        title={`${site.companyName} – ${site.name}`}
        intro={site.description ?? undefined}
        back={browsable ? <BackLink href={ROUTES.companies}>{s.backToDirectory}</BackLink> : undefined}
        actions={
          <>
            <Badge tone={site.verified ? "solid" : "attention"} icon={site.verified ? <ShieldCheckIcon size={14} /> : undefined}>
              {p.labels.verification[site.verified ? "verified" : "pending"]}
            </Badge>
            {site.provenance === "synthetic" && <Badge tone="outline">{p.common.demo}</Badge>}
          </>
        }
      />
      {site.isOwn && (
        <Notice>
          {s.ownProfile}{" "}
          <Link href={ROUTES.account} className="font-semibold underline underline-offset-4">
            {s.editProfile}
          </Link>
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="grid min-w-0 gap-6">
          <Section title={s.siteInfo} icon={<BuildingIcon size={18} />} id="site">
            <Facts
              rows={[
                { label: s.company, value: site.companyName },
                { label: s.siteInfo, value: site.name },
                { label: p.account.industry, value: p.labels.industry[site.industry as Industry] ?? site.industry },
                { label: s.location, value: [site.parkName, site.city].filter(Boolean).join(", "), note: s.locationNote },
                { label: s.verification, value: p.labels.verification[site.verified ? "verified" : "pending"], note: site.verified ? p.detail.supplierVerifiedNote : undefined },
              ]}
            />
            <h3 className="mt-5 text-lg leading-tight font-semibold">{s.capabilities}</h3>
            {site.capabilities.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {site.capabilities.map((capability) => (
                  <li key={capability}>
                    <Badge>{p.labels.capability[capability as Capability] ?? capability}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[15px]">{p.companies.noCapabilities}</p>
            )}
            {site.otherSites.length > 0 && (
              <>
                <h3 className="mt-5 text-lg leading-tight font-semibold">{s.otherSites}</h3>
                <ul className="mt-2 grid gap-1 text-[15px]">
                  {site.otherSites.map((other) => (
                    <li key={other.id}>
                      <Link href={sitePath(other.id)} className={linkClass}>
                        {other.name}
                      </Link>
                      , {other.city}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section title={s.contact} icon={<MailIcon size={18} />} id="contact">
            {site.contact ? (
              <p className="text-[15px] leading-relaxed break-words">
                {site.contact.name}
                <br />
                <a href={`mailto:${site.contact.email}`} className={linkClass}>
                  {site.contact.email}
                </a>
                {site.contact.phone && (
                  <>
                    <br />
                    {site.contact.phone}
                  </>
                )}
              </p>
            ) : (
              <p className="text-[15px] leading-relaxed text-pretty">{s.contactHidden}</p>
            )}
            {site.provenance === "synthetic" && <p className="mt-3 text-[13px] font-medium">{p.common.syntheticSite}</p>}
          </Section>
        </div>

        <Section
          title={`${s.offers} (${offers.length})`}
          icon={<PackageIcon size={18} />}
          id="offers"
          aside={
            site.isOwn && (
              <Link href={ROUTES.myOffers} className={`${buttonSecondary} min-h-9 px-3 py-1.5 text-[13px]`}>
                <PencilIcon size={14} />
                {p.nav.myOffers}
              </Link>
            )
          }
        >
          {!browsable ? (
            <EmptyState title={s.notBrowsable} />
          ) : offers.length === 0 ? (
            <EmptyState title={s.noOffers} />
          ) : (
            <ul className="grid gap-4">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} t={p} locale={page.locale} format={format} showDistance={page.viewer.role === "member" && !site.isOwn} headingLevel={3} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
