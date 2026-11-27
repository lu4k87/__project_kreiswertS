// Data Access Layer: platform figures for the start page (guests may see them – only totals, no details).
import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { industrialParks, offers, sites } from "../db/schema";

export type PlatformStats = {
  /** Verified sites on the platform */
  businesses: number;
  /** Active, not expired offers of verified sites */
  materials: number;
  /** Industrial parks in the reference data */
  parks: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const verified = eq(sites.verificationStatus, "verified");
  const [[siteRow], [offerRow], [parkRow]] = await Promise.all([
    db.select({ n: count() }).from(sites).where(verified),
    db
      .select({ n: count() })
      .from(offers)
      .innerJoin(sites, eq(offers.siteId, sites.id))
      .where(and(verified, eq(offers.status, "active"), gt(offers.expiresAt, new Date()))),
    db.select({ n: count() }).from(industrialParks),
  ]);
  return { businesses: siteRow?.n ?? 0, materials: offerRow?.n ?? 0, parks: parkRow?.n ?? 0 };
}
