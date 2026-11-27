// Contracts of agreed negotiations (Level 2, contract execution): value lists, who may do what, the immutable
// snapshot and how the execution state follows from delivery and payment. Pure → tested on its own
// (contract.test.ts) and used by the pages.
import type { ExchangeStatus, QualityResult } from "./negotiation";
import type { PaymentStatus } from "./payment";

/**
 * Stored status of a contract (column contracts.status): created from the accepted revision and waiting for both
 * sites to sign, signed by both (final – the terms are bound), or voided by one site before both had signed.
 */
export const CONTRACT_STATUSES = ["awaiting_signatures", "signed", "voided"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type ContractAction = "sign" | "void";

/** Either site signs once; either site may void the contract while a signature is still missing. */
export function contractActions(status: ContractStatus, viewerHasSigned: boolean): ContractAction[] {
  if (status !== "awaiting_signatures") return [];
  return viewerHasSigned ? ["void"] : ["sign", "void"];
}

export function contractRef(id: number): string {
  return `CT-${String(id).padStart(6, "0")}`;
}

/**
 * JSON with sorted keys and no spaces: the same snapshot always gives the same text, so its SHA-256 hash identifies
 * exactly what was signed. Arrays keep their order; undefined values are left out like JSON.stringify does.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

/** What the contract obliges and how far each obligation is. */
export type ObligationState = "open" | "met" | "failed" | "not_due" | "reversed";
export type ExecutionState = "awaiting_signatures" | "voided" | "in_execution" | "fulfilled" | "terminated";

export type ExecutionInput = {
  status: ContractStatus;
  exchange: { status: ExchangeStatus; qualityResult: QualityResult | null; receivedQuantity: number | null } | null;
  /** due = the accepted terms call for a payment between the sites (net amount above 0). */
  payment: { due: boolean; status: PaymentStatus | null };
};

export type Execution = { state: ExecutionState; delivery: ObligationState; payment: ObligationState };

/**
 * Derived on every read, like an expired offer – no job flips a status. A signed contract is fulfilled when the
 * material arrived and was not rejected and the payment (if one is due) was captured; it is terminated when the
 * payment was refunded, or when the delivery failed (cancelled or rejected) and no captured money is left with the
 * payee.
 */
export function contractExecution(input: ExecutionInput): Execution {
  const { exchange, payment } = input;
  let delivery: ObligationState = "open";
  if (exchange?.status === "cancelled") delivery = "failed";
  else if (exchange?.status === "completed") delivery = exchange.qualityResult !== "rejected" && (exchange.receivedQuantity ?? 0) > 0 ? "met" : "failed";

  let paid: ObligationState = "open";
  if (!payment.due) paid = "not_due";
  else if (payment.status === "captured") paid = "met";
  else if (payment.status === "refunded") paid = "reversed";

  if (input.status !== "signed") return { state: input.status, delivery, payment: paid };
  const paymentSettled = paid === "met" || paid === "not_due";
  if (delivery === "met" && paymentSettled) return { state: "fulfilled", delivery, payment: paid };
  // money returned ends the deal as well; a failed delivery ends it once nothing captured is left with the payee
  if (paid === "reversed" || (delivery === "failed" && payment.status !== "captured")) return { state: "terminated", delivery, payment: paid };
  return { state: "in_execution", delivery, payment: paid };
}
