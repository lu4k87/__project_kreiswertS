// Data Access Layer: material requests and their responses (L2-001 … L2-004). Routes and pages call only these
// functions. Every function starts with the access rule (src/server/access.ts); the owner always comes from the
// session. Same lifecycle and stale-edit protection as offers (src/server/dal/offers.ts).
import "server-only";
import { and, desc, eq, exists, gt, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import {
  AccessError,
  RuleError,
  requireAccount,
  requireBrowse,
  requireCurrentRevision,
  requireSite,
  requireVerifiedSite,
  siteIdOf,
  type Viewer,
} from "../access";
import { db } from "../db/client";
import {
  attributeDefinitions,
  companies,
  industrialParks,
  materialCategories,
  materialForms,
  materialTypes,
  offers,
  requestCriteria,
  requestForms,
  requestResponses,
  requestRevisions,
  requestTypes,
  requests,
  sites,
} from "../db/schema";
import { calendarDay } from "../domain/dates";
import { coordinatesOf } from "../domain/geo";
import { listingRef, requestRef, type ClosureReason, type CriterionKind, type DeliveryTerm, type Origin } from "../domain/listing";
import { requestProblems, type Criteria } from "../domain/request-rules";
import { effectiveOfferStatus, expiryDate, type OfferDisplayStatus, type OfferStatus, type VerificationStatus } from "../domain/status";
import type { RequestInput, RequestSearchQuery, RequestUpdate, ResponseInput } from "../validation/requests";
import { getCatalogue } from "./catalogue";
import {
  requestCard,
  requestDetail,
  unavailableRequest,
  type RequestCard,
  type RequestDetail,
  type RequestRecord,
  type UnavailableRequest,
} from "./request-view";

/** Upper limit of requests one search looks at; distances are computed in the application, like the offer search. */
const MAX_CANDIDATES = 1000;
/** Limits against flooding (security review 2026-11-27): responses per sending site and day, drafts per site. */
const MAX_RESPONSES_PER_SITE_PER_DAY = 30;
const MAX_DRAFTS_PER_SITE = 50;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const today = () => calendarDay();

// ── Loading ─────────────────────────────────────────────────────────────────────────────────────────────

async function loadRecords(executor: Executor, where: SQL | undefined, limit: number): Promise<RequestRecord[]> {
  const rows = await executor
    .select({
      request: requests,
      category: { id: materialCategories.id, key: materialCategories.key, nameEn: materialCategories.nameEn, nameDe: materialCategories.nameDe },
      site: {
        id: sites.id,
        name: sites.name,
        industry: sites.industry,
        city: sites.city,
        parkId: sites.parkId,
        latitude: sites.latitude,
        longitude: sites.longitude,
        verificationStatus: sites.verificationStatus,
        capabilities: sites.capabilities,
      },
      companyName: companies.name,
      parkName: industrialParks.name,
    })
    .from(requests)
    .innerJoin(sites, eq(requests.siteId, sites.id))
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    .leftJoin(materialCategories, eq(requests.categoryId, materialCategories.id))
    .where(where)
    .orderBy(desc(requests.publishedAt), desc(requests.id))
    .limit(limit);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.request.id);
  const [types, forms, criteria] = await Promise.all([
    executor
      .select({ requestId: requestTypes.requestId, id: materialTypes.id, key: materialTypes.key, nameEn: materialTypes.nameEn, nameDe: materialTypes.nameDe, sortOrder: materialTypes.sortOrder })
      .from(requestTypes)
      .innerJoin(materialTypes, eq(requestTypes.typeId, materialTypes.id))
      .where(inArray(requestTypes.requestId, ids)),
    executor
      .select({ requestId: requestForms.requestId, id: materialForms.id, key: materialForms.key, nameEn: materialForms.nameEn, nameDe: materialForms.nameDe, sortOrder: materialForms.sortOrder })
      .from(requestForms)
      .innerJoin(materialForms, eq(requestForms.formId, materialForms.id))
      .where(inArray(requestForms.requestId, ids)),
    executor
      .select({
        requestId: requestCriteria.requestId,
        key: attributeDefinitions.key,
        kind: requestCriteria.kind,
        valueMin: requestCriteria.valueMin,
        valueMax: requestCriteria.valueMax,
        valueText: requestCriteria.valueText,
      })
      .from(requestCriteria)
      .innerJoin(attributeDefinitions, eq(requestCriteria.attributeId, attributeDefinitions.id))
      .where(inArray(requestCriteria.requestId, ids)),
  ]);
  const byOrder = (a: { sortOrder: number; id: number }, b: { sortOrder: number; id: number }) => a.sortOrder - b.sortOrder || a.id - b.id;
  const material = ({ id, key, nameEn, nameDe }: { id: number; key: string; nameEn: string; nameDe: string }) => ({ id, key, nameEn, nameDe });

  return rows.map(({ request, category, site, companyName, parkName }) => {
    const own: Criteria = {};
    for (const row of criteria) {
      if (row.requestId !== request.id) continue;
      own[row.key] = { kind: row.kind as CriterionKind, valueMin: row.valueMin, valueMax: row.valueMax, valueText: row.valueText };
    }
    return {
      ...request,
      status: request.status as OfferStatus,
      origins: request.origins as Origin[],
      deliveryTerms: request.deliveryTerms as DeliveryTerm[],
      category,
      types: types.filter((row) => row.requestId === request.id).sort(byOrder).map(material),
      forms: forms.filter((row) => row.requestId === request.id).sort(byOrder).map(material),
      site: { ...site, companyName, parkName, verificationStatus: site.verificationStatus as VerificationStatus },
      criteria: own,
    };
  });
}

async function loadRecord(executor: Executor, requestId: number): Promise<RequestRecord | null> {
  const [record] = await loadRecords(executor, eq(requests.id, requestId), 1);
  return record ?? null;
}

/** Active, not expired, and posted by a verified site – the only requests search, matching and responses see. */
function discoverable(now: Date): SQL[] {
  return [eq(requests.status, "active"), gt(requests.expiresAt, now), eq(sites.verificationStatus, "verified")];
}

// ── Discovery (L2-002) ──────────────────────────────────────────────────────────────────────────────────

export type RequestSearchResult = {
  scope: "park" | "radius";
  park: { id: number; name: string } | null;
  radiusKm: number | null;
  needsArea: boolean;
  originUnknown: boolean;
  requests: RequestCard[];
  total: number;
  withoutLocation: number;
};

/**
 * Open requests in a park or within a radius, with the same filters for both (L2-002). The viewer's own requests
 * are left out – they are under "My requests". Searching requests never touches the offer search.
 */
export async function searchRequests(viewer: Viewer, query: RequestSearchQuery): Promise<RequestSearchResult> {
  const account = requireBrowse(viewer);
  const own = account.role === "member" ? account.site : null;
  const origin = own ? coordinatesOf(own) : null;
  const now = new Date();

  const parkId = query.scope === "park" ? (query.parkId ?? own?.parkId ?? null) : null;
  const everything = account.role === "admin" && parkId === null;
  const base: RequestSearchResult = {
    scope: query.scope,
    park: null,
    radiusKm: query.scope === "radius" ? query.radiusKm : null,
    needsArea: false,
    originUnknown: query.scope === "radius" && origin === null,
    requests: [],
    total: 0,
    withoutLocation: 0,
  };
  if (query.scope === "park" && parkId === null && !everything) return { ...base, needsArea: true };
  if (parkId !== null) {
    const [park] = await db.select({ id: industrialParks.id, name: industrialParks.name }).from(industrialParks).where(eq(industrialParks.id, parkId));
    if (!park) return { ...base, needsArea: true };
    base.park = park;
  }

  // A request "accepts" a type or form when it lists it.
  const where = and(
    ...discoverable(now),
    own ? ne(requests.siteId, own.id) : undefined,
    parkId !== null ? eq(sites.parkId, parkId) : undefined,
    query.categoryId ? eq(requests.categoryId, query.categoryId) : undefined,
    query.typeId
      ? exists(db.select({ one: sql`1` }).from(requestTypes).where(and(eq(requestTypes.requestId, requests.id), eq(requestTypes.typeId, query.typeId))))
      : undefined,
    query.formId
      ? exists(db.select({ one: sql`1` }).from(requestForms).where(and(eq(requestForms.requestId, requests.id), eq(requestForms.formId, query.formId))))
      : undefined,
    query.frequency ? eq(requests.frequency, query.frequency) : undefined,
  );

  let cards = (await loadRecords(db, where, MAX_CANDIDATES)).map((record) => requestCard(record, origin, now));
  if (query.scope === "radius" && origin !== null) {
    cards = cards.filter((card) => card.distanceKm === null || card.distanceKm <= query.radiusKm);
  }
  const sort = query.sort ?? (query.scope === "radius" ? "distance" : "newest");
  if (sort === "distance") cards.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return {
    ...base,
    requests: cards.slice(0, query.limit),
    total: cards.length,
    withoutLocation: cards.filter((card) => !card.hasLocation).length,
  };
}

/**
 * One request (PG-20). The owner sees every state including the draft. Verified members and the administrator see
 * active requests of verified sites in full, and of a closed or expired one only that it is no longer open.
 */
export async function getRequest(viewer: Viewer, requestId: number): Promise<RequestDetail | UnavailableRequest> {
  requireAccount(viewer);
  const record = await loadRecord(db, requestId);
  const ownSiteId = siteIdOf(viewer);
  if (record && ownSiteId !== null && record.site.id === ownSiteId) {
    const origin = viewer.role === "member" && viewer.site ? coordinatesOf(viewer.site) : null;
    return requestDetail(record, origin, true);
  }
  const account = requireBrowse(viewer);
  if (!record || record.status === "draft" || record.site.verificationStatus !== "verified") throw new AccessError("NOT_FOUND");
  if (effectiveOfferStatus(record.status, record.expiresAt) !== "active") return unavailableRequest(record);
  const origin = account.role === "member" && account.site ? coordinatesOf(account.site) : null;
  return requestDetail(record, origin, false);
}

// ── My requests (L2-001, L2-004) ────────────────────────────────────────────────────────────────────────

export type MyRequest = RequestCard & { revision: number; updatedAt: string; expiresAt: string | null; responseCount: number };

/** All requests of the viewer's own site, every status, newest change first, with the number of responses. */
export async function listMyRequests(viewer: Viewer): Promise<MyRequest[]> {
  const { site } = requireSite(viewer);
  const now = new Date();
  const records = await loadRecords(db, eq(requests.siteId, site.id), 500);
  const counts = await db
    .select({ requestId: requestResponses.requestId, n: sql<number>`count(*)::int` })
    .from(requestResponses)
    .where(eq(requestResponses.toSiteId, site.id))
    .groupBy(requestResponses.requestId);
  return records
    .map((record) => ({
      ...requestCard(record, null, now),
      revision: record.revision,
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      responseCount: counts.find((count) => count.requestId === record.id)?.n ?? 0,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type EditableRequest = { id: number; status: OfferDisplayStatus; revision: number; input: RequestInput };

function toInput(record: RequestRecord): RequestInput {
  return {
    title: record.title,
    description: record.description,
    categoryId: record.category?.id ?? null,
    typeIds: record.types.map((type) => type.id),
    formIds: record.forms.map((form) => form.id),
    origins: record.origins,
    quantity: record.quantity,
    unitKey: record.unitKey,
    minLot: record.minLot,
    frequency: record.frequency as RequestInput["frequency"],
    recurrencePeriod: record.recurrencePeriod as RequestInput["recurrencePeriod"],
    neededFrom: record.neededFrom,
    neededUntil: record.neededUntil,
    validityDays: record.validityDays,
    maxPriceAmount: record.maxPriceAmount,
    maxPriceUnitKey: record.maxPriceUnitKey,
    deliveryTerms: record.deliveryTerms,
    evidenceStatus: record.evidenceStatus as RequestInput["evidenceStatus"],
    sampleRequired: record.sampleRequired,
    criteria: record.criteria,
  };
}

/** Own request of the given id, or NOT_FOUND – another site's request is indistinguishable from a missing one. */
async function loadOwn(executor: Executor, siteId: number, requestId: number): Promise<RequestRecord> {
  const record = await loadRecord(executor, requestId);
  if (!record || record.site.id !== siteId) throw new AccessError("NOT_FOUND");
  return record;
}

export async function getMyRequest(viewer: Viewer, requestId: number): Promise<EditableRequest> {
  const { site } = requireSite(viewer);
  const record = await loadOwn(db, site.id, requestId);
  return { id: record.id, status: effectiveOfferStatus(record.status, record.expiresAt), revision: record.revision, input: toInput(record) };
}

/** Problems that keep an own request from being published – shown next to the Publish button. */
export async function getRequestPublishProblems(viewer: Viewer, requestId: number) {
  const { site } = requireSite(viewer);
  const record = await loadOwn(db, site.id, requestId);
  return requestProblems(toInput(record), await getCatalogue(), "publish", today());
}

function requestColumns(input: RequestInput) {
  const recurring = input.frequency === "recurring";
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    origins: input.origins,
    quantity: input.quantity,
    unitKey: input.unitKey,
    minLot: input.minLot,
    frequency: input.frequency,
    recurrencePeriod: recurring ? input.recurrencePeriod : null,
    neededFrom: input.neededFrom,
    neededUntil: input.neededUntil,
    validityDays: input.validityDays,
    maxPriceAmount: input.maxPriceAmount,
    maxPriceUnitKey: input.maxPriceAmount == null ? null : input.maxPriceUnitKey,
    deliveryTerms: input.deliveryTerms,
    evidenceStatus: input.evidenceStatus,
    sampleRequired: input.sampleRequired,
  };
}

/** Replaces accepted types, forms and criteria of a request (inside the caller's transaction). */
async function writeParts(tx: Tx, requestId: number, input: RequestInput, attributeIds: Map<string, number>) {
  await tx.delete(requestTypes).where(eq(requestTypes.requestId, requestId));
  await tx.delete(requestForms).where(eq(requestForms.requestId, requestId));
  await tx.delete(requestCriteria).where(eq(requestCriteria.requestId, requestId));
  if (input.typeIds.length > 0) await tx.insert(requestTypes).values(input.typeIds.map((typeId) => ({ requestId, typeId })));
  if (input.formIds.length > 0) await tx.insert(requestForms).values(input.formIds.map((formId) => ({ requestId, formId })));
  const rows = Object.entries(input.criteria)
    .filter(([key]) => attributeIds.has(key))
    .map(([key, value]) => ({
      requestId,
      attributeId: attributeIds.get(key)!,
      kind: value.kind,
      valueMin: value.valueMin,
      valueMax: value.valueMax,
      valueText: value.valueText?.trim() || null,
    }));
  if (rows.length > 0) await tx.insert(requestCriteria).values(rows);
}

async function writeRevision(tx: Tx, requestId: number, revision: number, userId: string, action: string, status: string, input: RequestInput) {
  await tx.insert(requestRevisions).values({ requestId, revision, actorUserId: userId, action, status, snapshot: { ...input } });
}

async function checkInput(input: RequestInput, mode: "draft" | "publish"): Promise<Map<string, number>> {
  const catalogue = await getCatalogue();
  const problems = requestProblems(input, catalogue, mode, today());
  if (problems.length > 0) throw new RuleError(problems);
  return new Map(catalogue.attributes.filter((definition) => definition.categoryId === input.categoryId).map((definition) => [definition.key, definition.id]));
}

/** A declined site may still read and close its requests, but neither create nor change them (D03). */
function requireEditingSite(viewer: Viewer) {
  const member = requireSite(viewer);
  if (member.site.status === "declined") throw new AccessError("NOT_VERIFIED");
  return member;
}

/** New draft request of the viewer's site (L2-001). Publishing is a separate step. */
export async function createRequest(viewer: Viewer, input: RequestInput): Promise<{ id: number; revision: number }> {
  const { site, userId } = requireEditingSite(viewer);
  const attributeIds = await checkInput(input, "draft");
  return db.transaction(async (tx) => {
    // Lock the own site row: count and insert one request at a time, so parallel calls cannot pass the draft limit.
    const [owner] = await tx.select({ provenance: sites.provenance }).from(sites).where(eq(sites.id, site.id)).for("no key update");
    const [drafts] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(requests)
      .where(and(eq(requests.siteId, site.id), eq(requests.status, "draft")));
    if (drafts.n >= MAX_DRAFTS_PER_SITE) throw new AccessError("RATE_LIMITED");
    const [row] = await tx
      .insert(requests)
      .values({ ...requestColumns(input), siteId: site.id, status: "draft", provenance: owner?.provenance === "synthetic" ? "synthetic" : "self_declared" })
      .returning({ id: requests.id, revision: requests.revision });
    await writeParts(tx, row.id, input, attributeIds);
    await writeRevision(tx, row.id, row.revision, userId, "created", "draft", input);
    return row;
  });
}

/** Bumps the revision of an own request if `expected` is still current – see bump() in offers.ts. */
async function bump(tx: Tx, siteId: number, requestId: number, expected: number, set: Partial<typeof requests.$inferInsert>): Promise<number> {
  const [row] = await tx
    .update(requests)
    .set({ ...set, revision: sql`${requests.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(requests.id, requestId), eq(requests.siteId, siteId), eq(requests.revision, expected)))
    .returning({ revision: requests.revision });
  if (row) return row.revision;
  const [current] = await tx.select({ revision: requests.revision }).from(requests).where(and(eq(requests.id, requestId), eq(requests.siteId, siteId)));
  if (!current) throw new AccessError("NOT_FOUND");
  throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: current.revision });
}

/** Change an own request (L2-004). A published request must stay publishable; a closed one cannot be edited. */
export async function updateRequest(viewer: Viewer, requestId: number, input: RequestUpdate): Promise<{ id: number; revision: number }> {
  const { site, userId } = requireEditingSite(viewer);
  const { expectedRevision, ...fields } = input;
  const current = await loadOwn(db, site.id, requestId);
  if (current.status === "closed") throw new AccessError("CONFLICT", { reason: "REQUEST_CLOSED" });
  if (site.status !== "verified" && current.status !== "draft") throw new AccessError("NOT_VERIFIED");
  requireCurrentRevision(current.revision, expectedRevision);
  const attributeIds = await checkInput(fields, current.status === "draft" ? "draft" : "publish");
  return db.transaction(async (tx) => {
    const revision = await bump(tx, site.id, requestId, current.revision, requestColumns(fields));
    await writeParts(tx, requestId, fields, attributeIds);
    await writeRevision(tx, requestId, revision, userId, "updated", current.status, fields);
    return { id: requestId, revision };
  });
}

/** Publish a draft or re-publish an expired request: verified site, complete request; sets a new expiry date. */
export async function publishRequest(viewer: Viewer, requestId: number, expectedRevision?: number): Promise<{ id: number; revision: number; expiresAt: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const record = await loadOwn(db, site.id, requestId);
  const display = effectiveOfferStatus(record.status, record.expiresAt);
  if (display === "closed") throw new AccessError("CONFLICT", { reason: "REQUEST_CLOSED" });
  if (display === "active" && record.expiresAt) return { id: requestId, revision: record.revision, expiresAt: record.expiresAt.toISOString() };
  requireCurrentRevision(record.revision, expectedRevision);
  const input = toInput(record);
  await checkInput(input, "publish");
  const now = new Date();
  const expiresAt = expiryDate(record.validityDays, now);
  return db.transaction(async (tx) => {
    const revision = await bump(tx, site.id, requestId, record.revision, { status: "active", publishedAt: record.publishedAt ?? now, expiresAt, closedAt: null });
    await writeRevision(tx, requestId, revision, userId, display === "expired" ? "renewed" : "published", "active", input);
    return { id: requestId, revision, expiresAt: expiresAt.toISOString() };
  });
}

/** Renew an active or expired request: validated again, expiry date counted from now. */
export async function renewRequest(viewer: Viewer, requestId: number, expectedRevision?: number): Promise<{ id: number; revision: number; expiresAt: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const record = await loadOwn(db, site.id, requestId);
  if (record.status !== "active") throw new AccessError("CONFLICT", { reason: record.status === "closed" ? "REQUEST_CLOSED" : "NOT_PUBLISHED" });
  requireCurrentRevision(record.revision, expectedRevision);
  const input = toInput(record);
  await checkInput(input, "publish");
  const expiresAt = expiryDate(record.validityDays);
  return db.transaction(async (tx) => {
    const revision = await bump(tx, site.id, requestId, record.revision, { expiresAt });
    await writeRevision(tx, requestId, revision, userId, "renewed", "active", input);
    return { id: requestId, revision, expiresAt: expiresAt.toISOString() };
  });
}

/**
 * Close an own request as fulfilled or withdrawn (L2-004, D05): it leaves search and matching and takes no new
 * responses; existing responses stay readable. Closing twice is safe. It records no exchange.
 */
export async function closeRequest(viewer: Viewer, requestId: number, reason: ClosureReason): Promise<{ id: number; revision: number; status: "closed" }> {
  const { site, userId } = requireSite(viewer);
  const record = await loadOwn(db, site.id, requestId);
  if (record.status === "closed") return { id: requestId, revision: record.revision, status: "closed" };
  if (record.status === "draft") throw new AccessError("CONFLICT", { reason: "NOT_PUBLISHED" });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(requests)
      // the moment the row really changes (after any response holding the share lock has committed), so a response
      // written before the close never carries a later time than the close itself (CWE-367 check in e2e-level2)
      .set({ status: "closed", closureReason: reason, closedAt: sql`clock_timestamp()`, updatedAt: new Date(), revision: sql`${requests.revision} + 1` })
      .where(and(eq(requests.id, requestId), eq(requests.siteId, site.id), eq(requests.status, "active")))
      .returning({ revision: requests.revision });
    if (!row) return { id: requestId, revision: record.revision, status: "closed" as const };
    await writeRevision(tx, requestId, row.revision, userId, "closed", "closed", toInput(record));
    return { id: requestId, revision: row.revision, status: "closed" as const };
  });
}

/** Delete an own draft. Published requests are closed, never deleted (their history and responses stay). */
export async function deleteRequestDraft(viewer: Viewer, requestId: number): Promise<{ id: number }> {
  const { site } = requireEditingSite(viewer);
  const [row] = await db
    .delete(requests)
    .where(and(eq(requests.id, requestId), eq(requests.siteId, site.id), eq(requests.status, "draft")))
    .returning({ id: requests.id });
  if (row) return row;
  await loadOwn(db, site.id, requestId);
  throw new AccessError("CONFLICT", { reason: "NOT_A_DRAFT" });
}

// ── Responses (L2-003) ──────────────────────────────────────────────────────────────────────────────────

export type ResponseView = {
  id: number;
  direction: "received" | "sent";
  request: { id: number; ref: string; title: string };
  /** The response answered an earlier version of the request. Only this yes/no leaves the server – revision numbers
   *  would let a responder watch how often a competitor changes its request. */
  answeredOlder: boolean;
  otherSite: { id: number; name: string; companyName: string };
  offer: { id: number; ref: string; title: string } | null;
  message: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
};

/**
 * Respond to an open request of another verified site (L2-003). One response per site and request, optionally
 * pointing at one of the responder's own active offers. A closed or expired request takes none.
 */
export async function createResponse(viewer: Viewer, requestId: number, input: ResponseInput): Promise<{ id: number; ref: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const record = await loadRecord(db, requestId);
  if (!record || record.status === "draft" || record.site.verificationStatus !== "verified") throw new AccessError("NOT_FOUND");
  if (record.site.id === site.id) throw new AccessError("CONFLICT", { reason: "OWN_REQUEST" });
  if (effectiveOfferStatus(record.status, record.expiresAt) !== "active") throw new AccessError("CONFLICT", { reason: "REQUEST_UNAVAILABLE" });
  if (input.offerId != null) {
    // only an own listing that others can see – never another company's offer id
    const [offer] = await db
      .select({ id: offers.id })
      .from(offers)
      .where(and(eq(offers.id, input.offerId), eq(offers.siteId, site.id), eq(offers.status, "active"), gt(offers.expiresAt, new Date())));
    if (!offer) throw new RuleError([{ field: "offerId", code: "NOT_OWN_OFFER" }]);
  }
  const [existing] = await db
    .select({ id: requestResponses.id })
    .from(requestResponses)
    .where(and(eq(requestResponses.requestId, requestId), eq(requestResponses.fromSiteId, site.id)));
  if (existing) throw new AccessError("CONFLICT", { reason: "ALREADY_RESPONDED" });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    // Sender row locked: the daily count and the insert run one at a time per sender (as for enquiries).
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, site.id)).for("no key update");
    // Request row shared-locked and checked again: a close or edit running at the same moment waits for this
    // insert (or this one sees it), so no response lands on a closed request or names an outdated revision.
    const [open] = await tx
      .select({ revision: requests.revision })
      .from(requests)
      .innerJoin(sites, eq(requests.siteId, sites.id))
      .where(and(eq(requests.id, requestId), ...discoverable(new Date())))
      .for("share", { of: requests });
    if (!open) throw new AccessError("CONFLICT", { reason: "REQUEST_UNAVAILABLE" });
    const [sent] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(requestResponses)
      .where(and(eq(requestResponses.fromSiteId, site.id), gt(requestResponses.createdAt, since)));
    if (sent.total >= MAX_RESPONSES_PER_SITE_PER_DAY) throw new AccessError("RATE_LIMITED");
    const [row] = await tx
      .insert(requestResponses)
      .values({
        requestId,
        fromSiteId: site.id,
        toSiteId: record.site.id,
        senderUserId: userId,
        offerId: input.offerId,
        requestRevision: open.revision,
        message: input.message,
      })
      .returning({ id: requestResponses.id });
    return { id: row.id, ref: requestRef(requestId) };
  });
}

/**
 * Responses the viewer may read (L2-003): those received for the own requests and those the own site sent – never
 * a response between two other sites. `requestId` limits the list to one request.
 */
export async function listResponses(viewer: Viewer, requestId?: number): Promise<ResponseView[]> {
  const { site } = requireSite(viewer);
  const rows = await db
    .select({
      response: requestResponses,
      requestTitle: requests.title,
      requestRevision: requests.revision,
      offerTitle: offers.title,
    })
    .from(requestResponses)
    .innerJoin(requests, eq(requestResponses.requestId, requests.id))
    .leftJoin(offers, eq(requestResponses.offerId, offers.id))
    .where(
      and(
        or(eq(requestResponses.toSiteId, site.id), eq(requestResponses.fromSiteId, site.id)),
        requestId === undefined ? undefined : eq(requestResponses.requestId, requestId),
      ),
    )
    .orderBy(desc(requestResponses.createdAt), desc(requestResponses.id))
    .limit(200);
  if (rows.length === 0) return [];
  const otherIds = [...new Set(rows.map(({ response }) => (response.toSiteId === site.id ? response.fromSiteId : response.toSiteId)))];
  const others = await db
    .select({ id: sites.id, name: sites.name, companyName: companies.name })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .where(inArray(sites.id, otherIds));
  return rows.map(({ response, requestTitle, requestRevision, offerTitle }) => {
    const received = response.toSiteId === site.id;
    const otherId = received ? response.fromSiteId : response.toSiteId;
    const other = others.find((candidate) => candidate.id === otherId)!;
    return {
      id: response.id,
      direction: received ? "received" : "sent",
      request: { id: response.requestId, ref: requestRef(response.requestId), title: requestTitle },
      answeredOlder: response.requestRevision !== requestRevision,
      otherSite: other,
      offer: response.offerId != null && offerTitle != null ? { id: response.offerId, ref: listingRef(response.offerId), title: offerTitle } : null,
      message: response.message,
      reply: response.reply,
      repliedAt: response.repliedAt?.toISOString() ?? null,
      createdAt: response.createdAt.toISOString(),
    };
  });
}

/** The requester replies once to a received response (verified site only). */
export async function replyToResponse(viewer: Viewer, responseId: number, reply: string): Promise<{ id: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const [row] = await db
    .update(requestResponses)
    .set({ reply, repliedAt: new Date(), replierUserId: userId })
    .where(and(eq(requestResponses.id, responseId), eq(requestResponses.toSiteId, site.id), isNull(requestResponses.reply)))
    .returning({ id: requestResponses.id });
  if (row) return row;
  const [existing] = await db
    .select({ id: requestResponses.id })
    .from(requestResponses)
    .where(and(eq(requestResponses.id, responseId), eq(requestResponses.toSiteId, site.id)));
  if (!existing) throw new AccessError("NOT_FOUND");
  throw new AccessError("CONFLICT", { reason: "ALREADY_ANSWERED" });
}

// ── For other Data Access Layer modules (matching, src/server/dal/matches.ts) ───────────────────────────

/** Request records without an access check – only for DAL modules that checked access themselves. */
export function loadRequestRecordsUnchecked(where: SQL | undefined, limit: number): Promise<RequestRecord[]> {
  return loadRecords(db, where, limit);
}

export const discoverableRequestFilter = discoverable;
