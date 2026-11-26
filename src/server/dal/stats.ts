// Data Access Layer: platform figures for the start page (guests may see them – only totals, no details).
import "server-only";
import { count } from "drizzle-orm";
import { db } from "../db/client";
import { offers, sites } from "../db/schema";

export type PlatformStats = {
  /** Businesses (sites) on the platform */
  businesses: number;
  /** listed offers; a filter for "active" follows once the status values for offers.status are settled */
  materials: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [[siteRow], [offerRow]] = await Promise.all([
    db.select({ n: count() }).from(sites),
    db.select({ n: count() }).from(offers),
  ]);
  return { businesses: siteRow?.n ?? 0, materials: offerRow?.n ?? 0 };
}
