// Data Access Layer: exchanges of agreed negotiations (L2-011, D13, X-05). An exchange exists only for an accepted
// proposal revision; closing a listing or contacting a supplier never creates one. Only the two sites see it; only
// the receiving site (the requester) records receipt and quality. Simulated records never count as verified.
import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { AccessError, RuleError, requireCurrentRevision, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { exchangeEvents, exchanges, negotiations, offers, proposalRevisions } from "../db/schema";
import { calendarDay } from "../domain/dates";
import { listingRef } from "../domain/listing";
import {
  countsAsVerifiedOutcome,
  exchangeActions,
  exchangeRef,
  negotiationRef,
  type ExchangeAction,
  type ExchangeStatus,
  type QualityResult,
} from "../domain/negotiation";
import type { ExchangeCompletion, ExchangePlan, ExchangeUpdate } from "../validation/negotiations";
import { lockAgreedNegotiation, permittedUnits, siteNamesOf, termsView, type ListingLink, type Party, type SiteName, type TermsView } from "./negotiations";

const MAX_LISTED = 200;
/** Changes per exchange and history entries shown (security review 2026-11-27: unbounded history). */
const MAX_CHANGES = 50;
const MAX_EVENTS = 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ExchangeRow = typeof exchanges.$inferSelect;

export type ExchangeCard = {
  id: number;
  ref: string;
  status: ExchangeStatus;
  role: Party;
  negotiation: { id: number; ref: string };
  offer: ListingLink;
  otherSite: SiteName;
  /** Quantity and unit of the accepted revision – what was agreed, not what arrived. */
  agreed: { quantity: number; unitKey: string };
  plannedDate: string;
  received: { quantity: number; unitKey: string; on: string } | null;
  qualityResult: QualityResult | null;
  simulated: boolean;
  /** D13: true only for a completed, non-simulated exchange whose material was not rejected. */
  verifiedOutcome: boolean;
  updatedAt: string;
};

export type ExchangeSummary = { planned: number; completed: number; cancelled: number; verifiedCompleted: number; simulatedCompleted: number };

export type ExchangeEventView = { revision: number; by: "you" | "other"; action: string; status: string; createdAt: string };

export type ExchangeDetail = ExchangeCard & {
  revision: number;
  terms: TermsView;
  acceptedRevision: number;
  planNote: string | null;
  qualityNote: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  events: ExchangeEventView[];
  actions: ExchangeAction[];
  permittedUnits: string[];
};

const partyOf = (siteId: number) => or(eq(exchanges.offererSiteId, siteId), eq(exchanges.requesterSiteId, siteId));

function selectExchanges() {
  return db
    .select({ exchange: exchanges, revision: proposalRevisions, offerId: negotiations.offerId, offerTitle: offers.title, categoryId: offers.categoryId })
    .from(exchanges)
    .innerJoin(negotiations, eq(exchanges.negotiationId, negotiations.id))
    .innerJoin(proposalRevisions, and(eq(proposalRevisions.negotiationId, exchanges.negotiationId), eq(proposalRevisions.revision, exchanges.acceptedRevision)))
    .innerJoin(offers, eq(negotiations.offerId, offers.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof selectExchanges>["where"]>>[number];

async function cards(siteId: number, rows: Row[]): Promise<ExchangeCard[]> {
  const otherOf = (exchange: ExchangeRow) => (exchange.offererSiteId === siteId ? exchange.requesterSiteId : exchange.offererSiteId);
  const names = await siteNamesOf(rows.map(({ exchange }) => otherOf(exchange)));
  return rows.map(({ exchange, revision, offerId, offerTitle }) => {
    const qualityResult = exchange.qualityResult as QualityResult | null;
    const status = exchange.status as ExchangeStatus;
    return {
      id: exchange.id,
      ref: exchangeRef(exchange.id),
      status,
      role: exchange.offererSiteId === siteId ? "offerer" : "requester",
      negotiation: { id: exchange.negotiationId, ref: negotiationRef(exchange.negotiationId) },
      offer: { id: offerId, ref: listingRef(offerId), title: offerTitle },
      otherSite: names.get(otherOf(exchange))!,
      agreed: { quantity: revision.quantity, unitKey: revision.unitKey },
      plannedDate: exchange.plannedDate,
      received:
        exchange.receivedQuantity != null && exchange.receivedUnitKey != null && exchange.receivedOn != null
          ? { quantity: exchange.receivedQuantity, unitKey: exchange.receivedUnitKey, on: exchange.receivedOn }
          : null,
      qualityResult,
      simulated: exchange.simulated,
      verifiedOutcome: countsAsVerifiedOutcome({ status, simulated: exchange.simulated, qualityResult, receivedQuantity: exchange.receivedQuantity }),
      updatedAt: exchange.updatedAt.toISOString(),
    };
  });
}

/** PG-25: the viewer's exchanges, newest change first, with counts that keep simulated and verified apart (D13). */
export async function listExchanges(viewer: Viewer): Promise<{ exchanges: ExchangeCard[]; summary: ExchangeSummary }> {
  const { site } = requireSite(viewer);
  const rows = await selectExchanges().where(partyOf(site.id)).orderBy(desc(exchanges.updatedAt), desc(exchanges.id)).limit(MAX_LISTED);
  const list = await cards(site.id, rows);
  const count = (test: (card: ExchangeCard) => boolean) => list.filter(test).length;
  return {
    exchanges: list,
    summary: {
      planned: count((card) => card.status === "planned"),
      completed: count((card) => card.status === "completed"),
      cancelled: count((card) => card.status === "cancelled"),
      verifiedCompleted: count((card) => card.verifiedOutcome),
      simulatedCompleted: count((card) => card.status === "completed" && card.simulated),
    },
  };
}

/** PG-26: one exchange with the accepted terms and its history. Anyone else gets "not found". */
export async function getExchange(viewer: Viewer, exchangeId: number): Promise<ExchangeDetail> {
  const { site } = requireSite(viewer);
  const [row] = await selectExchanges().where(and(eq(exchanges.id, exchangeId), partyOf(site.id)));
  if (!row) throw new AccessError("NOT_FOUND");
  const [[card], events, units] = await Promise.all([
    cards(site.id, [row]),
    db.select().from(exchangeEvents).where(eq(exchangeEvents.exchangeId, exchangeId)).orderBy(desc(exchangeEvents.revision)).limit(MAX_EVENTS),
    permittedUnits(db, row.categoryId),
  ]);
  const { exchange } = row;
  return {
    ...card,
    revision: exchange.revision,
    terms: termsView(row.revision),
    acceptedRevision: exchange.acceptedRevision,
    planNote: exchange.planNote,
    qualityNote: exchange.qualityNote,
    cancelReason: exchange.cancelReason,
    completedAt: exchange.completedAt?.toISOString() ?? null,
    cancelledAt: exchange.cancelledAt?.toISOString() ?? null,
    events: events
      .map((event) => ({ revision: event.revision, by: event.siteId === site.id ? ("you" as const) : ("other" as const), action: event.action, status: event.status, createdAt: event.createdAt.toISOString() })),
    actions: site.status === "verified" ? exchangeActions(card.status, card.role === "requester") : [],
    permittedUnits: units,
  };
}

/** Lookup for the negotiation page: the exchange of each agreed negotiation the viewer is part of. */
export async function exchangeIdsFor(viewer: Viewer, negotiationIds: number[]): Promise<Map<number, number>> {
  const { site } = requireSite(viewer);
  if (negotiationIds.length === 0) return new Map();
  const rows = await db.select({ id: exchanges.id, negotiationId: exchanges.negotiationId }).from(exchanges).where(and(inArray(exchanges.negotiationId, negotiationIds), partyOf(site.id)));
  return new Map(rows.map((row) => [row.negotiationId, row.id]));
}

function snapshot(exchange: ExchangeRow): Record<string, unknown> {
  const { plannedDate, planNote, receivedQuantity, receivedUnitKey, receivedOn, qualityResult, qualityNote, cancelReason } = exchange;
  return { plannedDate, planNote, receivedQuantity, receivedUnitKey, receivedOn, qualityResult, qualityNote, cancelReason };
}

async function writeEvent(tx: Tx, exchange: ExchangeRow, siteId: number, userId: string, action: string) {
  await tx.insert(exchangeEvents).values({ exchangeId: exchange.id, revision: exchange.revision, siteId, actorUserId: userId, action, status: exchange.status, snapshot: snapshot(exchange) });
}

function requireFuture(date: string, field: string) {
  if (date < calendarDay()) throw new RuleError([{ field, code: "DATE_PAST" }]);
}

/** Plan the exchange of an agreed negotiation (either party). An unaccepted proposal cannot be planned (NT-L2-011). */
export async function planExchange(viewer: Viewer, negotiationId: number, input: ExchangePlan): Promise<{ id: number; ref: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  requireFuture(input.plannedDate, "plannedDate");
  return db.transaction(async (tx) => {
    const negotiation = await lockAgreedNegotiation(tx, site.id, negotiationId);
    const [existing] = await tx.select({ id: exchanges.id }).from(exchanges).where(eq(exchanges.negotiationId, negotiationId));
    if (existing) throw new AccessError("CONFLICT", { reason: "EXCHANGE_EXISTS" });
    const [row] = await tx
      .insert(exchanges)
      .values({
        negotiationId,
        acceptedRevision: negotiation.acceptedRevision!,
        offererSiteId: negotiation.offererSiteId,
        requesterSiteId: negotiation.requesterSiteId,
        plannedDate: input.plannedDate,
        planNote: input.planNote,
        simulated: negotiation.simulated,
      })
      .returning();
    await writeEvent(tx, row, site.id, userId, "planned");
    return { id: row.id, ref: exchangeRef(row.id) };
  });
}

/**
 * Every change of an exchange: the row locked, the viewer a party, the browser's revision the current one and the
 * action allowed for the viewer's role. Applied to exactly that revision, then one history entry.
 */
async function change(viewer: Viewer, exchangeId: number, expectedRevision: number, action: ExchangeAction, set: (exchange: ExchangeRow, tx: Tx) => Promise<Partial<ExchangeRow>> | Partial<ExchangeRow>) {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    const [exchange] = await tx.select().from(exchanges).where(and(eq(exchanges.id, exchangeId), partyOf(site.id))).for("update");
    if (!exchange) throw new AccessError("NOT_FOUND");
    if (exchange.status !== "planned") throw new AccessError("CONFLICT", { reason: "EXCHANGE_CLOSED" });
    requireCurrentRevision(exchange.revision, expectedRevision);
    if (!exchangeActions("planned", exchange.requesterSiteId === site.id).includes(action)) throw new AccessError("FORBIDDEN", { reason: "NOT_RECEIVER" });
    if (exchange.revision >= MAX_CHANGES) throw new AccessError("RATE_LIMITED");
    const [updated] = await tx
      .update(exchanges)
      .set({ ...(await set(exchange, tx)), revision: exchange.revision + 1, updatedAt: new Date() })
      .where(and(eq(exchanges.id, exchangeId), eq(exchanges.revision, exchange.revision)))
      .returning();
    await writeEvent(tx, updated, site.id, userId, action === "update" ? "updated" : action === "complete" ? "completed" : "cancelled");
    return { id: updated.id, revision: updated.revision, status: updated.status as ExchangeStatus };
  });
}

/** Move the planned date or change the note (either party, while planned). */
export function updateExchange(viewer: Viewer, exchangeId: number, input: ExchangeUpdate) {
  requireFuture(input.plannedDate, "plannedDate");
  return change(viewer, exchangeId, input.expectedRevision, "update", () => ({ plannedDate: input.plannedDate, planNote: input.planNote }));
}

/** The receiver records what arrived and the quality check; the exchange is then completed. */
export function completeExchange(viewer: Viewer, exchangeId: number, input: ExchangeCompletion) {
  if (input.receivedOn > calendarDay()) throw new RuleError([{ field: "receivedOn", code: "DATE_FUTURE" }]);
  // Nothing received only goes with a rejected batch – an accepted receipt of 0 would be an empty "outcome".
  if (input.receivedQuantity <= 0 && input.qualityResult !== "rejected") throw new RuleError([{ field: "receivedQuantity", code: "POSITIVE" }]);
  return change(viewer, exchangeId, input.expectedRevision, "complete", async (exchange, tx) => {
    const [agreement] = await tx
      .select({ categoryId: offers.categoryId, decidedAt: negotiations.decidedAt })
      .from(negotiations)
      .innerJoin(offers, eq(negotiations.offerId, offers.id))
      .where(eq(negotiations.id, exchange.negotiationId));
    if (agreement?.decidedAt && input.receivedOn < calendarDay(agreement.decidedAt)) throw new RuleError([{ field: "receivedOn", code: "BEFORE_AGREEMENT" }]);
    if (!(await permittedUnits(tx, agreement?.categoryId ?? null)).includes(input.receivedUnitKey)) throw new RuleError([{ field: "receivedUnitKey", code: "UNIT_NOT_PERMITTED" }]);
    return {
      status: "completed",
      receivedQuantity: input.receivedQuantity,
      receivedUnitKey: input.receivedUnitKey,
      receivedOn: input.receivedOn,
      qualityResult: input.qualityResult,
      qualityNote: input.qualityNote,
      completedAt: new Date(),
    };
  });
}

/** Either party cancels a planned exchange with a reason. Cancelling records no delivery (AT-L2-011). */
export function cancelExchange(viewer: Viewer, exchangeId: number, input: { expectedRevision: number; reason: string }) {
  return change(viewer, exchangeId, input.expectedRevision, "cancel", () => ({ status: "cancelled", cancelReason: input.reason, cancelledAt: new Date() }));
}
