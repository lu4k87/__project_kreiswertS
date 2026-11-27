// Administration → site verification (PG-15): sites by status (the waiting ones first), with company, address,
// duplicate hint and history; the administrator verifies, declines or resets a site.
import Link from "next/link";
import { listSitesForReview } from "@/server/dal/admin";
import type { Industry } from "@/server/domain/listing";
import { VERIFICATION_STATUSES } from "@/server/domain/status";
import { siteReviewQuery } from "@/server/validation/sites";
import { Badge, EmptyState, Facts, Notice, PageHeader, buttonSecondary } from "@/components/ui/elements";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";
import { VerificationForm } from "@/components/admin/verification-form";
import { makeFormatters } from "@/components/offers/format";
import { platformPage } from "../../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function VerificationPage({ searchParams }: Props) {
  const page = await platformPage("admin", ROUTES.adminVerification);
  const p = page.t.platform;
  const a = p.admin;
  if (page.blocked) return <><PageHeader title={a.verificationTitle} />{page.blocked}</>;

  const parsed = siteReviewQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : siteReviewQuery.parse({});
  const list = await listSitesForReview(page.viewer, query);
  const format = makeFormatters(page.locale, p, []);

  return (
    <>
      <PageHeader title={a.verificationTitle} intro={a.verificationIntro} />
      <nav aria-label={a.all}>
        <ul className="flex flex-wrap gap-2">
          {VERIFICATION_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`${ROUTES.adminVerification}?status=${status}`}
                aria-current={status === list.status ? "page" : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium ${status === list.status ? "bg-brand text-white" : "border border-line bg-surface hover:bg-mint"}`}
              >
                {p.labels.verification[status]}
                <span className="tabular-nums">({list.counts[status]})</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {list.sites.length === 0 ? (
        <EmptyState icon={<ShieldCheckIcon size={20} />} title={list.status === "pending" ? a.nonePending : p.map.noSites} />
      ) : (
        <ul className="grid gap-5">
          {list.sites.map((site) => (
            <li key={site.id} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h2 className="min-w-0 text-[1.375rem] leading-tight font-semibold break-words">
                  {site.companyName} – {site.name}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={site.status === "verified" ? "solid" : "attention"}>{p.labels.verification[site.status]}</Badge>
                  {site.provenance === "synthetic" && <Badge tone="outline">{p.common.demo}</Badge>}
                </div>
              </div>
              {site.duplicateOf && (
                <Notice tone="attention" title={a.duplicate}>
                  {a.duplicateText} „{site.duplicateOf.name}“ (Nr. {site.duplicateOf.id}, {p.labels.verification[site.duplicateOf.status]}).
                </Notice>
              )}
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <Facts
                  rows={[
                    { label: a.company, value: site.companyName, note: site.claimedCompanyName && site.claimedCompanyName !== site.companyName ? `${a.account}: „${site.claimedCompanyName}“` : undefined },
                    { label: a.vatId, value: site.vatId },
                    { label: p.account.industry, value: p.labels.industry[site.industry as Industry] ?? site.industry },
                    { label: a.address, value: `${site.streetAddress}, ${site.postalCode} ${site.city}` },
                    { label: a.park, value: site.parkName ?? p.account.parkUnknown },
                    { label: a.contact, value: `${site.contactName}, ${site.contactEmail}` },
                    { label: a.account, value: site.accountEmail },
                    { label: a.registered, value: format.dateTime(site.createdAt) },
                  ]}
                />
                <div className="grid gap-4">
                  <VerificationForm key={`${site.id}-${site.status}`} siteId={site.id} status={site.status} note={site.note} latitude={site.latitude} longitude={site.longitude} t={p} />
                  <div>
                    <h3 className="text-lg leading-tight font-semibold">{a.history}</h3>
                    {site.history.length === 0 ? (
                      <p className="mt-1 text-[15px]">{a.noHistory}</p>
                    ) : (
                      <ol className="mt-1 grid gap-1 text-[15px]">
                        {site.history.map((event) => (
                          <li key={event.at}>
                            <span className="tabular-nums">{format.dateTime(event.at)}</span>: {p.labels.verification[event.from as keyof typeof p.labels.verification] ?? event.from} →{" "}
                            {p.labels.verification[event.to as keyof typeof p.labels.verification] ?? event.to}
                            {event.note && ` · ${event.note}`}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.nextBefore !== null && (
        <p>
          <Link href={`${ROUTES.adminVerification}?status=${list.status}&before=${list.nextBefore}`} className={buttonSecondary}>
            {a.older}
          </Link>
        </p>
      )}
    </>
  );
}
