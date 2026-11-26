// Data Access Layer: companies and sites – registration (L1-001), own profile (PG-14), directory and site
// profile (L1-018). The street address of a site never leaves this file except for its owner.
import "server-only";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { AccessError, requireAccount, requireBrowse, requireSite, siteIdOf, type Viewer } from "../access";
import { db } from "../db/client";
import { auth_users } from "../db/auth-schema";
import { companies, industrialParks, offers, sites } from "../db/schema";
import type { VerificationStatus } from "../domain/status";
import { addressKey, type SiteDirectoryQuery, type SiteProfile, type SiteRegistration } from "../validation/sites";

/** Second step of the registration: the physical site of the account's company. One account, one site. */
export async function registerSite(viewer: Viewer, input: SiteRegistration): Promise<{ siteId: number }> {
  const account = requireAccount(viewer);
  if (account.role !== "member") throw new AccessError("FORBIDDEN");
  if (account.site) throw new AccessError("CONFLICT", { reason: "SITE_EXISTS" });

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ email: auth_users.email, companyName: auth_users.company_name, vatId: auth_users.vat_id, siteId: auth_users.site_id })
      .from(auth_users)
      .where(eq(auth_users.id, account.userId));
    if (!user || !user.companyName) throw new AccessError("FORBIDDEN");
    if (user.siteId != null) throw new AccessError("CONFLICT", { reason: "SITE_EXISTS" });
    if (input.parkId != null) {
      const [park] = await tx.select({ id: industrialParks.id }).from(industrialParks).where(eq(industrialParks.id, input.parkId));
      if (!park) throw new AccessError("NOT_FOUND");
    }

    // Same VAT ID = same company: the new site becomes another branch of it. That is only a claim until the
    // administrator verifies the site – a pending site sees nothing of the company's other sites (getSiteProfile).
    let [company] = user.vatId ? await tx.select({ id: companies.id }).from(companies).where(eq(companies.vatId, user.vatId)) : [];
    if (!company) {
      [company] = await tx.insert(companies).values({ name: user.companyName, vatId: user.vatId }).returning({ id: companies.id });
    }

    // Same company at the same address already registered → flagged for the administrator (D01), never a second owner.
    // The flag is not part of the answer: it would tell a stranger whether a guessed address is registered.
    const key = addressKey(input.streetAddress, input.postalCode);
    const [existing] = await tx
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.companyId, company.id), eq(sites.addressKey, key)))
      .orderBy(asc(sites.id))
      .limit(1);

    const [site] = await tx
      .insert(sites)
      .values({
        companyId: company.id,
        name: input.siteName,
        industry: input.industry,
        streetAddress: input.streetAddress,
        postalCode: input.postalCode,
        city: input.city,
        addressKey: key,
        parkId: input.parkId,
        contactName: input.contactName,
        contactEmail: user.email,
        contactPhone: input.contactPhone,
        capabilities: input.capabilities,
        verificationStatus: "pending",
        duplicateOfSiteId: existing?.id ?? null,
        provenance: "registered",
      })
      .returning({ id: sites.id });

    // Only if the account still has no site: two parallel requests cannot attach two sites.
    const linked = await tx
      .update(auth_users)
      .set({ site_id: site.id })
      .where(and(eq(auth_users.id, account.userId), isNull(auth_users.site_id)))
      .returning({ id: auth_users.id });
    if (linked.length === 0) throw new AccessError("CONFLICT", { reason: "SITE_EXISTS" });
    return { siteId: site.id };
  });
}

export type MySite = {
  id: number;
  companyName: string;
  vatId: string | null;
  industry: string;
  name: string;
  description: string | null;
  streetAddress: string;
  postalCode: string;
  city: string;
  park: { id: number; name: string } | null;
  hasCoordinates: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  capabilities: string[];
  contactVisible: boolean;
  publicListed: boolean;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  verifiedAt: string | null;
  provenance: string;
};

/** The viewer's own site with everything the settings page shows, including the address. */
export async function getMySite(viewer: Viewer): Promise<MySite> {
  const { site } = requireSite(viewer);
  const [row] = await db
    .select({ site: sites, companyName: companies.name, vatId: companies.vatId, parkName: industrialParks.name })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    .where(eq(sites.id, site.id));
  if (!row) throw new AccessError("NOT_FOUND");
  const s = row.site;
  return {
    id: s.id,
    companyName: row.companyName,
    vatId: row.vatId,
    industry: s.industry,
    name: s.name,
    description: s.description,
    streetAddress: s.streetAddress,
    postalCode: s.postalCode,
    city: s.city,
    park: s.parkId != null && row.parkName ? { id: s.parkId, name: row.parkName } : null,
    hasCoordinates: s.latitude != null && s.longitude != null,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    capabilities: s.capabilities,
    contactVisible: s.contactVisible,
    publicListed: s.publicListed,
    verificationStatus: s.verificationStatus as VerificationStatus,
    verificationNote: s.verificationNote,
    verifiedAt: s.verifiedAt?.toISOString() ?? null,
    provenance: s.provenance,
  };
}

/**
 * Change the own profile. Company, address and park stay as verified; the status cannot be touched from here.
 * A declined site reads its profile but cannot change it (D03) – the administrator sets it back to pending first.
 */
export async function updateMySite(viewer: Viewer, input: SiteProfile): Promise<{ id: number }> {
  const { site } = requireSite(viewer);
  if (site.status === "declined") throw new AccessError("NOT_VERIFIED");
  const [row] = await db
    .update(sites)
    .set({
      description: input.description,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      capabilities: input.capabilities,
      contactVisible: input.contactVisible,
      publicListed: input.publicListed,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, site.id))
    .returning({ id: sites.id });
  if (!row) throw new AccessError("NOT_FOUND");
  return row;
}

export type DirectorySite = {
  id: number;
  name: string;
  companyName: string;
  industry: string;
  parkName: string | null;
  city: string;
  capabilities: string[];
  activeOffers: number;
  provenance: string;
};

/** Number of discoverable offers per site as a correlated subquery. */
const activeOfferCount = sql<number>`(select count(*)::int from ${offers} where ${offers.siteId} = ${sites.id} and ${offers.status} = 'active' and ${offers.expiresAt} > now())`;

/** Company directory (L1-018): verified sites with the profile fields they publish to members. */
export async function listSites(viewer: Viewer, query: SiteDirectoryQuery): Promise<DirectorySite[]> {
  requireBrowse(viewer);
  // % and _ typed by the user are searched literally, not as wildcards
  const pattern = query.q ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const filters: (SQL | undefined)[] = [
    eq(sites.verificationStatus, "verified"),
    pattern ? or(ilike(sites.name, pattern), ilike(companies.name, pattern), ilike(sites.city, pattern)) : undefined,
    query.industry ? eq(sites.industry, query.industry) : undefined,
    query.capability ? sql`${sites.capabilities} @> ${JSON.stringify([query.capability])}::jsonb` : undefined,
    query.parkId ? eq(sites.parkId, query.parkId) : undefined,
  ];
  return db
    .select({
      id: sites.id,
      name: sites.name,
      companyName: companies.name,
      industry: sites.industry,
      parkName: industrialParks.name,
      city: sites.city,
      capabilities: sites.capabilities,
      activeOffers: activeOfferCount,
      provenance: sites.provenance,
    })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    .where(and(...filters))
    .orderBy(asc(companies.name), asc(sites.name))
    .limit(200);
}

export type SiteProfileView = DirectorySite & {
  description: string | null;
  verified: boolean;
  isOwn: boolean;
  /** Other sites of the same company (branches stay separate records with their own offers). */
  otherSites: { id: number; name: string; city: string }[];
  contact: { name: string; email: string; phone: string | null } | null;
};

/** Profile of one site (PG-12). Verified sites for members; the own site in any status. */
export async function getSiteProfile(viewer: Viewer, siteId: number): Promise<SiteProfileView> {
  const isOwn = siteIdOf(viewer) === siteId;
  if (!isOwn) requireBrowse(viewer);
  const [row] = await db
    .select({
      site: sites,
      companyId: companies.id,
      companyName: companies.name,
      parkName: industrialParks.name,
      activeOffers: activeOfferCount,
    })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    .where(eq(sites.id, siteId));
  if (!row || (!isOwn && row.site.verificationStatus !== "verified")) throw new AccessError("NOT_FOUND");
  const s = row.site;
  // Branches of the company only for a verified site: an unverified claim on a VAT ID must not list the company's sites.
  const otherSites =
    s.verificationStatus === "verified"
      ? await db
          .select({ id: sites.id, name: sites.name, city: sites.city })
          .from(sites)
          .where(and(eq(sites.companyId, row.companyId), eq(sites.verificationStatus, "verified"), sql`${sites.id} <> ${siteId}`))
          .orderBy(asc(sites.name))
      : [];
  return {
    id: s.id,
    name: s.name,
    companyName: row.companyName,
    industry: s.industry,
    parkName: row.parkName,
    city: s.city,
    capabilities: s.capabilities,
    activeOffers: row.activeOffers,
    provenance: s.provenance,
    description: s.description,
    verified: s.verificationStatus === "verified",
    isOwn,
    otherSites,
    contact: s.contactVisible || isOwn ? { name: s.contactName, email: s.contactEmail, phone: s.contactPhone } : null,
  };
}
