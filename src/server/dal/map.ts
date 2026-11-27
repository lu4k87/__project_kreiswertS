// Data Access Layer: map data. Two separate projections (D08, D12, X-03):
// - memberMap(): for verified members – parks, verified sites (position rounded to ~100 m), the offers of the
//   same search the list uses, so map and list always agree (L1-019), the open requests of the same area and
//   material filters (Level 2) and the potential collection groups of those offers (L2-010).
// - publicMap(): for everyone – an allow-list of park areas, sites that chose to be listed (placed at their park,
//   never at their address), general material categories of the region (only from three listed sites on) and the
//   simulated pathways. No contact, no address, no quantity, no price can appear in it, whatever the request contains.
import "server-only";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { requireBrowse, type Viewer } from "../access";
import { aggregateOffers, type Aggregation } from "../domain/aggregation";
import { db } from "../db/client";
import { companies, demoCases, materialCategories, offers, sites } from "../db/schema";
import type { DemoPathway } from "../domain/listing";
import type { OfferSearchQuery } from "../validation/offers";
import { getCatalogue } from "./catalogue";
import { listParks } from "./catalogue";
import { searchOffers, type OfferSearchResult } from "./offers";
import { searchRequests, type RequestSearchResult } from "./requests";
import { publicCategories, type PublicCategory } from "./public-view";

/** ~100 m: enough to find a site in its park, not an exact gate address. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export type MapPark = { id: number; name: string; city: string; latitude: number; longitude: number; radiusM: number };

export type MapSite = {
  id: number;
  name: string;
  companyName: string;
  parkId: number | null;
  latitude: number;
  longitude: number;
  capabilities: string[];
  provenance: string;
  /** Matching offers of the current search at this site. */
  offerIds: number[];
  /** Open requests of this site in the same area and material filters. */
  requestIds: number[];
  isOwn: boolean;
};

export type MemberMap = {
  parks: MapPark[];
  sites: MapSite[];
  search: OfferSearchResult;
  /** Open requests of other sites: area, type, form and frequency as in the offer search (the other filters are offer fields). */
  requests: RequestSearchResult;
  /** Potential collection groups of the matching offers (L2-010): totals only, nothing reserved. */
  aggregation: Aggregation;
  /** Verified sites that cannot be drawn because they have no coordinates. */
  sitesWithoutLocation: number;
};

export async function memberMap(viewer: Viewer, query: OfferSearchQuery): Promise<MemberMap> {
  const account = requireBrowse(viewer);
  const ownSiteId = account.role === "member" ? (account.site?.id ?? null) : null;
  const { scope, parkId, radiusKm, categoryId, typeId, formId, frequency, limit } = query;
  const [parks, search, requests, catalogue, siteRows] = await Promise.all([
    listParks(),
    searchOffers(viewer, query),
    searchRequests(viewer, { scope, parkId, radiusKm, categoryId, typeId, formId, frequency, limit }),
    getCatalogue(),
    db
      .select({
        id: sites.id,
        name: sites.name,
        companyName: companies.name,
        parkId: sites.parkId,
        latitude: sites.latitude,
        longitude: sites.longitude,
        capabilities: sites.capabilities,
        provenance: sites.provenance,
      })
      .from(sites)
      .innerJoin(companies, eq(sites.companyId, companies.id))
      .where(eq(sites.verificationStatus, "verified"))
      .limit(1000),
  ]);
  const located = siteRows.filter((site) => site.latitude != null && site.longitude != null);
  return {
    parks: parks.map(({ id, name, city, latitude, longitude, radiusM }) => ({ id, name, city, latitude, longitude, radiusM })),
    sites: located.map((site) => ({
      id: site.id,
      name: site.name,
      companyName: site.companyName,
      parkId: site.parkId,
      latitude: round3(site.latitude!),
      longitude: round3(site.longitude!),
      capabilities: site.capabilities,
      provenance: site.provenance,
      offerIds: search.offers.filter((offer) => offer.site.id === site.id).map((offer) => offer.id),
      requestIds: requests.requests.filter((request) => request.site.id === site.id).map((request) => request.id),
      isOwn: site.id === ownSiteId,
    })),
    search,
    requests,
    aggregation: aggregateOffers(search.offers, catalogue.units),
    sitesWithoutLocation: siteRows.length - located.length,
  };
}

export type PublicMap = {
  parks: (MapPark & {
    /** Sites in this park that agreed to be listed publicly: name only. */
    sites: { name: string; companyName: string; provenance: string }[];
  })[];
  /**
   * General material categories currently offered by publicly listed sites, for the region as a whole and only
   * from MIN_SITES_FOR_AGGREGATE listed sites on – never per park or per site (no quantities either).
   */
  categories: PublicCategory[];
  /** Illustrative pathways between parks. Always simulated – never a completed exchange. */
  pathways: {
    code: string;
    titleEn: string;
    titleDe: string;
    textEn: string;
    textDe: string;
    pathway: DemoPathway;
    simulated: true;
    fromParkId: number | null;
    toParkId: number | null;
  }[];
};

export async function publicMap(): Promise<PublicMap> {
  const now = new Date();
  const listed = and(eq(sites.verificationStatus, "verified"), eq(sites.publicListed, true), isNotNull(sites.parkId));
  const [parks, siteRows, categoryRows, cases] = await Promise.all([
    listParks(),
    db
      .select({ parkId: sites.parkId, name: sites.name, companyName: companies.name, provenance: sites.provenance })
      .from(sites)
      .innerJoin(companies, eq(sites.companyId, companies.id))
      .where(listed)
      .limit(1000),
    db
      .selectDistinct({ key: materialCategories.key, nameEn: materialCategories.nameEn, nameDe: materialCategories.nameDe })
      .from(offers)
      .innerJoin(sites, eq(offers.siteId, sites.id))
      .innerJoin(materialCategories, eq(offers.categoryId, materialCategories.id))
      .where(and(listed, eq(offers.status, "active"), gt(offers.expiresAt, now))),
    db.select().from(demoCases).orderBy(demoCases.code),
  ]);
  // Parks of the sites named in the cases – the pathway is drawn between park areas, not between addresses.
  const caseSiteIds = [...new Set(cases.flatMap((entry) => [entry.fromSiteId, entry.toSiteId]).filter((id): id is number => id != null))];
  const caseSites = caseSiteIds.length
    ? await db.select({ id: sites.id, parkId: sites.parkId }).from(sites).where(inArray(sites.id, caseSiteIds))
    : [];
  const parkOf = (siteId: number | null) => caseSites.find((site) => site.id === siteId)?.parkId ?? null;
  return {
    parks: parks.map(({ id, name, city, latitude, longitude, radiusM }) => ({
      id,
      name,
      city,
      latitude,
      longitude,
      radiusM,
      sites: siteRows.filter((site) => site.parkId === id).map(({ name: siteName, companyName, provenance }) => ({ name: siteName, companyName, provenance })),
    })),
    categories: publicCategories(siteRows.length, categoryRows),
    pathways: cases.map((entry) => ({
      code: entry.code,
      titleEn: entry.titleEn,
      titleDe: entry.titleDe,
      textEn: entry.textEn,
      textDe: entry.textDe,
      pathway: entry.pathway as DemoPathway,
      simulated: true as const,
      fromParkId: parkOf(entry.fromSiteId),
      toParkId: parkOf(entry.toSiteId),
    })),
  };
}

/** The demo cases with their listing, for the "About" page and the labels on listings (L1-021). */
export async function listDemoCases(): Promise<{ code: string; titleEn: string; titleDe: string; textEn: string; textDe: string; pathway: DemoPathway }[]> {
  const rows = await db.select().from(demoCases).orderBy(demoCases.code);
  return rows.map(({ code, titleEn, titleDe, textEn, textDe, pathway }) => ({ code, titleEn, titleDe, textEn, textDe, pathway: pathway as DemoPathway }));
}
