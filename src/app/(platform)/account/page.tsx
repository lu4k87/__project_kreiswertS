// My account (PG-14): verification status, company, physical site, profile and visibility, account, security, logout.
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getMySite } from "@/server/dal/sites";
import type { Industry } from "@/server/domain/listing";
import { Badge, Facts, Notice, PageHeader, Section, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { BuildingIcon, FactoryIcon, PencilIcon, ShieldCheckIcon, UserIcon } from "@/components/ui/icons";
import { ROUTES, sitePath } from "@/components/layout/links";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { makeFormatters } from "@/components/offers/format";
import { ProfileForm } from "@/components/sites/profile-form";
import { platformPage } from "../gate";

export default async function AccountPage() {
  const page = await platformPage("account", ROUTES.account);
  const p = page.t.platform;
  const a = p.account;
  // name and e-mail of the login; the gate already made sure a session exists
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  const format = makeFormatters(page.locale, p, []);

  const accountSection = (
    <Section title={a.accountInfo} icon={<UserIcon size={18} />} id="account">
      <Facts
        rows={[
          { label: a.username, value: user?.username ?? user?.name },
          { label: a.email, value: user?.email },
        ]}
      />
    </Section>
  );
  const securitySection = (
    <Section title={a.security} icon={<ShieldCheckIcon size={18} />} id="security">
      <ChangePasswordForm t={page.t} locale={page.locale} />
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <SignOutButton label={p.nav.logOut} busyLabel={p.nav.loggingOut} failedLabel={p.nav.logOutFailed} className={buttonSecondary} />
      </div>
    </Section>
  );

  if (page.viewer.role === "admin") {
    return (
      <>
        <PageHeader title={a.title} actions={<Badge tone="solid">{a.adminAccount}</Badge>} />
        <Notice>{a.adminNote}</Notice>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {accountSection}
          {securitySection}
        </div>
      </>
    );
  }

  const site = await getMySite(page.viewer);
  const verified = site.verificationStatus === "verified";
  const declined = site.verificationStatus === "declined";
  return (
    <>
      <PageHeader
        title={a.title}
        intro={`${site.companyName} – ${site.name}`}
        actions={
          <Link href={sitePath(site.id)} className={buttonQuiet}>
            {a.viewProfile}
          </Link>
        }
      />

      <Section
        title={a.verification}
        icon={<ShieldCheckIcon size={18} />}
        id="verification"
        aside={<Badge tone={verified ? "solid" : "attention"}>{p.labels.verification[site.verificationStatus]}</Badge>}
      >
        <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">
          {verified ? `${a.verifiedSince} ${site.verifiedAt ? format.date(site.verifiedAt) : ""}. ${p.detail.supplierVerifiedNote}` : declined ? p.gate.declinedText : p.gate.pendingText}
        </p>
        {site.verificationNote && (
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[15px]">
            <span className="font-semibold">{a.noteFromAdmin}:</span> {site.verificationNote}
          </p>
        )}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title={a.company} icon={<BuildingIcon size={18} />} id="company">
          <Facts
            rows={[
              { label: a.companyName, value: site.companyName },
              { label: a.vatId, value: site.vatId },
              { label: a.industry, value: p.labels.industry[site.industry as Industry] ?? site.industry },
            ]}
          />
        </Section>
        <Section title={a.site} icon={<FactoryIcon size={18} />} id="site">
          <Facts
            rows={[
              { label: a.siteName, value: site.name },
              { label: a.address, value: `${site.streetAddress}, ${site.postalCode} ${site.city}`, note: a.addressNote },
              { label: a.park, value: site.park?.name ?? a.parkUnknown },
              { label: a.coordinates, value: site.hasCoordinates ? a.coordinatesKnown : a.coordinatesUnknown },
            ]}
          />
          <p className="mt-3 text-[13px] leading-normal text-muted">{a.fixedNote}</p>
          {site.provenance === "synthetic" && <p className="mt-2 text-[13px] font-medium">{p.common.syntheticSite}</p>}
        </Section>
      </div>

      <Section title={a.profile} icon={<PencilIcon size={18} />} id="profile">
        {declined && (
          <div className="mb-4">
            <Notice tone="attention">{p.errors.api.NOT_VERIFIED}</Notice>
          </div>
        )}
        <ProfileForm site={site} t={p} disabled={declined} />
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {accountSection}
        {securitySection}
      </div>
    </>
  );
}
