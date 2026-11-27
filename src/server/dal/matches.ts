// Data Access Layer: explained matching between requests and offers (L2-005, PG-21, PG-22). Nothing is stored – every
// result is computed from the current request and offer with src/server/domain/matching.ts, so an edit of either
// side changes the result at once. Only verified sites take part, and only with their own listings on one side.
import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { AccessError, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { companies, industrialParks, offers, requests, sites } from "../db/schema";
import type { Catalogue } from "../domain/catalogue";
import { coordinatesOf, distanceKm } from "../domain/geo";
import { CAPABILITIES, type Capability } from "../domain/listing";
import { RESULT_ORDER, evaluateMatch, type MatchEvaluation, type MatchOffer, type MatchResult } from "../domain/matching";
import { effectiveOfferStatus } from "../domain/status";
import { getCatalogue } from "./catalogue";
import { offerCard, offerDetail, type OfferCard, type OfferDetail, type OfferRecord } from "./offer-view";
import { discoverableOfferFilter, loadOfferRecordsUnchecked } from "./offers";
import { requestCard, requestDetail, matchRequestOf, type RequestCard, type RequestDetail, type RequestRecord } from "./request-view";
import { discoverableRequestFilter, loadRequestRecordsUnchecked } from "./requests";

/** Candidates compared per own listing; beyond this many active listings the comparison has to move into SQL. */
const MAX_CANDIDATES = 1000;
/** Candidates listed per own listing on the overview; the rest is counted (bounded answer, security review 2026-11-27). */
const MAX_LISTED = 20;

export function matchOfferOf(record: OfferRecord): MatchOffer {
  return {
    categoryId: record.category?.id ?? null,
    typeKey: record.type?.key ?? null,
    formKey: record.form?.key ?? null,
    origin: record.origin,
    quantity: record.quantity,
    unitKey: record.unitKey,
    minLot: record.minLot,
    frequency: record.frequency,
    availableFrom: record.availableFrom,
    collectionUntil: record.collectionUntil,
    priceMode: record.priceMode,
    priceAmount: record.priceAmount,
    priceUnitKey: record.priceUnitKey,
    deliveryTerms: record.deliveryOptions.map((option) => option.term),
    evidenceStatus: record.evidenceStatus,
    sampleAvailable: record.sampleAvailable,
    attributes: record.attributes,
  };
}

function evaluate(request: RequestRecord, offer: OfferRecord, catalogue: Catalogue): MatchEvaluation {
  return evaluateMatch(matchRequestOf(request), matchOfferOf(offer), catalogue);
}

export type MatchSummary = { result: MatchResult; steps: Capability[]; unknown: number; preferencesMet: number; preferences: number };

function summary(evaluation: MatchEvaluation): MatchSummary {
  const preferences = evaluation.checks.filter((check) => !check.hard);
  return {
    result: evaluation.result,
    steps: evaluation.steps,
    unknown: evaluation.checks.filter((check) => check.hard && check.outcome === "unknown").length,
    preferencesMet: preferences.filter((check) => check.outcome === "met").length,
    preferences: preferences.length,
  };
}

const bestFirst = <T extends { match: MatchSummary; distanceKm: number | null }>(a: T, b: T) =>
  RESULT_ORDER[a.match.result] - RESULT_ORDER[b.match.result] || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);

export type OfferCandidate = OfferCard & { match: MatchSummary };
export type RequestCandidate = RequestCard & { match: MatchSummary };

export type MatchOverview = {
  /** Per own active request: offers of other sites that are not incompatible, best first. */
  forRequests: { request: RequestCard; candidates: OfferCandidate[]; more: number; incompatible: number }[];
  /** Per own active offer: requests of other sites that are not incompatible, best first. */
  forOffers: { offer: OfferCard; candidates: RequestCandidate[]; more: number; incompatible: number }[];
};

/** PG-21: candidate pairs of the viewer's own active listings. Incompatible pairs are counted, not listed. */
export async function listMatches(viewer: Viewer): Promise<MatchOverview> {
  const { site } = requireVerifiedSite(viewer);
  const now = new Date();
  const origin = coordinatesOf(site);
  const [catalogue, ownRequests, ownOffers] = await Promise.all([
    getCatalogue(),
    loadRequestRecordsUnchecked(and(...discoverableRequestFilter(now), eq(requests.siteId, site.id)), 100),
    loadOfferRecordsUnchecked(and(...discoverableOfferFilter(now), eq(offers.siteId, site.id)), 100),
  ]);
  const requestCategories = [...new Set(ownRequests.map((record) => record.category?.id).filter((id) => id != null))];
  const offerCategories = [...new Set(ownOffers.map((record) => record.category?.id).filter((id) => id != null))];
  const [otherOffers, otherRequests] = await Promise.all([
    requestCategories.length === 0
      ? []
      : loadOfferRecordsUnchecked(and(...discoverableOfferFilter(now), ne(offers.siteId, site.id), inArray(offers.categoryId, requestCategories)), MAX_CANDIDATES),
    offerCategories.length === 0
      ? []
      : loadRequestRecordsUnchecked(and(...discoverableRequestFilter(now), ne(requests.siteId, site.id), inArray(requests.categoryId, offerCategories)), MAX_CANDIDATES),
  ]);

  const forRequests = ownRequests.map((request) => {
    const all = otherOffers
      .filter((offer) => offer.category?.id === request.category?.id)
      .map((offer) => ({ ...offerCard(offer, origin, now), match: summary(evaluate(request, offer, catalogue)) }));
    const candidates = all.filter((candidate) => candidate.match.result !== "incompatible").sort(bestFirst);
    return { request: requestCard(request, null, now), candidates: candidates.slice(0, MAX_LISTED), more: Math.max(0, candidates.length - MAX_LISTED), incompatible: all.length - candidates.length };
  });
  const forOffers = ownOffers.map((offer) => {
    const all = otherRequests
      .filter((request) => request.category?.id === offer.category?.id)
      .map((request) => ({ ...requestCard(request, origin, now), match: summary(evaluate(request, offer, catalogue)) }));
    const candidates = all.filter((candidate) => candidate.match.result !== "incompatible").sort(bestFirst);
    return { offer: offerCard(offer, null, now), candidates: candidates.slice(0, MAX_LISTED), more: Math.max(0, candidates.length - MAX_LISTED), incompatible: all.length - candidates.length };
  });
  return { forRequests, forOffers };
}

export type Processor = { id: number; name: string; companyName: string; parkName: string | null; city: string; capabilities: Capability[]; distanceKm: number | null };

export type MatchDetail = {
  request: RequestDetail;
  offer: OfferDetail;
  evaluation: MatchEvaluation;
  /** "request": the viewer owns the request and looks at an offer; "offer": the other way round. */
  side: "request" | "offer";
  /** Straight line between the two sites; null = one of them has no coordinates. */
  distanceKm: number | null;
  /** Capabilities the requesting site declares itself – a step it can do on its own premises (receiver-side). */
  receiverCapabilities: Capability[];
  /** Verified sites that declare a capability the steps need (L2-009 candidates, not acceptances). */
  processors: Processor[];
};

/**
 * PG-22: one request against one offer, criterion by criterion. The viewer must own exactly one of the two; the
 * other one must be open (active, not expired, verified site). Everything else looks like a missing pair.
 */
export async function getMatch(viewer: Viewer, requestId: number, offerId: number): Promise<MatchDetail> {
  const { site } = requireVerifiedSite(viewer);
  const now = new Date();
  const [[request], [offer], catalogue] = await Promise.all([
    loadRequestRecordsUnchecked(eq(requests.id, requestId), 1),
    loadOfferRecordsUnchecked(eq(offers.id, offerId), 1),
    getCatalogue(),
  ]);
  if (!request || !offer) throw new AccessError("NOT_FOUND");
  const ownsRequest = request.site.id === site.id;
  const ownsOffer = offer.site.id === site.id;
  if (ownsRequest === ownsOffer) throw new AccessError("NOT_FOUND"); // neither, or both (a site does not trade with itself)
  const open = (status: OfferRecord["status"], expiresAt: Date | null, verified: boolean) => verified && effectiveOfferStatus(status, expiresAt, now) === "active";
  const other = ownsRequest ? open(offer.status, offer.expiresAt, offer.site.verificationStatus === "verified") : open(request.status, request.expiresAt, request.site.verificationStatus === "verified");
  const mine = ownsRequest ? request.status !== "draft" : offer.status !== "draft";
  if (!other || !mine) throw new AccessError("NOT_FOUND");

  const evaluation = evaluate(request, offer, catalogue);
  const origin = coordinatesOf(site);
  const receiverCapabilities = request.site.capabilities.filter((capability): capability is Capability => (CAPABILITIES as readonly string[]).includes(capability));
  return {
    request: requestDetail(request, origin, ownsRequest, now),
    offer: offerDetail(offer, origin, ownsOffer, now),
    evaluation,
    side: ownsRequest ? "request" : "offer",
    distanceKm: distanceKm(coordinatesOf(request.site), coordinatesOf(offer.site)),
    receiverCapabilities,
    processors: await processorsFor(evaluation.steps, coordinatesOf(offer.site)),
  };
}

/** Verified sites that declare at least one of the capabilities, nearest to the offer first. */
async function processorsFor(steps: Capability[], from: ReturnType<typeof coordinatesOf>): Promise<Processor[]> {
  if (steps.length === 0) return [];
  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      companyName: companies.name,
      parkName: industrialParks.name,
      city: sites.city,
      latitude: sites.latitude,
      longitude: sites.longitude,
      capabilities: sites.capabilities,
    })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    // jsonb "contains any of": the step names are constants of the code, sent as one text[] parameter
    .where(and(eq(sites.verificationStatus, "verified"), sql`${sites.capabilities} ?| ${`{${steps.join(",")}}`}::text[]`))
    .limit(50);
  return rows
    .map(({ latitude, longitude, capabilities, ...row }) => ({
      ...row,
      capabilities: capabilities.filter((capability): capability is Capability => steps.includes(capability as Capability)),
      distanceKm: distanceKm(from, coordinatesOf({ latitude, longitude })),
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

export type OwnMatch = { id: number; ref: string; title: string; match: MatchSummary };

/** Request detail (PG-20, "Compatibility"): the viewer's own active offers compared with this open request. */
export async function ownOffersForRequest(viewer: Viewer, requestId: number): Promise<OwnMatch[]> {
  const { site } = requireVerifiedSite(viewer);
  const now = new Date();
  const [request] = await loadRequestRecordsUnchecked(and(...discoverableRequestFilter(now), eq(requests.id, requestId), ne(requests.siteId, site.id)), 1);
  if (!request) return [];
  const [catalogue, own] = await Promise.all([
    getCatalogue(),
    loadOfferRecordsUnchecked(and(...discoverableOfferFilter(now), eq(offers.siteId, site.id)), 100),
  ]);
  return own
    .map((offer) => ({ id: offer.id, ref: offerCard(offer, null, now).ref, title: offer.title, match: summary(evaluate(request, offer, catalogue)) }))
    .sort((a, b) => RESULT_ORDER[a.match.result] - RESULT_ORDER[b.match.result]);
}

/** Offer detail (PG-10, "Compatibility"): the viewer's own active requests compared with this open offer. */
export async function ownRequestsForOffer(viewer: Viewer, offerId: number): Promise<OwnMatch[]> {
  const { site } = requireVerifiedSite(viewer);
  const now = new Date();
  const [offer] = await loadOfferRecordsUnchecked(and(...discoverableOfferFilter(now), eq(offers.id, offerId), ne(offers.siteId, site.id)), 1);
  if (!offer) return [];
  const [catalogue, own] = await Promise.all([
    getCatalogue(),
    loadRequestRecordsUnchecked(and(...discoverableRequestFilter(now), eq(requests.siteId, site.id)), 100),
  ]);
  return own
    .map((request) => ({ id: request.id, ref: requestCard(request, null, now).ref, title: request.title, match: summary(evaluate(request, offer, catalogue)) }))
    .sort((a, b) => RESULT_ORDER[a.match.result] - RESULT_ORDER[b.match.result]);
}
