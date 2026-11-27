// Data Access Layer: the only way to the offers. Routes and pages call only these functions.
// Every function starts with the access rule (src/server/access.ts); the owner always comes from the session.
// Station 5 – ORM: Drizzle turns the queries into parameterised SQL (no SQL injection risk).
import "server-only";
import { and, desc, eq, exists, gt, inArray, ne, sql, type SQL } from "drizzle-orm";
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
  companies,
  enquiries,
  industrialParks,
  materialCategories,
  materialForms,
  materialTypes,
  offerAttributeValues,
  offerDeliveryOptions,
  offerRevisions,
  offers,
  sites,
  units,
  attributeDefinitions,
} from "../db/schema";
import { isUnknown, type AttributeValues } from "../domain/attributes";
import { calendarDay } from "../domain/dates";
import { INCOTERMS_VERSION, deliveryMode, isFormalTerm } from "../domain/delivery";
import { coordinatesOf } from "../domain/geo";
import { DELIVERY_TERMS, type Comparator, type DeliveryTerm } from "../domain/listing";
import { payerOf, storedAmount } from "../domain/price";
import { offerProblems } from "../domain/publish";
import { effectiveOfferStatus, expiryDate, type OfferDisplayStatus, type OfferStatus, type VerificationStatus } from "../domain/status";
import type { OfferInput, OfferSearchQuery, OfferUpdate } from "../validation/offers";
import { getCatalogue } from "./catalogue";
import {
  offerCard,
  offerDetail,
  unavailableOffer,
  type OfferCard,
  type OfferDetail,
  type OfferRecord,
  type UnavailableOffer,
} from "./offer-view";

/** Upper limit of listings one search looks at; distances are computed in the application (docs/FEATURES.md). */
const MAX_CANDIDATES = 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const today = () => calendarDay();

// ── Loading ─────────────────────────────────────────────────────────────────────────────────────────────

async function loadRecords(executor: Executor, where: SQL | undefined, limit: number): Promise<OfferRecord[]> {
  const rows = await executor
    .select({
      offer: offers,
      category: { id: materialCategories.id, key: materialCategories.key, nameEn: materialCategories.nameEn, nameDe: materialCategories.nameDe },
      type: { id: materialTypes.id, key: materialTypes.key, nameEn: materialTypes.nameEn, nameDe: materialTypes.nameDe },
      form: { id: materialForms.id, key: materialForms.key, nameEn: materialForms.nameEn, nameDe: materialForms.nameDe },
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
        contactVisible: sites.contactVisible,
        contactName: sites.contactName,
        contactEmail: sites.contactEmail,
        contactPhone: sites.contactPhone,
      },
      companyName: companies.name,
      parkName: industrialParks.name,
    })
    .from(offers)
    .innerJoin(sites, eq(offers.siteId, sites.id))
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .leftJoin(industrialParks, eq(sites.parkId, industrialParks.id))
    .leftJoin(materialCategories, eq(offers.categoryId, materialCategories.id))
    .leftJoin(materialTypes, eq(offers.typeId, materialTypes.id))
    .leftJoin(materialForms, eq(offers.formId, materialForms.id))
    .where(where)
    .orderBy(desc(offers.publishedAt), desc(offers.id))
    .limit(limit);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.offer.id);
  const [options, values] = await Promise.all([
    executor.select().from(offerDeliveryOptions).where(inArray(offerDeliveryOptions.offerId, ids)),
    executor
      .select({
        offerId: offerAttributeValues.offerId,
        key: attributeDefinitions.key,
        valueMin: offerAttributeValues.valueMin,
        valueMax: offerAttributeValues.valueMax,
        comparator: offerAttributeValues.comparator,
        valueText: offerAttributeValues.valueText,
      })
      .from(offerAttributeValues)
      .innerJoin(attributeDefinitions, eq(offerAttributeValues.attributeId, attributeDefinitions.id))
      .where(inArray(offerAttributeValues.offerId, ids)),
  ]);

  return rows.map(({ offer, category, type, form, site, companyName, parkName }) => {
    const attributes: AttributeValues = {};
    for (const value of values) {
      if (value.offerId !== offer.id) continue;
      attributes[value.key] = {
        valueMin: value.valueMin,
        valueMax: value.valueMax,
        comparator: value.comparator as Comparator | null,
        valueText: value.valueText,
      };
    }
    return {
      ...offer,
      status: offer.status as OfferStatus,
      category,
      type,
      form,
      site: { ...site, companyName, parkName, verificationStatus: site.verificationStatus as VerificationStatus },
      deliveryOptions: options
        .filter((option) => option.offerId === offer.id)
        .map(({ term, namedPlace, incotermsVersion, customNote }) => ({ term: term as DeliveryTerm, namedPlace, incotermsVersion, customNote }))
        // fixed order EXW, FCA, DAP, DPU, custom – the same everywhere
        .sort((a, b) => DELIVERY_TERMS.indexOf(a.term) - DELIVERY_TERMS.indexOf(b.term)),
      attributes,
    };
  });
}

async function loadRecord(executor: Executor, offerId: number): Promise<OfferRecord | null> {
  const [record] = await loadRecords(executor, eq(offers.id, offerId), 1);
  return record ?? null;
}

/** Active, not expired, and offered by a verified site – the only listings search, map and contact ever see. */
function discoverable(now: Date): SQL[] {
  return [eq(offers.status, "active"), gt(offers.expiresAt, now), eq(sites.verificationStatus, "verified")];
}

// ── Discovery (L1-013 … L1-016) ─────────────────────────────────────────────────────────────────────────

export type OfferSearchResult = {
  scope: "park" | "radius";
  /** Park the local search looked into. */
  park: { id: number; name: string } | null;
  radiusKm: number | null;
  /** Local search without a known park: the page asks for an area or a radius instead of guessing one. */
  needsArea: boolean;
  /** Radius search from a site without coordinates: no distance can be computed, nothing is filtered by it. */
  originUnknown: boolean;
  offers: OfferCard[];
  /** Matches before the limit. */
  total: number;
  /** Matches whose site has no coordinates: in the list, not on the map. */
  withoutLocation: number;
};

/**
 * Local search in a park or wider search by radius, with the same filters (L1-013, L1-014). The viewer's own
 * offers are left out – they are under "My offers".
 */
export async function searchOffers(viewer: Viewer, query: OfferSearchQuery): Promise<OfferSearchResult> {
  const account = requireBrowse(viewer);
  const own = account.role === "member" ? account.site : null;
  const origin = own ? coordinatesOf(own) : null;
  const now = new Date();

  const parkId = query.scope === "park" ? (query.parkId ?? own?.parkId ?? null) : null;
  // The administrator has no site: without a chosen park the local view lists every active offer.
  const everything = account.role === "admin" && parkId === null;
  const base: OfferSearchResult = {
    scope: query.scope,
    park: null,
    radiusKm: query.scope === "radius" ? query.radiusKm : null,
    needsArea: false,
    originUnknown: query.scope === "radius" && origin === null,
    offers: [],
    total: 0,
    withoutLocation: 0,
  };
  if (query.scope === "park" && parkId === null && !everything) return { ...base, needsArea: true };
  if (parkId !== null) {
    const [park] = await db.select({ id: industrialParks.id, name: industrialParks.name }).from(industrialParks).where(eq(industrialParks.id, parkId));
    if (!park) return { ...base, needsArea: true };
    base.park = park;
  }

  const terms = query.delivery ? DELIVERY_TERMS.filter((term) => deliveryMode(term) === query.delivery) : [];
  const where = and(
    ...discoverable(now),
    own ? ne(offers.siteId, own.id) : undefined,
    parkId !== null ? eq(sites.parkId, parkId) : undefined,
    query.categoryId ? eq(offers.categoryId, query.categoryId) : undefined,
    query.typeId ? eq(offers.typeId, query.typeId) : undefined,
    query.formId ? eq(offers.formId, query.formId) : undefined,
    query.origin ? eq(offers.origin, query.origin) : undefined,
    query.frequency ? eq(offers.frequency, query.frequency) : undefined,
    query.delivery
      ? exists(
          db
            .select({ one: sql`1` })
            .from(offerDeliveryOptions)
            .where(and(eq(offerDeliveryOptions.offerId, offers.id), inArray(offerDeliveryOptions.term, terms))),
        )
      : undefined,
    // Only masses can be compared with a minimum in kg; other units drop out instead of being converted.
    query.minQuantityKg
      ? exists(
          db
            .select({ one: sql`1` })
            .from(units)
            .where(
              and(eq(units.key, offers.unitKey), eq(units.dimension, "mass"), sql`${offers.quantity} * ${units.toBase} >= ${query.minQuantityKg}`),
            ),
        )
      : undefined,
  );

  let cards = (await loadRecords(db, where, MAX_CANDIDATES)).map((record) => offerCard(record, origin, now));
  // Radius: keep what is inside, and what cannot be placed (no coordinates) – labelled, never silently dropped.
  if (query.scope === "radius" && origin !== null) {
    cards = cards.filter((card) => card.distanceKm === null || card.distanceKm <= query.radiusKm);
  }
  const sort = query.sort ?? (query.scope === "radius" ? "distance" : "newest");
  if (sort === "distance") {
    // unknown distances last, in their original (newest first) order
    cards.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (sort === "quantity") {
    cards.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
  }
  return {
    ...base,
    offers: cards.slice(0, query.limit),
    total: cards.length,
    withoutLocation: cards.filter((card) => !card.hasLocation).length,
  };
}

/**
 * One offer (L1-016). The owner sees every state including the draft. Verified members and the administrator
 * see active listings of verified sites in full, and of a closed or expired one only that it is unavailable.
 */
export async function getOffer(viewer: Viewer, offerId: number): Promise<OfferDetail | UnavailableOffer> {
  requireAccount(viewer); // before any query: a guest learns nothing, not even through the response time
  const record = await loadRecord(db, offerId);
  const ownSiteId = siteIdOf(viewer);
  if (record && ownSiteId !== null && record.site.id === ownSiteId) {
    const origin = viewer.role === "member" && viewer.site ? coordinatesOf(viewer.site) : null;
    return offerDetail(record, origin, true);
  }
  const account = requireBrowse(viewer);
  // Unknown id, someone else's draft and a listing of an unverified site all look the same from outside.
  if (!record || record.status === "draft" || record.site.verificationStatus !== "verified") throw new AccessError("NOT_FOUND");
  if (effectiveOfferStatus(record.status, record.expiresAt) !== "active") return unavailableOffer(record);
  const origin = account.role === "member" && account.site ? coordinatesOf(account.site) : null;
  return offerDetail(record, origin, false);
}

/** Active offers of one site for its profile page (L1-018). */
export async function listActiveOffersOfSite(viewer: Viewer, siteId: number): Promise<OfferCard[]> {
  const account = requireBrowse(viewer);
  const origin = account.role === "member" && account.site ? coordinatesOf(account.site) : null;
  const now = new Date();
  const records = await loadRecords(db, and(...discoverable(now), eq(offers.siteId, siteId)), 100);
  return records.map((record) => offerCard(record, origin, now));
}

// ── My offers (L1-004, L1-005, L1-011, L1-012) ──────────────────────────────────────────────────────────

export type MyOffer = OfferCard & { revision: number; updatedAt: string; expiresAt: string | null; enquiryCount: number };

/** All offers of the viewer's own site, every status, newest change first. */
export async function listMyOffers(viewer: Viewer): Promise<MyOffer[]> {
  const { site } = requireSite(viewer);
  const now = new Date();
  const records = await loadRecords(db, eq(offers.siteId, site.id), 500);
  const counts = await db
    .select({ offerId: enquiries.offerId, n: sql<number>`count(*)::int` })
    .from(enquiries)
    .where(eq(enquiries.toSiteId, site.id))
    .groupBy(enquiries.offerId);
  return records
    .map((record) => ({
      ...offerCard(record, null, now),
      revision: record.revision,
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      enquiryCount: counts.find((count) => count.offerId === record.id)?.n ?? 0,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type EditableOffer = { id: number; status: OfferDisplayStatus; revision: number; input: OfferInput };

function toInput(record: OfferRecord): OfferInput {
  return {
    title: record.title,
    description: record.description,
    categoryId: record.category?.id ?? null,
    typeId: record.type?.id ?? null,
    formId: record.form?.id ?? null,
    origin: record.origin as OfferInput["origin"],
    legalStatus: record.legalStatus as OfferInput["legalStatus"],
    wasteCode: record.wasteCode,
    quantity: record.quantity,
    unitKey: record.unitKey,
    minLot: record.minLot,
    frequency: record.frequency as OfferInput["frequency"],
    recurrencePeriod: record.recurrencePeriod as OfferInput["recurrencePeriod"],
    recurrenceQuantity: record.recurrenceQuantity,
    availableFrom: record.availableFrom,
    collectionUntil: record.collectionUntil,
    validityDays: record.validityDays,
    priceMode: record.priceMode as OfferInput["priceMode"],
    priceAmount: record.priceAmount,
    priceUnitKey: record.priceUnitKey,
    vatBasis: record.vatBasis as OfferInput["vatBasis"],
    deliveryOptions: record.deliveryOptions.map(({ term, namedPlace, customNote }) => ({ term, namedPlace, customNote })),
    deliveryPricing: record.deliveryPricing as OfferInput["deliveryPricing"],
    maxDeliveryDistanceKm: record.maxDeliveryDistanceKm,
    packaging: record.packaging as OfferInput["packaging"],
    loadingEquipment: record.loadingEquipment as OfferInput["loadingEquipment"],
    evidenceStatus: record.evidenceStatus as OfferInput["evidenceStatus"],
    datasheetAvailable: record.datasheetAvailable,
    datasheetAccess: record.datasheetAccess as OfferInput["datasheetAccess"],
    photosAvailable: record.photosAvailable,
    sampleAvailable: record.sampleAvailable as OfferInput["sampleAvailable"],
    attributes: record.attributes,
  };
}

/** Own offer of the given id, or NOT_FOUND – another site's offer is indistinguishable from a missing one. */
async function loadOwn(executor: Executor, siteId: number, offerId: number): Promise<OfferRecord> {
  const record = await loadRecord(executor, offerId);
  if (!record || record.site.id !== siteId) throw new AccessError("NOT_FOUND");
  return record;
}

/** Own offer in the shape of the edit form (L1-011). */
export async function getMyOffer(viewer: Viewer, offerId: number): Promise<EditableOffer> {
  const { site } = requireSite(viewer);
  const record = await loadOwn(db, site.id, offerId);
  return {
    id: record.id,
    status: effectiveOfferStatus(record.status, record.expiresAt),
    revision: record.revision,
    input: toInput(record),
  };
}

/** Problems that keep an own offer from being published – shown on the preview page next to the Publish button. */
export async function getPublishProblems(viewer: Viewer, offerId: number) {
  const { site } = requireSite(viewer);
  const record = await loadOwn(db, site.id, offerId);
  return offerProblems(toInput(record), await getCatalogue(), "publish", today());
}

/** Columns of `offers` written from a validated input; owner, status, provenance and revision are set by the caller. */
function offerColumns(input: OfferInput) {
  const amount = input.priceMode ? storedAmount(input.priceMode, input.priceAmount) : null;
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    typeId: input.typeId,
    formId: input.formId,
    origin: input.origin,
    legalStatus: input.legalStatus,
    wasteCode: input.wasteCode,
    quantity: input.quantity,
    unitKey: input.unitKey,
    minLot: input.minLot,
    frequency: input.frequency,
    // a one-off batch has no period and no expected future output
    recurrencePeriod: input.frequency === "recurring" ? input.recurrencePeriod : null,
    recurrenceQuantity: input.frequency === "recurring" ? input.recurrenceQuantity : null,
    availableFrom: input.availableFrom,
    collectionUntil: input.collectionUntil,
    validityDays: input.validityDays,
    priceMode: input.priceMode,
    priceAmount: amount,
    priceUnitKey: amount == null || amount === 0 ? null : input.priceUnitKey,
    vatBasis: input.vatBasis,
    // payment direction follows the mode – the browser cannot claim the requester pays for a paid recovery
    payer: input.priceMode ? payerOf(input.priceMode) : null,
    deliveryPricing: input.deliveryPricing,
    maxDeliveryDistanceKm: input.maxDeliveryDistanceKm,
    packaging: input.packaging,
    loadingEquipment: input.loadingEquipment,
    evidenceStatus: input.evidenceStatus,
    datasheetAvailable: input.datasheetAvailable,
    datasheetAccess: input.datasheetAccess,
    photosAvailable: input.photosAvailable,
    sampleAvailable: input.sampleAvailable,
  };
}

/** Replaces delivery options and attribute values of an offer (inside the caller's transaction). */
async function writeParts(tx: Tx, offerId: number, input: OfferInput, attributeIds: Map<string, number>) {
  await tx.delete(offerDeliveryOptions).where(eq(offerDeliveryOptions.offerId, offerId));
  await tx.delete(offerAttributeValues).where(eq(offerAttributeValues.offerId, offerId));
  if (input.deliveryOptions.length > 0) {
    await tx.insert(offerDeliveryOptions).values(
      input.deliveryOptions.map((option) => ({
        offerId,
        term: option.term,
        namedPlace: isFormalTerm(option.term) ? option.namedPlace : null,
        incotermsVersion: isFormalTerm(option.term) ? INCOTERMS_VERSION : null,
        customNote: isFormalTerm(option.term) ? null : option.customNote,
      })),
    );
  }
  const values = Object.entries(input.attributes)
    .filter(([key, value]) => !isUnknown(value) && attributeIds.has(key))
    .map(([key, value]) => ({
      offerId,
      attributeId: attributeIds.get(key)!,
      valueMin: value.valueMin,
      valueMax: value.valueMax,
      comparator: value.comparator,
      valueText: value.valueText?.trim() || null,
    }));
  if (values.length > 0) await tx.insert(offerAttributeValues).values(values);
}

/** History row of a saved state. Unknown attribute values are left out of the snapshot, like in the tables. */
async function writeRevision(tx: Tx, offerId: number, revision: number, userId: string, action: string, status: string, input: OfferInput) {
  const snapshot = { ...input, attributes: Object.fromEntries(Object.entries(input.attributes).filter(([, value]) => !isUnknown(value))) };
  await tx.insert(offerRevisions).values({ offerId, revision, actorUserId: userId, action, status, snapshot });
}

/** Checks the input against the catalogue and returns the attribute ids of the chosen category. */
async function checkInput(input: OfferInput, mode: "draft" | "publish"): Promise<Map<string, number>> {
  const catalogue = await getCatalogue();
  const problems = offerProblems(input, catalogue, mode, today());
  if (problems.length > 0) throw new RuleError(problems);
  return new Map(catalogue.attributes.filter((definition) => definition.categoryId === input.categoryId).map((definition) => [definition.key, definition.id]));
}

/** A declined site may still read and close its offers, but neither create nor change them (D03). */
function requireEditingSite(viewer: Viewer) {
  const member = requireSite(viewer);
  if (member.site.status === "declined") throw new AccessError("NOT_VERIFIED");
  return member;
}

/** New draft of the viewer's site (L1-005). Publishing is a separate step. */
export async function createOffer(viewer: Viewer, input: OfferInput): Promise<{ id: number; revision: number }> {
  const { site, userId } = requireEditingSite(viewer);
  const attributeIds = await checkInput(input, "draft");
  return db.transaction(async (tx) => {
    // provenance follows the site: a fictional demo site can only create fictional listings
    const [owner] = await tx.select({ provenance: sites.provenance }).from(sites).where(eq(sites.id, site.id));
    const [row] = await tx
      .insert(offers)
      .values({ ...offerColumns(input), siteId: site.id, status: "draft", provenance: owner?.provenance === "synthetic" ? "synthetic" : "self_declared" })
      .returning({ id: offers.id, revision: offers.revision });
    await writeParts(tx, row.id, input, attributeIds);
    await writeRevision(tx, row.id, row.revision, userId, "created", "draft", input);
    return row;
  });
}

/**
 * Bumps the revision of an own offer if `expected` is still current, and applies `set` in the same statement.
 * Zero rows = somebody saved in between (or the offer is not the viewer's) → CONFLICT with the current revision.
 * Callers pass the revision of the record they read and validated – never a number taken from the request
 * (that one is compared first with requireCurrentRevision()).
 */
async function bump(tx: Tx, siteId: number, offerId: number, expected: number, set: Partial<typeof offers.$inferInsert>): Promise<number> {
  const [row] = await tx
    .update(offers)
    .set({ ...set, revision: sql`${offers.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(offers.id, offerId), eq(offers.siteId, siteId), eq(offers.revision, expected)))
    .returning({ revision: offers.revision });
  if (row) return row.revision;
  const [current] = await tx.select({ revision: offers.revision }).from(offers).where(and(eq(offers.id, offerId), eq(offers.siteId, siteId)));
  if (!current) throw new AccessError("NOT_FOUND");
  throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: current.revision });
}

/** Change an own offer (L1-011). A published listing must stay publishable; a closed one cannot be edited. */
export async function updateOffer(viewer: Viewer, offerId: number, input: OfferUpdate): Promise<{ id: number; revision: number }> {
  const { site, userId } = requireEditingSite(viewer);
  const { expectedRevision, ...fields } = input;
  const current = await loadOwn(db, site.id, offerId);
  if (current.status === "closed") throw new AccessError("CONFLICT", { reason: "CLOSED" });
  // A site under review works on drafts only: a published listing is not changed while its site is not verified.
  if (site.status !== "verified" && current.status !== "draft") throw new AccessError("NOT_VERIFIED");
  requireCurrentRevision(current.revision, expectedRevision);
  const attributeIds = await checkInput(fields, current.status === "draft" ? "draft" : "publish");
  return db.transaction(async (tx) => {
    // onto the revision that was read: if a publish slipped in since, this fails instead of bypassing its rules
    const revision = await bump(tx, site.id, offerId, current.revision, offerColumns(fields));
    await writeParts(tx, offerId, fields, attributeIds);
    await writeRevision(tx, offerId, revision, userId, "updated", current.status, fields);
    return { id: offerId, revision };
  });
}

/**
 * Publish a draft or renew a listing (L1-005, D05): only a verified site, only when the publish rules pass.
 * Sets a new expiry date from the validity. Publishing an offer that is already active and not expired is a no-op.
 */
export async function publishOffer(viewer: Viewer, offerId: number, expectedRevision?: number): Promise<{ id: number; revision: number; expiresAt: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const record = await loadOwn(db, site.id, offerId);
  const display = effectiveOfferStatus(record.status, record.expiresAt);
  if (display === "closed") throw new AccessError("CONFLICT", { reason: "CLOSED" });
  if (display === "active" && record.expiresAt) return { id: offerId, revision: record.revision, expiresAt: record.expiresAt.toISOString() };
  requireCurrentRevision(record.revision, expectedRevision);
  const input = toInput(record);
  await checkInput(input, "publish");
  const now = new Date();
  const expiresAt = expiryDate(record.validityDays, now);
  return db.transaction(async (tx) => {
    const revision = await bump(tx, site.id, offerId, record.revision, {
      status: "active",
      publishedAt: record.publishedAt ?? now,
      expiresAt,
      closedAt: null,
    });
    await writeRevision(tx, offerId, revision, userId, display === "expired" ? "renewed" : "published", "active", input);
    return { id: offerId, revision, expiresAt: expiresAt.toISOString() };
  });
}

/** Renew an active or expired listing: validated again, expiry date counted from now (D05). */
export async function renewOffer(viewer: Viewer, offerId: number, expectedRevision?: number): Promise<{ id: number; revision: number; expiresAt: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const record = await loadOwn(db, site.id, offerId);
  if (record.status !== "active") throw new AccessError("CONFLICT", { reason: record.status === "closed" ? "CLOSED" : "NOT_PUBLISHED" });
  requireCurrentRevision(record.revision, expectedRevision);
  const input = toInput(record);
  await checkInput(input, "publish");
  const expiresAt = expiryDate(record.validityDays);
  return db.transaction(async (tx) => {
    const revision = await bump(tx, site.id, offerId, record.revision, { expiresAt });
    await writeRevision(tx, offerId, revision, userId, "renewed", "active", input);
    return { id: offerId, revision, expiresAt: expiresAt.toISOString() };
  });
}

/**
 * Close an own listing (L1-012): stays under My offers, leaves search and map, takes no new enquiries.
 * Closing twice is safe. It records no exchange – there is no such counter in Level 1.
 */
export async function closeOffer(viewer: Viewer, offerId: number): Promise<{ id: number; revision: number; status: "closed" }> {
  const { site, userId } = requireSite(viewer);
  const record = await loadOwn(db, site.id, offerId);
  if (record.status === "closed") return { id: offerId, revision: record.revision, status: "closed" };
  // A draft was never published, so there is nothing to close – it is deleted instead.
  if (record.status === "draft") throw new AccessError("CONFLICT", { reason: "NOT_PUBLISHED" });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(offers)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date(), revision: sql`${offers.revision} + 1` })
      .where(and(eq(offers.id, offerId), eq(offers.siteId, site.id), eq(offers.status, "active")))
      .returning({ revision: offers.revision });
    // lost a race against another close → already closed, still fine
    if (!row) return { id: offerId, revision: record.revision, status: "closed" as const };
    await writeRevision(tx, offerId, row.revision, userId, "closed", "closed", toInput(record));
    return { id: offerId, revision: row.revision, status: "closed" as const };
  });
}

/** Delete an own draft. Published listings are closed, never deleted (their history stays). */
export async function deleteDraft(viewer: Viewer, offerId: number): Promise<{ id: number }> {
  const { site } = requireEditingSite(viewer);
  const [row] = await db
    .delete(offers)
    .where(and(eq(offers.id, offerId), eq(offers.siteId, site.id), eq(offers.status, "draft")))
    .returning({ id: offers.id });
  if (row) return row;
  await loadOwn(db, site.id, offerId); // NOT_FOUND for a foreign or missing offer
  throw new AccessError("CONFLICT", { reason: "NOT_A_DRAFT" });
}

// ── For other Data Access Layer modules (matching, src/server/dal/matches.ts) ───────────────────────────

/** Offer records without an access check – only for DAL modules that checked access themselves. */
export function loadOfferRecordsUnchecked(where: SQL | undefined, limit: number): Promise<OfferRecord[]> {
  return loadRecords(db, where, limit);
}

/** The filter of discoverable offers (active, not expired, verified site), for the same modules. */
export const discoverableOfferFilter = discoverable;
