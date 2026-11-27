// Data Access Layer: saved searches and in-app notices (function no. 19). Both belong to a site, never to a single
// account – every member of the site sees and manages them, nobody else (access rule: the site id of the session).
import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { AccessError, RuleError, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { notifications, offers, savedSearches, sites } from "../db/schema";
import { findUnit } from "../domain/catalogue";
import { listingRef } from "../domain/listing";
import { MAX_SAVED_SEARCHES, matchesSavedSearch, type SavedSearchFilters } from "../domain/saved-search";
import { effectiveOfferStatus, type OfferDisplayStatus, type OfferStatus } from "../domain/status";
import { savedSearchFilters, type SavedSearchInput } from "../validation/saved-searches";
import { getCatalogue } from "./catalogue";
import type { OfferRecord } from "./offer-view";

export type SavedSearch = { id: number; name: string; filters: SavedSearchFilters; createdAt: string };

export type Notification = {
  id: number;
  createdAt: string;
  read: boolean;
  search: { id: number; name: string };
  offer: { id: number; ref: string; title: string; status: OfferDisplayStatus };
};

/** How many notices the page lists; older ones stay in the database and still count as unread. */
const MAX_LISTED = 50;

/** Stored filters read back through the schema – a row that no longer parses is skipped, never trusted. */
function filtersOf(stored: unknown): SavedSearchFilters | null {
  const parsed = savedSearchFilters.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

// ── Saved searches ──────────────────────────────────────────────────────────────────────────────────────

export async function listSavedSearches(viewer: Viewer): Promise<SavedSearch[]> {
  const { site } = requireSite(viewer);
  const rows = await db.select().from(savedSearches).where(eq(savedSearches.siteId, site.id)).orderBy(desc(savedSearches.createdAt), desc(savedSearches.id));
  return rows.flatMap((row) => {
    const filters = filtersOf(row.filters);
    return filters ? [{ id: row.id, name: row.name, filters, createdAt: row.createdAt.toISOString() }] : [];
  });
}

/** Save the current filters of /offers. Only a verified site – only it can search. At most MAX_SAVED_SEARCHES. */
export async function createSavedSearch(viewer: Viewer, input: SavedSearchInput): Promise<{ id: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    // lock the site row: two parallel saves cannot both pass the limit
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, site.id)).for("update");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(savedSearches).where(eq(savedSearches.siteId, site.id));
    if (n >= MAX_SAVED_SEARCHES) throw new RuleError([{ field: "name", code: "TOO_MANY" }]);
    const [row] = await tx
      .insert(savedSearches)
      .values({ siteId: site.id, createdByUserId: userId, name: input.name, filters: input.query })
      .returning({ id: savedSearches.id });
    return { id: row.id };
  });
}

/** Delete a saved search of the own site; its notices go with it. Someone else's search looks like an unknown id. */
export async function deleteSavedSearch(viewer: Viewer, searchId: number): Promise<{ id: number }> {
  const { site } = requireSite(viewer);
  const deleted = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, searchId), eq(savedSearches.siteId, site.id)))
    .returning({ id: savedSearches.id });
  if (deleted.length === 0) throw new AccessError("NOT_FOUND");
  return { id: searchId };
}

// ── Notices ─────────────────────────────────────────────────────────────────────────────────────────────

/** Notices whose offer still belongs to a verified site – the same listings search and detail page show. */
const visible = (siteId: number) => and(eq(notifications.siteId, siteId), eq(sites.verificationStatus, "verified"));

export async function listNotifications(viewer: Viewer): Promise<{ unread: number; items: Notification[] }> {
  const { site } = requireSite(viewer);
  const [rows, unread] = await Promise.all([
    db
      .select({
        id: notifications.id,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        searchId: savedSearches.id,
        searchName: savedSearches.name,
        offerId: offers.id,
        title: offers.title,
        status: offers.status,
        expiresAt: offers.expiresAt,
      })
      .from(notifications)
      .innerJoin(savedSearches, eq(notifications.savedSearchId, savedSearches.id))
      .innerJoin(offers, eq(notifications.offerId, offers.id))
      .innerJoin(sites, eq(offers.siteId, sites.id))
      .where(visible(site.id))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(MAX_LISTED),
    countUnread(site.id),
  ]);
  const now = new Date();
  return {
    unread,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
      search: { id: row.searchId, name: row.searchName },
      offer: { id: row.offerId, ref: listingRef(row.offerId), title: row.title, status: effectiveOfferStatus(row.status as OfferStatus, row.expiresAt, now) },
    })),
  };
}

async function countUnread(siteId: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .innerJoin(offers, eq(notifications.offerId, offers.id))
    .innerJoin(sites, eq(offers.siteId, sites.id))
    .where(and(visible(siteId), isNull(notifications.readAt)));
  return n;
}

/** Unread notices for the bell in the header: 0 for everyone without a site (guest, administrator, unfinished). */
export async function unreadNotificationCount(viewer: Viewer): Promise<number> {
  if (viewer.role !== "member" || !viewer.site) return 0;
  return countUnread(viewer.site.id);
}

/** Mark notices of the own site as read: the given ones, or all. Ids of other sites are ignored, never revealed. */
export async function markNotificationsRead(viewer: Viewer, ids?: number[]): Promise<{ updated: number }> {
  const { site } = requireSite(viewer);
  if (ids && ids.length === 0) return { updated: 0 };
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.siteId, site.id), isNull(notifications.readAt), ids ? inArray(notifications.id, ids) : undefined))
    .returning({ id: notifications.id });
  return { updated: updated.length };
}

/**
 * Check at publish time (called by publishOffer after its transaction): one notice for every other verified site with
 * a saved search whose list would now show the offer – once per site, under its oldest matching search. A notice that
 * already exists is kept (republishing after an expiry does not notify twice). Returns the number of new notices.
 */
export async function notifySavedSearches(record: OfferRecord): Promise<number> {
  if (record.status !== "active" || record.site.verificationStatus !== "verified") return 0;
  const [searches, catalogue] = await Promise.all([
    db
      .select({ id: savedSearches.id, siteId: savedSearches.siteId, filters: savedSearches.filters, parkId: sites.parkId, latitude: sites.latitude, longitude: sites.longitude })
      .from(savedSearches)
      .innerJoin(sites, eq(savedSearches.siteId, sites.id))
      .where(and(eq(sites.verificationStatus, "verified"), ne(savedSearches.siteId, record.site.id)))
      .orderBy(asc(savedSearches.id)),
    getCatalogue(),
  ]);
  const offer = {
    siteId: record.site.id,
    parkId: record.site.parkId,
    latitude: record.site.latitude,
    longitude: record.site.longitude,
    categoryId: record.category?.id ?? null,
    typeId: record.type?.id ?? null,
    formId: record.form?.id ?? null,
    origin: record.origin,
    frequency: record.frequency,
    deliveryTerms: record.deliveryOptions.map((option) => option.term),
    quantity: record.quantity,
    unit: findUnit(catalogue, record.unitKey),
  };
  const matching = searches.filter((search) => {
    const filters = filtersOf(search.filters);
    return filters !== null && matchesSavedSearch(filters, { siteId: search.siteId, parkId: search.parkId, latitude: search.latitude, longitude: search.longitude }, offer);
  });
  const firstPerSite = new Map<number, (typeof matching)[number]>();
  for (const search of matching) if (!firstPerSite.has(search.siteId)) firstPerSite.set(search.siteId, search); // ordered by id
  if (firstPerSite.size === 0) return 0;
  const inserted = await db
    .insert(notifications)
    .values([...firstPerSite.values()].map((search) => ({ siteId: search.siteId, savedSearchId: search.id, offerId: record.id })))
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  return inserted.length;
}
