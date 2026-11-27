// Data Access Layer: negotiations with immutable proposal revisions (L2-006, D16). Routes and pages call only these
// functions; each starts with the access rule (src/server/access.ts) and reads the parties from the database, never
// from the browser. Only the two sites of a negotiation can see it – to anyone else it does not exist.
import "server-only";
import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { AccessError, RuleError, requireCurrentRevision, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { categoryUnits, companies, exchanges, negotiations, offers, proposalRevisions, requests, sites } from "../db/schema";
import { calendarDay } from "../domain/dates";
import { listingRef, requestRef, type DeliveryTerm, type VatBasis } from "../domain/listing";
import {
  changedTerms,
  effectiveNegotiationStatus,
  exchangeRef,
  incotermsVersionOf,
  negotiationActions,
  negotiationRef,
  pairKey,
  termProblems,
  type CostStatus,
  type ExchangeStatus,
  type FreightPayer,
  type NegotiationAction,
  type NegotiationDisplayStatus,
  type NegotiationStatus,
  type PaymentDirection,
  type TermKey,
  type Terms,
  type TransportOrganiser,
} from "../domain/negotiation";
import { effectiveOfferStatus, expiryDate, type OfferStatus } from "../domain/status";
import type { CounterProposal, NegotiationStart, TermsInput } from "../validation/negotiations";

/** Limits against flooding (as for responses): negotiations a site starts per day, revisions per negotiation. */
const MAX_STARTS_PER_SITE_PER_DAY = 20;
const MAX_REVISIONS = 40;
const MAX_LISTED = 200;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type Party = "offerer" | "requester";
export type SiteName = { id: number; name: string; companyName: string };
export type ListingLink = { id: number; ref: string; title: string };

// ── Loading ─────────────────────────────────────────────────────────────────────────────────────────────

/** The parts of an offer a negotiation needs: owner, state, category (permitted units) and demo label. */
async function loadOffer(executor: Executor, offerId: number) {
  const [row] = await executor
    .select({
      id: offers.id,
      title: offers.title,
      status: offers.status,
      expiresAt: offers.expiresAt,
      siteId: offers.siteId,
      categoryId: offers.categoryId,
      provenance: offers.provenance,
      siteVerified: sql<boolean>`${sites.verificationStatus} = 'verified'`,
      siteProvenance: sites.provenance,
      quantity: offers.quantity,
      unitKey: offers.unitKey,
      priceMode: offers.priceMode,
      priceAmount: offers.priceAmount,
      priceUnitKey: offers.priceUnitKey,
      vatBasis: offers.vatBasis,
    })
    .from(offers)
    .innerJoin(sites, eq(offers.siteId, sites.id))
    .where(eq(offers.id, offerId));
  return row ?? null;
}

async function loadRequest(executor: Executor, requestId: number) {
  const [row] = await executor
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      expiresAt: requests.expiresAt,
      siteId: requests.siteId,
      provenance: requests.provenance,
      siteVerified: sql<boolean>`${sites.verificationStatus} = 'verified'`,
      siteProvenance: sites.provenance,
      quantity: requests.quantity,
      unitKey: requests.unitKey,
      deliveryTerms: requests.deliveryTerms,
    })
    .from(requests)
    .innerJoin(sites, eq(requests.siteId, sites.id))
    .where(eq(requests.id, requestId));
  return row ?? null;
}

export async function siteNamesOf(ids: number[]): Promise<Map<number, SiteName>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: sites.id, name: sites.name, companyName: companies.name })
    .from(sites)
    .innerJoin(companies, eq(sites.companyId, companies.id))
    .where(inArray(sites.id, [...new Set(ids)]));
  return new Map(rows.map((row) => [row.id, row]));
}

/** Units permitted for the offer's category. One query on the given executor – inside a transaction it must not
 *  take a second pool connection (security review 2026-11-27: pool exhaustion under parallel starts). */
export async function permittedUnits(executor: Executor, categoryId: number | null): Promise<string[]> {
  if (categoryId == null) return [];
  const rows = await executor.select({ unitKey: categoryUnits.unitKey }).from(categoryUnits).where(eq(categoryUnits.categoryId, categoryId));
  return rows.map((row) => row.unitKey);
}

type RevisionRow = typeof proposalRevisions.$inferSelect;

function termsOf(row: RevisionRow): Terms {
  return {
    quantity: row.quantity,
    unitKey: row.unitKey,
    paymentDirection: row.paymentDirection as PaymentDirection,
    priceAmount: row.priceAmount,
    priceUnitKey: row.priceUnitKey,
    vatBasis: row.vatBasis as VatBasis,
    deliveryTerm: row.deliveryTerm as DeliveryTerm,
    namedPlace: row.namedPlace,
    transportOrganiser: row.transportOrganiser as TransportOrganiser,
    freightAmount: row.freightAmount,
    freightCostStatus: row.freightCostStatus as CostStatus | null,
    freightPayer: row.freightPayer as FreightPayer | null,
    offererSharePercent: row.offererSharePercent,
    deliveryFrom: row.deliveryFrom,
    deliveryUntil: row.deliveryUntil,
    technicalConditions: row.technicalConditions,
  };
}

/** Field problems of the terms, named like the body (`terms.priceAmount`) so the form can mark the field. */
function checkTerms(terms: TermsInput, units: string[]): Terms {
  const problems = termProblems(terms, units, calendarDay());
  if (problems.length > 0) throw new RuleError(problems.map((problem) => ({ field: `terms.${problem.field}`, code: problem.code })));
  return terms;
}

function revisionValues(negotiationId: number, revision: number, siteId: number, userId: string, terms: Terms, note: string | null, validityDays: number) {
  return {
    ...terms, // first: the fields the server sets below can never be overwritten by a term
    negotiationId,
    revision,
    proposedBySiteId: siteId,
    authorUserId: userId,
    namedPlace: terms.namedPlace ?? "",
    incotermsVersion: incotermsVersionOf(terms.deliveryTerm),
    note,
    validUntil: expiryDate(validityDays),
  };
}

// ── Starting a negotiation ──────────────────────────────────────────────────────────────────────────────

export type NegotiationStartView = {
  offer: ListingLink & { quantity: number | null; unitKey: string | null };
  request: (ListingLink & { quantity: number | null; unitKey: string | null }) | null;
  role: Party;
  otherSite: SiteName;
  simulated: boolean;
  permittedUnits: string[];
  /** Already an open negotiation between these sites about this offer → link to it instead of a second one. */
  existingId: number | null;
  /** Prefilled terms from the offer (and request) – the proposer changes what does not fit. */
  defaults: Partial<TermsInput>;
};

/**
 * Who would negotiate with whom: the viewer's site and the other one, from an open offer and optionally a request.
 * If the viewer owns the offer, the request names the requester (an open request of another verified site). If not,
 * the viewer is the requester; a request given must be the viewer's own open one. Both owned or neither involved →
 * not found, like the match page.
 */
async function resolveStart(executor: Executor, siteId: number, ownProvenance: string, offerId: number, requestId: number | null) {
  const offer = await loadOffer(executor, offerId);
  if (!offer || offer.status === "draft" || !offer.siteVerified) throw new AccessError("NOT_FOUND");
  if (effectiveOfferStatus(offer.status as OfferStatus, offer.expiresAt) !== "active") throw new AccessError("CONFLICT", { reason: "UNAVAILABLE" });
  const request = requestId == null ? null : await loadRequest(executor, requestId);
  if (requestId != null && (!request || request.status === "draft" || !request.siteVerified)) throw new AccessError("NOT_FOUND");
  const viewerOffers = offer.siteId === siteId;
  if (viewerOffers) {
    if (!request) throw new RuleError([{ field: "requestId", code: "REQUIRED" }]);
    if (request.siteId === siteId) throw new AccessError("NOT_FOUND"); // a site does not trade with itself
  } else if (request && request.siteId !== siteId) throw new AccessError("NOT_FOUND"); // someone else's request
  if (request && effectiveOfferStatus(request.status as OfferStatus, request.expiresAt) !== "active") throw new AccessError("CONFLICT", { reason: "REQUEST_UNAVAILABLE" });
  const requesterSiteId = viewerOffers ? request!.siteId : siteId;
  // D13: demo data anywhere – the offer, the request or either site, including the viewer's own – makes it simulated
  const simulated = [offer.provenance, offer.siteProvenance, request?.provenance, request?.siteProvenance, ownProvenance].includes("synthetic");
  return { offer, request, role: (viewerOffers ? "offerer" : "requester") as Party, requesterSiteId, simulated };
}

async function openNegotiationId(executor: Executor, offerId: number, requesterSiteId: number): Promise<number | null> {
  const [row] = await executor
    .select({ id: negotiations.id })
    .from(negotiations)
    .where(and(eq(negotiations.offerId, offerId), eq(negotiations.requesterSiteId, requesterSiteId), eq(negotiations.status, "open")));
  return row?.id ?? null;
}

/** Form of the first proposal (`/negotiations/new`): the two listings, the other site and prefilled terms. */
export async function getNegotiationStart(viewer: Viewer, offerId: number, requestId: number | null): Promise<NegotiationStartView> {
  const { site } = requireVerifiedSite(viewer);
  const { offer, request, role, requesterSiteId, simulated } = await resolveStart(db, site.id, await ownProvenance(db, site.id), offerId, requestId);
  const otherId = role === "offerer" ? requesterSiteId : offer.siteId;
  const [names, units, existingId] = await Promise.all([siteNamesOf([otherId]), permittedUnits(db, offer.categoryId), openNegotiationId(db, offer.id, requesterSiteId)]);
  const pays = offer.priceMode === "paid_recovery" ? "offerer_pays" : offer.priceMode === "free" ? "no_payment" : "requester_pays";
  const wantedTerm = (request?.deliveryTerms as DeliveryTerm[] | undefined)?.[0];
  return {
    offer: { id: offer.id, ref: listingRef(offer.id), title: offer.title, quantity: offer.quantity, unitKey: offer.unitKey },
    request: request ? { id: request.id, ref: requestRef(request.id), title: request.title, quantity: request.quantity, unitKey: request.unitKey } : null,
    role,
    otherSite: names.get(otherId)!,
    simulated,
    permittedUnits: units,
    existingId,
    defaults: {
      quantity: request?.quantity ?? offer.quantity ?? undefined,
      unitKey: (request?.quantity != null ? request.unitKey : offer.unitKey) ?? undefined,
      paymentDirection: pays,
      priceAmount: pays === "no_payment" ? null : offer.priceAmount,
      priceUnitKey: pays === "no_payment" ? null : offer.priceUnitKey,
      vatBasis: offer.vatBasis as VatBasis,
      deliveryTerm: wantedTerm ?? "exw",
      transportOrganiser: "requester",
    },
  };
}

async function ownProvenance(executor: Executor, siteId: number): Promise<string> {
  const [row] = await executor.select({ provenance: sites.provenance }).from(sites).where(eq(sites.id, siteId));
  return row?.provenance ?? "synthetic";
}

/** Negotiations the site started in the last 24 hours (first revisions it proposed). */
async function startsToday(executor: Executor, siteId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(proposalRevisions)
    .where(and(eq(proposalRevisions.proposedBySiteId, siteId), eq(proposalRevisions.revision, 1), gt(proposalRevisions.createdAt, since)));
  return row.total;
}

/** First proposal for an open offer (L2-006). One open negotiation per offer and requesting site. */
export async function startNegotiation(viewer: Viewer, input: NegotiationStart): Promise<{ id: number; ref: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  // Cheap refusal before any lock is waited for (as createOffer does); counted again under the lock below.
  if ((await startsToday(db, site.id)) >= MAX_STARTS_PER_SITE_PER_DAY) throw new AccessError("RATE_LIMITED");
  return db.transaction(async (tx) => {
    // Sender row locked: the daily count and the insert run one at a time per site (as for responses).
    const [own] = await tx.select({ provenance: sites.provenance }).from(sites).where(eq(sites.id, site.id)).for("no key update");
    // Offer and request rows shared-locked: a close running at the same moment waits, so nobody starts on a closed listing.
    await tx.select({ id: offers.id }).from(offers).where(eq(offers.id, input.offerId)).for("share");
    if (input.requestId != null) await tx.select({ id: requests.id }).from(requests).where(eq(requests.id, input.requestId)).for("share");
    const { offer, request, role, requesterSiteId, simulated } = await resolveStart(tx, site.id, own.provenance, input.offerId, input.requestId);
    const terms = checkTerms(input.terms, await permittedUnits(tx, offer.categoryId));
    const existing = await openNegotiationId(tx, offer.id, requesterSiteId);
    if (existing != null) throw new AccessError("CONFLICT", { reason: "ALREADY_NEGOTIATING", negotiationId: existing });
    if ((await startsToday(tx, site.id)) >= MAX_STARTS_PER_SITE_PER_DAY) throw new AccessError("RATE_LIMITED");
    const [row] = await tx
      .insert(negotiations)
      .values({
        offerId: offer.id,
        requestId: request?.id ?? null,
        offererSiteId: role === "offerer" ? site.id : offer.siteId,
        requesterSiteId,
        simulated,
      })
      .returning({ id: negotiations.id });
    await tx.insert(proposalRevisions).values(revisionValues(row.id, 1, site.id, userId, terms, input.note, input.validityDays));
    return { id: row.id, ref: negotiationRef(row.id) };
  });
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

export type TermsView = Terms & { incotermsVersion: string | null };

export type NegotiationCard = {
  id: number;
  ref: string;
  status: NegotiationDisplayStatus;
  role: Party;
  /** Whose move it is while open: the counterpart of the current revision. */
  awaiting: "you" | "other" | null;
  offer: ListingLink;
  request: ListingLink | null;
  otherSite: SiteName;
  current: { revision: number; terms: TermsView; validUntil: string; by: "you" | "other" };
  simulated: boolean;
  updatedAt: string;
  exchange: { id: number; ref: string; status: ExchangeStatus } | null;
};

export type RevisionState = "pending" | "expired" | "superseded" | "accepted" | "declined" | "withdrawn";

export type RevisionView = {
  revision: number;
  by: "you" | "other";
  terms: TermsView;
  /** Terms that differ from the revision before (empty for the first). */
  changed: TermKey[];
  note: string | null;
  validUntil: string;
  createdAt: string;
  state: RevisionState;
};

export type NegotiationDetail = NegotiationCard & {
  revisions: RevisionView[];
  /** What the viewer may do now; empty for a site that is not verified (any more). */
  actions: NegotiationAction[];
  /** An agreed negotiation without an exchange can plan one. */
  canPlanExchange: boolean;
  permittedUnits: string[];
  decidedAt: string | null;
  /** Which site took the decision (accepted, declined, withdrew). */
  decidedBy: "you" | "other" | null;
};

type NegotiationRow = typeof negotiations.$inferSelect;

const partyOf = (siteId: number) => or(eq(negotiations.offererSiteId, siteId), eq(negotiations.requesterSiteId, siteId));

function termsView(row: RevisionRow): TermsView {
  return { ...termsOf(row), incotermsVersion: row.incotermsVersion };
}

function revisionState(negotiation: NegotiationRow, row: RevisionRow, now: Date): RevisionState {
  if (row.revision < negotiation.currentRevision) return "superseded";
  if (negotiation.status === "agreed") return "accepted";
  if (negotiation.status === "declined") return "declined";
  if (negotiation.status === "withdrawn") return "withdrawn";
  return row.validUntil.getTime() <= now.getTime() ? "expired" : "pending";
}

async function cards(siteId: number, rows: { negotiation: NegotiationRow; revision: RevisionRow; offerTitle: string; requestTitle: string | null; exchangeId: number | null; exchangeStatus: string | null }[]): Promise<NegotiationCard[]> {
  const now = new Date();
  const names = await siteNamesOf(rows.map(({ negotiation }) => (negotiation.offererSiteId === siteId ? negotiation.requesterSiteId : negotiation.offererSiteId)));
  return rows.map(({ negotiation, revision, offerTitle, requestTitle, exchangeId, exchangeStatus }) => {
    const status = effectiveNegotiationStatus(negotiation.status as NegotiationStatus, revision.validUntil, now);
    const by = revision.proposedBySiteId === siteId ? "you" : "other";
    return {
      id: negotiation.id,
      ref: negotiationRef(negotiation.id),
      status,
      role: negotiation.offererSiteId === siteId ? "offerer" : "requester",
      awaiting: status === "open" ? (by === "you" ? "other" : "you") : null,
      offer: { id: negotiation.offerId, ref: listingRef(negotiation.offerId), title: offerTitle },
      request: negotiation.requestId != null && requestTitle != null ? { id: negotiation.requestId, ref: requestRef(negotiation.requestId), title: requestTitle } : null,
      otherSite: names.get(negotiation.offererSiteId === siteId ? negotiation.requesterSiteId : negotiation.offererSiteId)!,
      current: { revision: revision.revision, terms: termsView(revision), validUntil: revision.validUntil.toISOString(), by },
      simulated: negotiation.simulated,
      updatedAt: negotiation.updatedAt.toISOString(),
      exchange: exchangeId != null ? { id: exchangeId, ref: exchangeRef(exchangeId), status: exchangeStatus as ExchangeStatus } : null,
    };
  });
}

function selectCards() {
  return db
    .select({
      negotiation: negotiations,
      revision: proposalRevisions,
      offerTitle: offers.title,
      requestTitle: requests.title,
      exchangeId: exchanges.id,
      exchangeStatus: exchanges.status,
    })
    .from(negotiations)
    .innerJoin(proposalRevisions, and(eq(proposalRevisions.negotiationId, negotiations.id), eq(proposalRevisions.revision, negotiations.currentRevision)))
    .innerJoin(offers, eq(negotiations.offerId, offers.id))
    .leftJoin(requests, eq(negotiations.requestId, requests.id))
    .leftJoin(exchanges, eq(exchanges.negotiationId, negotiations.id));
}

/** PG-23: every negotiation of the viewer's site, incoming and outgoing, newest change first. */
export async function listNegotiations(viewer: Viewer): Promise<NegotiationCard[]> {
  const { site } = requireSite(viewer);
  const rows = await selectCards().where(partyOf(site.id)).orderBy(desc(negotiations.updatedAt), desc(negotiations.id)).limit(MAX_LISTED);
  return cards(site.id, rows);
}

/** Open negotiation of the viewer about this offer (and site pair) – for "continue" links on match and response pages. */
export async function openNegotiationsFor(viewer: Viewer, offerIds: number[]): Promise<Map<string, number>> {
  const { site } = requireSite(viewer);
  if (offerIds.length === 0) return new Map();
  const rows = await db
    .select({ id: negotiations.id, offerId: negotiations.offerId, requesterSiteId: negotiations.requesterSiteId, offererSiteId: negotiations.offererSiteId })
    .from(negotiations)
    .where(and(inArray(negotiations.offerId, [...new Set(offerIds)]), eq(negotiations.status, "open"), partyOf(site.id)));
  // keyed by offer and the other site, so a list can find the negotiation of exactly its pair
  return new Map(rows.map((row) => [pairKey(row.offerId, row.offererSiteId === site.id ? row.requesterSiteId : row.offererSiteId), row.id]));
}


/** PG-24: one negotiation with every revision. Anyone who is not one of the two sites gets "not found". */
export async function getNegotiation(viewer: Viewer, negotiationId: number): Promise<NegotiationDetail> {
  const { site } = requireSite(viewer);
  const [row] = await selectCards().where(and(eq(negotiations.id, negotiationId), partyOf(site.id)));
  if (!row) throw new AccessError("NOT_FOUND");
  const [[card], revisionRows, offer] = await Promise.all([
    cards(site.id, [row]),
    db.select().from(proposalRevisions).where(eq(proposalRevisions.negotiationId, negotiationId)).orderBy(asc(proposalRevisions.revision)),
    loadOffer(db, row.negotiation.offerId),
  ]);
  const now = new Date();
  const revisions = revisionRows.map((revision, index): RevisionView => ({
    revision: revision.revision,
    by: revision.proposedBySiteId === site.id ? "you" : "other",
    terms: termsView(revision),
    changed: index === 0 ? [] : changedTerms(termsOf(revisionRows[index - 1]), termsOf(revision)),
    note: revision.note,
    validUntil: revision.validUntil.toISOString(),
    createdAt: revision.createdAt.toISOString(),
    state: revisionState(row.negotiation, revision, now),
  }));
  const verified = site.status === "verified";
  const { negotiation } = row;
  return {
    ...card,
    revisions: revisions.reverse(),
    actions: verified ? negotiationActions(card.status, card.current.by === "you") : [],
    canPlanExchange: verified && card.status === "agreed" && card.exchange == null,
    permittedUnits: await permittedUnits(db, offer?.categoryId ?? null),
    decidedAt: negotiation.decidedAt?.toISOString() ?? null,
    decidedBy: negotiation.decidedBySiteId == null ? null : negotiation.decidedBySiteId === site.id ? "you" : "other",
  };
}

// ── Changing a negotiation ──────────────────────────────────────────────────────────────────────────────

/**
 * The state every change starts from, inside the transaction: the negotiation row locked against concurrent
 * decisions, the viewer a party, the browser's revision the current one, the action allowed for the viewer now.
 */
async function lockForAction(tx: Tx, siteId: number, negotiationId: number, expectedRevision: number, wanted: NegotiationAction[]) {
  const [negotiation] = await tx.select().from(negotiations).where(and(eq(negotiations.id, negotiationId), partyOf(siteId))).for("update");
  if (!negotiation) throw new AccessError("NOT_FOUND");
  if (negotiation.status !== "open") throw new AccessError("CONFLICT", { reason: "NEGOTIATION_CLOSED" });
  requireCurrentRevision(negotiation.currentRevision, expectedRevision);
  const [current] = await tx
    .select()
    .from(proposalRevisions)
    .where(and(eq(proposalRevisions.negotiationId, negotiationId), eq(proposalRevisions.revision, negotiation.currentRevision)));
  const status = effectiveNegotiationStatus("open", current.validUntil);
  if (!negotiationActions(status, current.proposedBySiteId === siteId).some((action) => wanted.includes(action))) {
    // the only refusals left: an expired proposal cannot be accepted, and nobody answers their own proposal
    throw new AccessError("CONFLICT", { reason: status === "expired" ? "PROPOSAL_EXPIRED" : "NOT_YOUR_TURN" });
  }
  // Agreeing or proposing needs the listings still open and the other site still verified (security review
  // 2026-11-27): a closed offer cannot be agreed on afterwards. Declining and withdrawing stay possible.
  if (wanted.some((action) => action === "accept" || action === "counter" || action === "repropose")) await requireLive(tx, negotiation, siteId);
  return { negotiation, current };
}

async function requireLive(tx: Tx, negotiation: NegotiationRow, siteId: number) {
  const now = new Date();
  const [offer] = await tx
    .select({ id: offers.id })
    .from(offers)
    .innerJoin(sites, eq(offers.siteId, sites.id))
    .where(and(eq(offers.id, negotiation.offerId), eq(offers.status, "active"), gt(offers.expiresAt, now), eq(sites.verificationStatus, "verified")))
    .for("share", { of: offers });
  if (!offer) throw new AccessError("CONFLICT", { reason: "UNAVAILABLE" });
  if (negotiation.requestId != null) {
    const [request] = await tx
      .select({ id: requests.id })
      .from(requests)
      .where(and(eq(requests.id, negotiation.requestId), eq(requests.status, "active"), gt(requests.expiresAt, now)))
      .for("share");
    if (!request) throw new AccessError("CONFLICT", { reason: "REQUEST_UNAVAILABLE" });
  }
  const otherId = negotiation.offererSiteId === siteId ? negotiation.requesterSiteId : negotiation.offererSiteId;
  const [other] = await tx.select({ id: sites.id }).from(sites).where(and(eq(sites.id, otherId), eq(sites.verificationStatus, "verified")));
  if (!other) throw new AccessError("CONFLICT", { reason: "PARTY_UNAVAILABLE" });
}

/** Counterproposal by the counterpart, or a fresh proposal by either party after expiry. Earlier revisions stay. */
export async function counterPropose(viewer: Viewer, negotiationId: number, input: CounterProposal): Promise<{ id: number; revision: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    // counter while pending (counterpart only), repropose after expiry (either party) – lockForAction decides which applies
    const { negotiation } = await lockForAction(tx, site.id, negotiationId, input.expectedRevision, ["counter", "repropose"]);
    if (negotiation.currentRevision >= MAX_REVISIONS) throw new AccessError("RATE_LIMITED");
    const offer = await loadOffer(tx, negotiation.offerId);
    const terms = checkTerms(input.terms, await permittedUnits(tx, offer?.categoryId ?? null));
    const revision = negotiation.currentRevision + 1;
    await tx.insert(proposalRevisions).values(revisionValues(negotiationId, revision, site.id, userId, terms, input.note, input.validityDays));
    await tx.update(negotiations).set({ currentRevision: revision, updatedAt: new Date() }).where(eq(negotiations.id, negotiationId));
    return { id: negotiationId, revision };
  });
}

/** Accept the current pending revision (only the counterpart, only before it expires) – its terms are then locked. */
export async function acceptProposal(viewer: Viewer, negotiationId: number, expectedRevision: number): Promise<{ id: number; status: "agreed"; acceptedRevision: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    const { negotiation } = await lockForAction(tx, site.id, negotiationId, expectedRevision, ["accept"]);
    await tx
      .update(negotiations)
      .set({ status: "agreed", acceptedRevision: negotiation.currentRevision, decidedAt: new Date(), decidedBySiteId: site.id, decidedByUserId: userId, updatedAt: new Date() })
      .where(eq(negotiations.id, negotiationId));
    return { id: negotiationId, status: "agreed" as const, acceptedRevision: negotiation.currentRevision };
  });
}

/** Decline (counterpart) or withdraw (author, or either party after expiry): ends the negotiation without agreement. */
export async function endNegotiation(viewer: Viewer, negotiationId: number, expectedRevision: number, action: "decline" | "withdraw"): Promise<{ id: number; status: "declined" | "withdrawn" }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const status = action === "decline" ? ("declined" as const) : ("withdrawn" as const);
  return db.transaction(async (tx) => {
    await lockForAction(tx, site.id, negotiationId, expectedRevision, [action]);
    await tx
      .update(negotiations)
      .set({ status, decidedAt: new Date(), decidedBySiteId: site.id, decidedByUserId: userId, updatedAt: new Date() })
      .where(eq(negotiations.id, negotiationId));
    return { id: negotiationId, status };
  });
}

/** For the exchanges module: the agreed negotiation of a party, locked, with its accepted terms. */
export async function lockAgreedNegotiation(tx: Tx, siteId: number, negotiationId: number) {
  const [negotiation] = await tx.select().from(negotiations).where(and(eq(negotiations.id, negotiationId), partyOf(siteId))).for("update");
  if (!negotiation) throw new AccessError("NOT_FOUND");
  if (negotiation.status !== "agreed" || negotiation.acceptedRevision == null) throw new AccessError("CONFLICT", { reason: "NOT_AGREED" });
  return negotiation;
}

export { termsView, type RevisionRow };
