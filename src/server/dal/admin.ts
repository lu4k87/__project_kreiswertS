// Data Access Layer: administration (PG-15). Only the administrator role passes; the role comes from the
// database row of the session's user and cannot be set by any request.
import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AccessError, requireAdmin, type Viewer } from "../access";
import { db } from "../db/client";
import { auth_users } from "../db/auth-schema";
import { companies, industrialParks, siteVerificationEvents, sites } from "../db/schema";
import { VERIFICATION_STATUSES, canTransition, verificationFlow, type VerificationStatus } from "../domain/status";
import type { SiteReviewQuery, VerificationDecision } from "../validation/sites";

/** Sites per page of the review list; older ones are reached with `before`. */
const PAGE_SIZE = 50;

export type ReviewSite = {
  id: number;
  companyName: string;
  /** Company name the account itself gave at sign-up – may differ from the company row it attached to by VAT ID. */
  claimedCompanyName: string | null;
  vatId: string | null;
  industry: string;
  name: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  parkName: string | null;
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactEmail: string;
  accountEmail: string | null;
  status: VerificationStatus;
  note: string | null;
  verifiedAt: string | null;
  /** Earlier site of the same company at the same address – a possible duplicate claim (D01). */
  duplicateOf: { id: number; name: string; status: VerificationStatus } | null;
  provenance: string;
  createdAt: string;
  history: { from: string; to: string; note: string | null; at: string }[];
};

export type SiteReviewList = {
  status: VerificationStatus;
  sites: ReviewSite[];
  /** Number of sites per status – the page shows how much work is waiting, whatever is listed. */
  counts: Record<VerificationStatus, number>;
  /** Pass as `before` to get the next older page; null on the last page. */
  nextBefore: number | null;
};

/** Registered sites of one status for the verification page, newest first, in pages. */
export async function listSitesForReview(viewer: Viewer, query: SiteReviewQuery): Promise<SiteReviewList> {
  requireAdmin(viewer);
  const original = alias(sites, "original");
  const [rows, countRows] = await Promise.all([
    db
      .select({
        site: sites,
        companyName: companies.name,
        vatId: companies.vatId,
        parkName: industrialParks.name,
        accountEmail: auth_users.email,
        claimedCompanyName: auth_users.company_name,
        originalName: original.name,
        originalStatus: original.verificationStatus,
      })
      .from(sites)
      .innerJoin(companies, eq(sites.companyId, companies.id))
      .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
      .leftJoin(auth_users, eq(auth_users.site_id, sites.id))
      .leftJoin(original, eq(sites.duplicateOfSiteId, original.id))
      .where(and(eq(sites.verificationStatus, query.status), query.before ? lt(sites.id, query.before) : undefined))
      .orderBy(desc(sites.id))
      .limit(PAGE_SIZE + 1),
    db.select({ status: sites.verificationStatus, n: sql<number>`count(*)::int` }).from(sites).groupBy(sites.verificationStatus),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  const events = page.length
    ? await db
        .select()
        .from(siteVerificationEvents)
        .where(inArray(siteVerificationEvents.siteId, page.map((row) => row.site.id)))
        .orderBy(desc(siteVerificationEvents.createdAt))
    : [];
  const counts = Object.fromEntries(VERIFICATION_STATUSES.map((status) => [status, countRows.find((row) => row.status === status)?.n ?? 0])) as Record<VerificationStatus, number>;
  return {
    status: query.status,
    counts,
    nextBefore: rows.length > PAGE_SIZE ? page[page.length - 1].site.id : null,
    sites: page.map(({ site: s, companyName, vatId, parkName, accountEmail, claimedCompanyName, originalName, originalStatus }) => ({
      id: s.id,
      companyName,
      claimedCompanyName,
      vatId,
      industry: s.industry,
      name: s.name,
      streetAddress: s.streetAddress,
      postalCode: s.postalCode,
      city: s.city,
      parkName,
      latitude: s.latitude,
      longitude: s.longitude,
      contactName: s.contactName,
      contactEmail: s.contactEmail,
      accountEmail,
      status: s.verificationStatus as VerificationStatus,
      note: s.verificationNote,
      verifiedAt: s.verifiedAt?.toISOString() ?? null,
      duplicateOf:
        s.duplicateOfSiteId != null && originalName ? { id: s.duplicateOfSiteId, name: originalName, status: originalStatus as VerificationStatus } : null,
      provenance: s.provenance,
      createdAt: s.createdAt.toISOString(),
      history: events
        .filter((event) => event.siteId === s.id)
        .map((event) => ({ from: event.fromStatus, to: event.toStatus, note: event.note, at: event.createdAt.toISOString() })),
    })),
  };
}

/**
 * Record a verification decision (L1-003): status, reviewer, time and note, plus a row in the audit trail.
 * Declining needs a note so the site learns why. Coordinates looked up by the reviewer can be stored with it.
 */
export async function decideVerification(viewer: Viewer, siteId: number, decision: VerificationDecision): Promise<{ id: number; status: VerificationStatus }> {
  const admin = requireAdmin(viewer);
  if (decision.status === "declined" && !decision.note) throw new AccessError("CONFLICT", { reason: "NOTE_REQUIRED" });
  const coordinatesGiven = decision.latitude !== undefined || decision.longitude !== undefined;
  if (coordinatesGiven && (decision.latitude == null) !== (decision.longitude == null)) {
    throw new AccessError("CONFLICT", { reason: "COORDINATES_INCOMPLETE" });
  }
  return db.transaction(async (tx) => {
    const [site] = await tx.select({ status: sites.verificationStatus, companyId: sites.companyId }).from(sites).where(eq(sites.id, siteId)).for("update");
    if (!site) throw new AccessError("NOT_FOUND");
    const from = site.status as VerificationStatus;
    const statusChanges = from !== decision.status;
    if (statusChanges && !canTransition(verificationFlow, from, decision.status)) throw new AccessError("CONFLICT", { reason: "TRANSITION" });
    await tx
      .update(sites)
      .set({
        verificationStatus: decision.status,
        verificationNote: decision.note,
        verifiedBy: admin.userId,
        verifiedAt: new Date(),
        ...(coordinatesGiven ? { latitude: decision.latitude ?? null, longitude: decision.longitude ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sites.id, siteId));
    if (decision.status === "verified") {
      // The first verified site names its company: whoever created the company row with a claimed VAT ID before
      // (and was never verified) does not decide how a real company appears to others.
      const [other] = await tx
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.companyId, site.companyId), eq(sites.verificationStatus, "verified"), sql`${sites.id} <> ${siteId}`))
        .limit(1);
      const [account] = await tx.select({ companyName: auth_users.company_name }).from(auth_users).where(eq(auth_users.site_id, siteId));
      if (!other && account?.companyName) await tx.update(companies).set({ name: account.companyName }).where(eq(companies.id, site.companyId));
    }
    if (statusChanges) {
      await tx
        .insert(siteVerificationEvents)
        .values({ siteId, actorUserId: admin.userId, fromStatus: from, toStatus: decision.status, note: decision.note });
    }
    return { id: siteId, status: decision.status };
  });
}
