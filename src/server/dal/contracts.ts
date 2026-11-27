// Data Access Layer: contracts of agreed negotiations (Level 2, contract execution). A contract is an immutable
// snapshot of the accepted revision, identified by its SHA-256 hash; both sites sign it once, recording who and
// when. Only the two sites see it – to anyone else it does not exist. The execution (delivery, payment) is derived
// from the exchange and the payment on every read.
import "server-only";
import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne, or } from "drizzle-orm";
import { AccessError, requireCurrentRevision, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { auth_users } from "../db/auth-schema";
import { contractEvents, contracts, exchanges, offers, payments, proposalRevisions, requests } from "../db/schema";
import { findUnit, type Catalogue } from "../domain/catalogue";
import { canonicalJson, contractActions, contractExecution, contractRef, type ContractAction, type ContractStatus, type Execution } from "../domain/contract";
import { listingRef, requestRef } from "../domain/listing";
import { exchangeRef, negotiationRef, type ExchangeStatus, type QualityResult } from "../domain/negotiation";
import { paymentAmount, type PaymentAmount, type PaymentStatus } from "../domain/payment";
import type { ContractSign, ContractVoid } from "../validation/contracts";
import { getCatalogue } from "./catalogue";
import { lockAgreedNegotiation, siteNamesOf, termsView, type ListingLink, type Party, type SiteName, type TermsView } from "./negotiations";

/** Changes per contract (created, two signatures, void) – a ceiling far above normal use. */
const MAX_CHANGES = 10;
/** Contracts per negotiation, voided ones included (security review 2026-11-27, CWE-770: create/void loop). */
const MAX_CONTRACTS_PER_NEGOTIATION = 5;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;
type ContractRow = typeof contracts.$inferSelect;

/** What both sites signed. Written once; its hash identifies it. */
export type ContractSnapshot = {
  version: 1;
  negotiation: { id: number; ref: string };
  acceptedRevision: number;
  agreedAt: string | null;
  offer: ListingLink;
  request: ListingLink | null;
  offerer: { siteId: number; site: string; company: string };
  requester: { siteId: number; site: string; company: string };
  terms: TermsView;
  simulated: boolean;
};

export function snapshotHash(snapshot: unknown): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

/** Amount the accepted terms call for (net, in cents) – shared with the payment module. */
export function termsAmount(terms: TermsView, catalogue: Catalogue): PaymentAmount | null {
  const unit = findUnit(catalogue, terms.unitKey);
  if (!unit) return null;
  return paymentAmount(terms, unit, findUnit(catalogue, terms.priceUnitKey));
}

const partyOf = (siteId: number) => or(eq(contracts.offererSiteId, siteId), eq(contracts.requesterSiteId, siteId));

/** The contract of a negotiation that is not voided, if any. */
export async function liveContractOf(executor: Executor, negotiationId: number): Promise<ContractRow | null> {
  const [row] = await executor.select().from(contracts).where(and(eq(contracts.negotiationId, negotiationId), ne(contracts.status, "voided")));
  return row ?? null;
}

// ── Creating ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Either site of an agreed negotiation creates the contract from the accepted revision. The snapshot is built from
 * the database only (terms, listing, parties), never from the browser. One contract per negotiation unless voided.
 */
export async function createContract(viewer: Viewer, negotiationId: number): Promise<{ id: number; ref: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    const negotiation = await lockAgreedNegotiation(tx, site.id, negotiationId);
    const existing = await liveContractOf(tx, negotiationId);
    if (existing) throw new AccessError("CONFLICT", { reason: "CONTRACT_EXISTS", contractId: existing.id });
    // counted under the lock of the negotiation row, so parallel creates cannot pass it
    const [{ n }] = await tx.select({ n: count() }).from(contracts).where(eq(contracts.negotiationId, negotiationId));
    if (n >= MAX_CONTRACTS_PER_NEGOTIATION) throw new AccessError("RATE_LIMITED");
    // one query after the other: a transaction holds one connection
    const [revision] = await tx.select().from(proposalRevisions).where(and(eq(proposalRevisions.negotiationId, negotiationId), eq(proposalRevisions.revision, negotiation.acceptedRevision!)));
    const [offer] = await tx.select({ title: offers.title }).from(offers).where(eq(offers.id, negotiation.offerId));
    const [request] = negotiation.requestId == null ? [] : await tx.select({ title: requests.title }).from(requests).where(eq(requests.id, negotiation.requestId));
    const names = await siteNamesOf([negotiation.offererSiteId, negotiation.requesterSiteId]);
    if (!revision || !offer) throw new AccessError("NOT_FOUND");
    const party = (siteId: number) => {
      const name = names.get(siteId)!;
      return { siteId, site: name.name, company: name.companyName };
    };
    const snapshot: ContractSnapshot = {
      version: 1,
      negotiation: { id: negotiationId, ref: negotiationRef(negotiationId) },
      acceptedRevision: revision.revision,
      agreedAt: negotiation.decidedAt?.toISOString() ?? null,
      offer: { id: negotiation.offerId, ref: listingRef(negotiation.offerId), title: offer.title },
      request: negotiation.requestId != null && request ? { id: negotiation.requestId, ref: requestRef(negotiation.requestId), title: request.title } : null,
      offerer: party(negotiation.offererSiteId),
      requester: party(negotiation.requesterSiteId),
      terms: termsView(revision),
      simulated: negotiation.simulated,
    };
    const [row] = await tx
      .insert(contracts)
      .values({
        negotiationId,
        acceptedRevision: revision.revision,
        offererSiteId: negotiation.offererSiteId,
        requesterSiteId: negotiation.requesterSiteId,
        snapshot,
        snapshotHash: snapshotHash(snapshot),
        simulated: negotiation.simulated,
        createdBySiteId: site.id,
        createdByUserId: userId,
      })
      .returning();
    await tx.insert(contractEvents).values({ contractId: row.id, revision: 1, siteId: site.id, actorUserId: userId, action: "created", status: row.status });
    return { id: row.id, ref: contractRef(row.id) };
  });
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

export type Signature = { at: string; by: string; you: boolean } | null;

export type ContractSummary = { id: number; ref: string; status: ContractStatus; execution: Execution };

export type ContractDetail = ContractSummary & {
  revision: number;
  role: Party;
  otherSite: SiteName;
  snapshot: ContractSnapshot;
  hash: string;
  /** The stored snapshot still gives the stored hash – nothing was changed after creation. */
  intact: boolean;
  signatures: { offerer: Signature; requester: Signature };
  signedAt: string | null;
  voided: { at: string; by: "you" | "other"; reason: string | null } | null;
  createdAt: string;
  simulated: boolean;
  exchange: { id: number; ref: string; status: ExchangeStatus } | null;
  payment: { status: PaymentStatus | null; amount: PaymentAmount | null };
  events: { revision: number; action: string; by: "you" | "other"; createdAt: string }[];
  actions: ContractAction[];
};

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id != null))];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: auth_users.id, name: auth_users.name }).from(auth_users).where(inArray(auth_users.id, wanted));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Delivery and payment state of the negotiation behind a contract. */
async function executionOf(row: ContractRow, terms: TermsView, catalogue: Catalogue) {
  const [exchange] = await db
    .select({ id: exchanges.id, status: exchanges.status, qualityResult: exchanges.qualityResult, receivedQuantity: exchanges.receivedQuantity })
    .from(exchanges)
    .where(eq(exchanges.negotiationId, row.negotiationId));
  const [payment] = exchange
    ? await db.select({ status: payments.status }).from(payments).where(and(eq(payments.exchangeId, exchange.id), eq(payments.contractId, row.id))).orderBy(desc(payments.id)).limit(1)
    : [];
  const amount = termsAmount(terms, catalogue);
  const status = (payment?.status ?? null) as PaymentStatus | null;
  const execution = contractExecution({
    status: row.status as ContractStatus,
    exchange: exchange ? { status: exchange.status as ExchangeStatus, qualityResult: exchange.qualityResult as QualityResult | null, receivedQuantity: exchange.receivedQuantity } : null,
    // an amount that cannot be computed is still due – the contract is not fulfilled by an unknown price
    payment: { due: amount?.amountCents !== 0, status },
  });
  return { execution, exchange: exchange ? { id: exchange.id, ref: exchangeRef(exchange.id), status: exchange.status as ExchangeStatus } : null, payment: { status, amount } };
}

/** One contract with its snapshot, signatures, execution and history. Anyone else gets "not found". */
export async function getContract(viewer: Viewer, contractId: number): Promise<ContractDetail> {
  const { site } = requireSite(viewer);
  const [row] = await db.select().from(contracts).where(and(eq(contracts.id, contractId), partyOf(site.id)));
  if (!row) throw new AccessError("NOT_FOUND");
  const snapshot = row.snapshot as ContractSnapshot;
  const role: Party = row.offererSiteId === site.id ? "offerer" : "requester";
  const [catalogue, events, names, sites] = await Promise.all([
    getCatalogue(),
    db.select().from(contractEvents).where(eq(contractEvents.contractId, row.id)).orderBy(asc(contractEvents.revision)),
    userNames([row.offererSignedByUserId, row.requesterSignedByUserId]),
    siteNamesOf([role === "offerer" ? row.requesterSiteId : row.offererSiteId]),
  ]);
  const { execution, exchange, payment } = await executionOf(row, snapshot.terms, catalogue);
  const signature = (at: Date | null, userId: string | null, side: Party): Signature =>
    at && userId ? { at: at.toISOString(), by: names.get(userId) ?? "–", you: side === role } : null;
  const intact = snapshotHash(row.snapshot) === row.snapshotHash;
  const ownSigned = (role === "offerer" ? row.offererSignedAt : row.requesterSignedAt) != null;
  const status = row.status as ContractStatus;
  return {
    id: row.id,
    ref: contractRef(row.id),
    status,
    execution,
    revision: row.revision,
    role,
    otherSite: sites.get(role === "offerer" ? row.requesterSiteId : row.offererSiteId)!,
    snapshot,
    hash: row.snapshotHash,
    intact,
    signatures: { offerer: signature(row.offererSignedAt, row.offererSignedByUserId, "offerer"), requester: signature(row.requesterSignedAt, row.requesterSignedByUserId, "requester") },
    signedAt: row.signedAt?.toISOString() ?? null,
    voided: row.voidedAt ? { at: row.voidedAt.toISOString(), by: row.voidedBySiteId === site.id ? "you" : "other", reason: row.voidReason } : null,
    createdAt: row.createdAt.toISOString(),
    simulated: row.simulated,
    exchange,
    payment,
    events: events.map((event) => ({ revision: event.revision, action: event.action, by: event.siteId === site.id ? ("you" as const) : ("other" as const), createdAt: event.createdAt.toISOString() })),
    // a snapshot that no longer matches its hash can neither be signed nor voided – it is shown as damaged
    actions: site.status === "verified" && intact ? contractActions(status, ownSigned) : [],
  };
}

/** The live contract of a negotiation for the negotiation and exchange pages (or null). */
export async function contractSummaryFor(viewer: Viewer, negotiationId: number): Promise<ContractSummary | null> {
  const { site } = requireSite(viewer);
  const [row] = await db.select().from(contracts).where(and(eq(contracts.negotiationId, negotiationId), ne(contracts.status, "voided"), partyOf(site.id)));
  if (!row) return null;
  const { execution } = await executionOf(row, (row.snapshot as ContractSnapshot).terms, await getCatalogue());
  return { id: row.id, ref: contractRef(row.id), status: row.status as ContractStatus, execution };
}

// ── Signing and voiding ─────────────────────────────────────────────────────────────────────────────────

async function lockOwn(tx: Tx, siteId: number, contractId: number, expectedRevision: number): Promise<ContractRow> {
  const [row] = await tx.select().from(contracts).where(and(eq(contracts.id, contractId), partyOf(siteId))).for("update");
  if (!row) throw new AccessError("NOT_FOUND");
  if (row.status !== "awaiting_signatures") throw new AccessError("CONFLICT", { reason: "CONTRACT_CLOSED" });
  requireCurrentRevision(row.revision, expectedRevision);
  if (row.revision >= MAX_CHANGES) throw new AccessError("RATE_LIMITED");
  return row;
}

/**
 * A site signs: the hash the page showed must be the stored one (the site signs exactly what it saw) and the stored
 * snapshot must still give that hash. Once both signed, the contract is signed – final.
 */
export async function signContract(viewer: Viewer, contractId: number, input: ContractSign): Promise<{ id: number; status: ContractStatus; revision: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    const row = await lockOwn(tx, site.id, contractId, input.expectedRevision);
    if (input.snapshotHash !== row.snapshotHash) throw new AccessError("CONFLICT", { reason: "SNAPSHOT_CHANGED" });
    if (snapshotHash(row.snapshot) !== row.snapshotHash) throw new AccessError("CONFLICT", { reason: "SNAPSHOT_DAMAGED" });
    const side: Party = row.offererSiteId === site.id ? "offerer" : "requester";
    const now = new Date();
    if ((side === "offerer" ? row.offererSignedAt : row.requesterSignedAt) != null) throw new AccessError("CONFLICT", { reason: "ALREADY_SIGNED" });
    const otherSigned = (side === "offerer" ? row.requesterSignedAt : row.offererSignedAt) != null;
    const status: ContractStatus = otherSigned ? "signed" : "awaiting_signatures";
    const [updated] = await tx
      .update(contracts)
      .set({
        ...(side === "offerer" ? { offererSignedAt: now, offererSignedByUserId: userId } : { requesterSignedAt: now, requesterSignedByUserId: userId }),
        status,
        signedAt: otherSigned ? now : null,
        revision: row.revision + 1,
        updatedAt: now,
      })
      .where(and(eq(contracts.id, row.id), eq(contracts.revision, row.revision)))
      .returning({ id: contracts.id, revision: contracts.revision });
    if (!updated) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: row.revision });
    await tx.insert(contractEvents).values({ contractId: row.id, revision: updated.revision, siteId: site.id, actorUserId: userId, action: "signed", status });
    return { id: row.id, status, revision: updated.revision };
  });
}

/** Either site voids the contract while a signature is missing; a new one can then be created. */
export async function voidContract(viewer: Viewer, contractId: number, input: ContractVoid): Promise<{ id: number; status: "voided" }> {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx) => {
    const row = await lockOwn(tx, site.id, contractId, input.expectedRevision);
    const now = new Date();
    const [updated] = await tx
      .update(contracts)
      .set({ status: "voided", voidedAt: now, voidedBySiteId: site.id, voidReason: input.reason, revision: row.revision + 1, updatedAt: now })
      .where(and(eq(contracts.id, row.id), eq(contracts.revision, row.revision)))
      .returning({ revision: contracts.revision });
    if (!updated) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: row.revision });
    await tx.insert(contractEvents).values({ contractId: row.id, revision: updated.revision, siteId: site.id, actorUserId: userId, action: "voided", status: "voided" });
    return { id: row.id, status: "voided" as const };
  });
}

/** For the payment module: the signed contract of a negotiation, locked against a concurrent change. */
export async function lockSignedContract(tx: Tx, negotiationId: number): Promise<ContractRow> {
  const [row] = await tx.select().from(contracts).where(and(eq(contracts.negotiationId, negotiationId), eq(contracts.status, "signed"))).for("share");
  if (!row) throw new AccessError("CONFLICT", { reason: "CONTRACT_NOT_SIGNED" });
  return row;
}
