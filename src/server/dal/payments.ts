// Data Access Layer: payments of exchanges (Level 2, simulated payment). The amount follows from the terms of the
// signed contract, never from the browser. Every step is idempotent through a key the browser sends once per form,
// every change is written to the audit trail, and the provider's confirmation is accepted only with a valid
// signature – also from the SimulatedProvider. Only the two sites see a payment; to anyone else it does not exist.
//
// Provider calls happen inside the transaction that holds the payment row: with the simulated provider they return
// at once. A real adapter keeps the same order – the provider's own idempotency key makes a retried call harmless.
import "server-only";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { AccessError, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { BadRequest } from "../http";
import { db } from "../db/client";
import { exchanges, paymentEvents, payments } from "../db/schema";
import { contractRef } from "../domain/contract";
import { exchangeRef, type ExchangeStatus } from "../domain/negotiation";
import { PAYMENT_CURRENCY, paymentActions, paymentRef, type PaymentAction, type PaymentAmount, type PaymentStatus, type Party } from "../domain/payment";
import { canTransition, paymentFlow } from "../domain/status";
import { paymentProvider } from "../payments/simulated";
import { verifySignature } from "../payments/signature";
import { providerEvent, type PaymentRefund } from "../validation/contracts";
import { getCatalogue } from "./catalogue";
import { liveContractOf, lockSignedContract, termsAmount, type ContractSnapshot } from "./contracts";

/** Payments per exchange (failed and cancelled ones included) and history entries shown. */
const MAX_PAYMENTS_PER_EXCHANGE = 20;
const MAX_EVENTS = 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRow = typeof payments.$inferSelect;
type ExchangeRow = Pick<typeof exchanges.$inferSelect, "id" | "negotiationId" | "status" | "offererSiteId" | "requesterSiteId" | "qualityResult" | "receivedQuantity">;

const exchangeParty = (siteId: number) => or(eq(exchanges.offererSiteId, siteId), eq(exchanges.requesterSiteId, siteId));
const paymentParty = (siteId: number) => or(eq(payments.payerSiteId, siteId), eq(payments.payeeSiteId, siteId));

/** The material arrived and was not rejected – the condition for taking the money. */
function delivered(exchange: Pick<ExchangeRow, "status" | "qualityResult" | "receivedQuantity">): boolean {
  return exchange.status === "completed" && exchange.qualityResult !== "rejected" && (exchange.receivedQuantity ?? 0) > 0;
}

const siteOf = (exchange: Pick<ExchangeRow, "offererSiteId" | "requesterSiteId">, party: Party) => (party === "offerer" ? exchange.offererSiteId : exchange.requesterSiteId);

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

export type PaymentEventView = { action: string; toStatus: string; source: "you" | "other" | "provider"; createdAt: string };

export type PaymentDetail = {
  id: number;
  ref: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  vatBasis: string;
  lines: { kind: string; from: string; to: string; cents: number }[];
  provider: string;
  providerRef: string;
  simulated: true;
  createdAt: string;
  authorisedAt: string | null;
  capturedAt: string | null;
  refundedAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  refundReason: string | null;
  events: PaymentEventView[];
  actions: PaymentAction[];
};

export type ExchangePayment = {
  exchange: { id: number; ref: string; status: ExchangeStatus; delivered: boolean };
  contract: { id: number; ref: string; status: string } | null;
  /** What the signed terms call for; null without a contract or when it cannot be computed. */
  due: PaymentAmount | null;
  viewerRole: "payer" | "payee" | null;
  /** Why no payment can be started now (null = the payer can start one). */
  blocked: "CONTRACT_NOT_SIGNED" | "EXCHANGE_CANCELLED" | "NOTHING_DUE" | "AMOUNT_UNKNOWN" | "PAYMENT_EXISTS" | "NOT_PAYER" | "NOT_VERIFIED" | null;
  current: PaymentDetail | null;
  /** Earlier attempts that failed or were cancelled. */
  earlier: { id: number; ref: string; status: PaymentStatus; createdAt: string }[];
};

async function detail(row: PaymentRow, siteId: number, exchange: ExchangeRow, verified: boolean): Promise<PaymentDetail> {
  const events = await db.select().from(paymentEvents).where(eq(paymentEvents.paymentId, row.id)).orderBy(desc(paymentEvents.id)).limit(MAX_EVENTS);
  const role = row.payerSiteId === siteId ? "payer" : "payee";
  return {
    id: row.id,
    ref: paymentRef(row.id),
    status: row.status as PaymentStatus,
    amountCents: row.amountCents,
    currency: row.currency,
    vatBasis: row.vatBasis,
    lines: row.lines,
    provider: row.provider,
    providerRef: row.providerRef,
    simulated: true,
    createdAt: row.createdAt.toISOString(),
    authorisedAt: row.authorisedAt?.toISOString() ?? null,
    capturedAt: row.capturedAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    refundReason: row.refundReason,
    events: events.map((event) => ({
      action: event.action,
      toStatus: event.toStatus,
      source: event.source === "provider" ? ("provider" as const) : event.siteId === siteId ? ("you" as const) : ("other" as const),
      createdAt: event.createdAt.toISOString(),
    })),
    actions: verified ? paymentActions(row.status as PaymentStatus, role, delivered(exchange), exchange.requesterSiteId === siteId) : [],
  };
}

/** The payment section of an exchange: what is due under the signed contract and the payment so far. */
export async function getExchangePayment(viewer: Viewer, exchangeId: number): Promise<ExchangePayment> {
  const { site } = requireSite(viewer);
  const [exchange] = await db
    .select({ id: exchanges.id, negotiationId: exchanges.negotiationId, status: exchanges.status, offererSiteId: exchanges.offererSiteId, requesterSiteId: exchanges.requesterSiteId, qualityResult: exchanges.qualityResult, receivedQuantity: exchanges.receivedQuantity })
    .from(exchanges)
    .where(and(eq(exchanges.id, exchangeId), exchangeParty(site.id)));
  if (!exchange) throw new AccessError("NOT_FOUND");
  const [contract, rows, catalogue] = await Promise.all([
    liveContractOf(db, exchange.negotiationId),
    db.select().from(payments).where(eq(payments.exchangeId, exchange.id)).orderBy(desc(payments.id)).limit(MAX_PAYMENTS_PER_EXCHANGE),
    getCatalogue(),
  ]);
  const due = contract?.status === "signed" ? termsAmount((contract.snapshot as ContractSnapshot).terms, catalogue) : null;
  const verified = site.status === "verified";
  const live = rows.find((row) => !["failed", "cancelled"].includes(row.status)) ?? null;
  const current = live ?? rows[0] ?? null;
  const ownParty: Party = exchange.offererSiteId === site.id ? "offerer" : "requester";
  const viewerRole = current ? (current.payerSiteId === site.id ? "payer" : "payee") : due?.payer ? (due.payer === ownParty ? "payer" : "payee") : null;

  let blocked: ExchangePayment["blocked"] = null;
  if (!verified) blocked = "NOT_VERIFIED";
  else if (contract?.status !== "signed") blocked = "CONTRACT_NOT_SIGNED";
  else if (exchange.status === "cancelled") blocked = "EXCHANGE_CANCELLED";
  else if (!due || due.amountCents == null) blocked = "AMOUNT_UNKNOWN";
  else if (due.amountCents === 0) blocked = "NOTHING_DUE";
  else if (live) blocked = "PAYMENT_EXISTS";
  else if (due.payer !== ownParty) blocked = "NOT_PAYER";

  const exchangeView = { id: exchange.id, ref: exchangeRef(exchange.id), status: exchange.status as ExchangeStatus, delivered: delivered(exchange as ExchangeRow) };
  return {
    exchange: exchangeView,
    contract: contract ? { id: contract.id, ref: contractRef(contract.id), status: contract.status } : null,
    due,
    viewerRole,
    blocked,
    current: current ? await detail(current, site.id, exchange as ExchangeRow, verified) : null,
    earlier: rows.filter((row) => row !== current).map((row) => ({ id: row.id, ref: paymentRef(row.id), status: row.status as PaymentStatus, createdAt: row.createdAt.toISOString() })),
  };
}

// ── Creating ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The payer starts the payment of an exchange. The amount comes from the terms of the signed contract. The same
 * idempotency key again returns the payment created with it (a double click or a retried request is one payment);
 * the key used for another exchange is refused.
 */
export async function createPayment(viewer: Viewer, exchangeId: number, idempotencyKey: string): Promise<{ id: number; ref: string; status: PaymentStatus; replayed: boolean }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const catalogue = await getCatalogue();
  return db.transaction(async (tx) => {
    const [exchange] = await tx.select().from(exchanges).where(and(eq(exchanges.id, exchangeId), exchangeParty(site.id))).for("update");
    if (!exchange) throw new AccessError("NOT_FOUND");
    const [earlier] = await tx.select().from(payments).where(and(eq(payments.payerSiteId, site.id), eq(payments.idempotencyKey, idempotencyKey)));
    if (earlier) {
      if (earlier.exchangeId !== exchange.id) throw new AccessError("CONFLICT", { reason: "IDEMPOTENCY_KEY_REUSED" });
      return { id: earlier.id, ref: paymentRef(earlier.id), status: earlier.status as PaymentStatus, replayed: true };
    }
    if (exchange.status === "cancelled") throw new AccessError("CONFLICT", { reason: "EXCHANGE_CANCELLED" });
    const contract = await lockSignedContract(tx, exchange.negotiationId);
    const amount = termsAmount((contract.snapshot as ContractSnapshot).terms, catalogue);
    if (!amount || amount.amountCents == null) throw new AccessError("CONFLICT", { reason: "AMOUNT_UNKNOWN" });
    if (amount.amountCents === 0 || !amount.payer || !amount.payee) throw new AccessError("CONFLICT", { reason: "NOTHING_DUE" });
    if (siteOf(exchange, amount.payer) !== site.id) throw new AccessError("FORBIDDEN", { reason: "NOT_PAYER" });
    const [live] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.exchangeId, exchange.id), inArray(payments.status, ["pending", "authorised", "captured", "refunded"])));
    if (live) throw new AccessError("CONFLICT", { reason: "PAYMENT_EXISTS" });
    const [{ n }] = await tx.select({ n: count() }).from(payments).where(eq(payments.exchangeId, exchange.id));
    if (n >= MAX_PAYMENTS_PER_EXCHANGE) throw new AccessError("RATE_LIMITED");

    const provider = paymentProvider();
    const { providerRef } = await provider.create({ amountCents: amount.amountCents, currency: PAYMENT_CURRENCY, reference: exchangeRef(exchange.id), idempotencyKey });
    const [row] = await tx
      .insert(payments)
      .values({
        exchangeId: exchange.id,
        contractId: contract.id,
        payerSiteId: site.id,
        payeeSiteId: siteOf(exchange, amount.payee),
        amountCents: amount.amountCents,
        currency: PAYMENT_CURRENCY,
        vatBasis: amount.vatBasis,
        lines: amount.lines,
        provider: provider.name,
        providerRef,
        idempotencyKey,
        simulated: true,
        createdByUserId: userId,
      })
      .returning();
    await tx.insert(paymentEvents).values({ paymentId: row.id, action: "created", fromStatus: null, toStatus: "pending", source: "site", siteId: site.id, actorUserId: userId, detail: { amountCents: row.amountCents } });
    return { id: row.id, ref: paymentRef(row.id), status: "pending" as const, replayed: false };
  });
}

// ── Provider confirmation ───────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/webhook (and the simulated checkout): checks the signature over the raw body, then applies the
 * event once – its id is stored with the audit entry, so a replay changes nothing. A confirmation for another
 * amount is refused; one that comes after the payment moved on (e.g. cancelled) is recorded as ignored.
 */
export async function handleProviderEvent(rawBody: string, signature: string | null): Promise<{ received: true; duplicate: boolean; status: PaymentStatus }> {
  const provider = paymentProvider();
  if (verifySignature(provider.webhookSecret(), rawBody, signature) !== null) throw new AccessError("INVALID_SIGNATURE");
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new BadRequest();
  }
  const parsed = providerEvent.safeParse(json);
  if (!parsed.success) throw new BadRequest();
  const event = parsed.data;
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(and(eq(payments.provider, provider.name), eq(payments.providerRef, event.providerRef))).for("update");
    if (!payment) throw new AccessError("NOT_FOUND");
    const [seen] = await tx.select({ id: paymentEvents.id }).from(paymentEvents).where(eq(paymentEvents.providerEventId, event.id));
    if (seen) return { received: true as const, duplicate: true, status: payment.status as PaymentStatus };
    if (event.amountCents !== payment.amountCents || event.currency !== payment.currency) throw new AccessError("CONFLICT", { reason: "AMOUNT_MISMATCH" });
    const from = payment.status as PaymentStatus;
    const to: PaymentStatus = event.type === "payment.authorised" ? "authorised" : "failed";
    const now = new Date();
    if (!canTransition(paymentFlow, from, to)) {
      await tx.insert(paymentEvents).values({ paymentId: payment.id, action: "ignored", fromStatus: from, toStatus: from, source: "provider", providerEventId: event.id, detail: { type: event.type } });
      return { received: true as const, duplicate: false, status: from };
    }
    const change = to === "authorised" ? { authorisedAt: now } : { endedAt: now, failureReason: "PROVIDER_DECLINED" };
    await tx
      .update(payments)
      .set({ ...change, status: to, revision: payment.revision + 1, updatedAt: now })
      .where(eq(payments.id, payment.id));
    await tx.insert(paymentEvents).values({ paymentId: payment.id, action: to, fromStatus: from, toStatus: to, source: "provider", providerEventId: event.id, detail: { type: event.type } });
    return { received: true as const, duplicate: false, status: to };
  });
}

/**
 * The payer's simulated checkout: the SimulatedProvider produces the confirmation it would send after the payer's
 * decision, and it goes through the same signature check and handler as one from outside.
 */
export async function simulateCheckout(viewer: Viewer, paymentId: number, outcome: "authorise" | "fail") {
  const { site } = requireVerifiedSite(viewer);
  const [payment] = await db.select().from(payments).where(and(eq(payments.id, paymentId), paymentParty(site.id)));
  if (!payment) throw new AccessError("NOT_FOUND");
  if (payment.payerSiteId !== site.id) throw new AccessError("FORBIDDEN", { reason: "NOT_PAYER" });
  if (payment.status !== "pending") throw new AccessError("CONFLICT", { reason: "PAYMENT_STATE" });
  const { body, signature } = paymentProvider().checkoutDecision(payment, outcome === "authorise" ? "payment.authorised" : "payment.failed");
  return handleProviderEvent(body, signature);
}

// ── Capture, cancel, refund ─────────────────────────────────────────────────────────────────────────────

type Step = {
  action: "capture" | "cancel" | "refund";
  to: PaymentStatus;
  keyColumn: "captureKey" | "cancelKey" | "refundKey";
  call: (providerRef: string, payment: PaymentRow) => Promise<{ ok: true } | { ok: false; reason: string }>;
  set: (now: Date) => Partial<PaymentRow>;
};

/**
 * One step on a payment: the row locked, the viewer a party with the right role, the step allowed now (capture
 * only after delivery). The same key after the step was done returns the result again instead of a second call.
 */
async function step(viewer: Viewer, paymentId: number, idempotencyKey: string, spec: Step) {
  const { site, userId } = requireVerifiedSite(viewer);
  return db.transaction(async (tx: Tx) => {
    const [payment] = await tx.select().from(payments).where(and(eq(payments.id, paymentId), paymentParty(site.id))).for("update");
    if (!payment) throw new AccessError("NOT_FOUND");
    const status = payment.status as PaymentStatus;
    if (payment[spec.keyColumn] === idempotencyKey) return { id: payment.id, status, replayed: true };
    // share lock: a receipt being recorded at this moment is waited for, not read half-way (security review)
    const [exchange] = await tx.select().from(exchanges).where(eq(exchanges.id, payment.exchangeId)).for("share");
    if (!exchange) throw new AccessError("NOT_FOUND");
    const role = payment.payerSiteId === site.id ? "payer" : "payee";
    const recordedReceipt = exchange.requesterSiteId === site.id;
    const isDelivered = delivered(exchange);
    if (paymentActions(status, role, isDelivered, recordedReceipt).includes(spec.action)) {
      // allowed
    } else if (paymentActions(status, role === "payer" ? "payee" : "payer", isDelivered, !recordedReceipt).includes(spec.action)) {
      throw new AccessError("FORBIDDEN", { reason: role === "payer" ? "NOT_PAYEE" : "NOT_PAYER" });
    } else if (spec.action === "capture" && status === "authorised" && !isDelivered) {
      throw new AccessError("CONFLICT", { reason: "NOT_DELIVERED" });
    } else if (spec.action === "cancel" && status === "authorised" && isDelivered) {
      throw new AccessError("CONFLICT", { reason: "ALREADY_DELIVERED" });
    } else {
      throw new AccessError("CONFLICT", { reason: "PAYMENT_STATE" });
    }
    const result = await spec.call(payment.providerRef, payment);
    if (!result.ok) throw new AccessError("CONFLICT", { reason: "PROVIDER_REFUSED" });
    const now = new Date();
    await tx
      .update(payments)
      .set({ ...spec.set(now), status: spec.to, [spec.keyColumn]: idempotencyKey, revision: payment.revision + 1, updatedAt: now })
      .where(eq(payments.id, payment.id));
    await tx.insert(paymentEvents).values({ paymentId: payment.id, action: spec.to, fromStatus: status, toStatus: spec.to, source: "site", siteId: site.id, actorUserId: userId });
    return { id: payment.id, status: spec.to, replayed: false };
  });
}

/** Takes an authorised payment once the material arrived and was not rejected – not by a payee that recorded the receipt itself. */
export function capturePayment(viewer: Viewer, paymentId: number, idempotencyKey: string) {
  return step(viewer, paymentId, idempotencyKey, {
    action: "capture",
    to: "captured",
    keyColumn: "captureKey",
    call: (ref) => paymentProvider().capture(ref, idempotencyKey),
    set: (now) => ({ capturedAt: now }),
  });
}

/** The payer releases a pending payment, or an authorised one while no receipt is recorded. */
export function cancelPayment(viewer: Viewer, paymentId: number, idempotencyKey: string) {
  return step(viewer, paymentId, idempotencyKey, {
    action: "cancel",
    to: "cancelled",
    keyColumn: "cancelKey",
    call: (ref) => paymentProvider().cancel(ref, idempotencyKey),
    set: (now) => ({ endedAt: now }),
  });
}

/** The payee pays captured money back, with a reason. */
export function refundPayment(viewer: Viewer, paymentId: number, input: PaymentRefund) {
  return step(viewer, paymentId, input.idempotencyKey, {
    action: "refund",
    to: "refunded",
    keyColumn: "refundKey",
    call: (ref, payment) => paymentProvider().refund(ref, payment.amountCents, input.idempotencyKey),
    set: (now) => ({ refundedAt: now, refundReason: input.reason }),
  });
}
