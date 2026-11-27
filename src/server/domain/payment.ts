// Payments of an exchange (Level 2, simulated payment): value lists, the amount that follows from the accepted
// terms, and who may do what. Pure → tested on its own (payment.test.ts) and used by the pages.
//
// The prototype moves no money: every payment runs through the SimulatedProvider (src/server/payments/). The data
// model, the states, the idempotency keys and the signed provider confirmation are those of a real integration, so
// a real provider can replace the adapter later.
import type { VatBasis } from "./listing";
import type { PaymentDirection, Terms } from "./negotiation";
import { convertQuantity, type Unit } from "./units";

/**
 * pending = created, the payer has not authorised it at the provider yet; authorised = the money is reserved;
 * captured = the money was taken (after delivery); failed = the provider refused it; cancelled = released before
 * capture; refunded = captured money paid back to the payer.
 */
export const PAYMENT_STATUSES = ["pending", "authorised", "captured", "failed", "cancelled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A payment in one of these blocks a second one for the same exchange; failed and cancelled ones do not. */
export const LIVE_PAYMENT_STATUSES = ["pending", "authorised", "captured", "refunded"] as const satisfies readonly PaymentStatus[];

export const PAYMENT_CURRENCY = "EUR";
export const PAYMENT_PROVIDERS = ["simulated"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export type Party = "offerer" | "requester";

export type PaymentLine = { kind: "material" | "freight"; from: Party; to: Party; cents: number };

export type PaymentAmount = {
  /** What each site owes the other under the accepted terms; netted into one payment. */
  lines: PaymentLine[];
  payer: Party | null;
  payee: Party | null;
  /** Net amount in cents; 0 = nothing to pay; null = not computable (see missing). */
  amountCents: number | null;
  vatBasis: VatBasis;
  /** The freight is paid to the carrier directly (third-party organiser) and is not part of the payment. */
  freightOutside: boolean;
  missing: string[];
};

export type PaymentTerms = Pick<
  Terms,
  "quantity" | "paymentDirection" | "priceAmount" | "vatBasis" | "transportOrganiser" | "freightAmount" | "freightPayer" | "offererSharePercent"
>;

const other = (party: Party): Party => (party === "offerer" ? "requester" : "offerer");

function materialLine(terms: PaymentTerms, unit: Unit, priceUnit: Unit | null, missing: string[]): PaymentLine | null {
  if (terms.paymentDirection === "no_payment") return null;
  if (terms.priceAmount == null || priceUnit == null) {
    missing.push("price");
    return null;
  }
  // a price per item cannot be applied to a quantity in kg (D17) – no amount rather than a wrong one
  const inPriceUnits = convertQuantity(terms.quantity, unit, priceUnit);
  if (inPriceUnits == null) {
    missing.push("priceBasis");
    return null;
  }
  const from: Party = (terms.paymentDirection as PaymentDirection) === "offerer_pays" ? "offerer" : "requester";
  return { kind: "material", from, to: other(from), cents: Math.round(inPriceUnits * terms.priceAmount * 100) };
}

/**
 * The organiser books and pays the carrier; the other site owes the organiser its agreed share of the freight. With
 * a third-party organiser each site settles with the carrier itself, so nothing passes between the sites.
 */
function freightLine(terms: PaymentTerms): PaymentLine | null {
  if (terms.freightAmount == null || terms.freightAmount <= 0 || terms.freightPayer == null) return null;
  if (terms.transportOrganiser === "third_party") return null;
  const organiser = terms.transportOrganiser as Party;
  const debtor = other(organiser);
  const offererShare = terms.freightPayer === "offerer" ? 100 : terms.freightPayer === "requester" ? 0 : (terms.offererSharePercent ?? 0);
  const debtorShare = debtor === "offerer" ? offererShare : 100 - offererShare;
  const cents = Math.round(terms.freightAmount * debtorShare);
  return cents > 0 ? { kind: "freight", from: debtor, to: organiser, cents } : null;
}

/**
 * Amount of the payment of an exchange: the material price for the agreed quantity plus the freight share one site
 * owes the other, netted into one transfer. The VAT basis is carried as agreed – the prototype determines no tax
 * (a reverse-charge case is possible for plastic waste), so the amount is the agreed amount on that basis.
 */
export function paymentAmount(terms: PaymentTerms, unit: Unit, priceUnit: Unit | null): PaymentAmount {
  const missing: string[] = [];
  const lines = [materialLine(terms, unit, priceUnit, missing), freightLine(terms)].filter((line): line is PaymentLine => line != null);
  const freightOutside = terms.transportOrganiser === "third_party" && (terms.freightAmount ?? 0) > 0;
  if (missing.length > 0) return { lines, payer: null, payee: null, amountCents: null, vatBasis: terms.vatBasis, freightOutside, missing };
  const toOfferer = lines.reduce((sum, line) => sum + (line.to === "offerer" ? line.cents : -line.cents), 0);
  const payer: Party | null = toOfferer > 0 ? "requester" : toOfferer < 0 ? "offerer" : null;
  return { lines, payer, payee: payer && other(payer), amountCents: Math.abs(toOfferer), vatBasis: terms.vatBasis, freightOutside, missing };
}

export type PaymentAction = "authorise" | "fail" | "cancel" | "capture" | "refund";

/**
 * Who may do what. The payer authorises at the provider (in the prototype: the simulated checkout, which can also
 * be told to refuse) or cancels – but only until the receipt is recorded. An authorised payment is captured once
 * the material has arrived and was not rejected, by either site – except that the site which recorded the receipt
 * cannot also take the money as payee (security review 2026-11-27, CWE-841: nobody confirms their own claim). Only
 * the payee pays captured money back.
 */
export function paymentActions(status: PaymentStatus, role: "payer" | "payee", delivered: boolean, viewerRecordedReceipt = false): PaymentAction[] {
  if (status === "pending") return role === "payer" ? ["authorise", "fail", "cancel"] : [];
  if (status === "authorised") {
    if (!delivered) return role === "payer" ? ["cancel"] : [];
    return role === "payee" && viewerRecordedReceipt ? [] : ["capture"];
  }
  if (status === "captured") return role === "payee" ? ["refund"] : [];
  return [];
}

export function paymentRef(id: number): string {
  return `PM-${String(id).padStart(6, "0")}`;
}

/** An idempotency key as the client sends it: 16–100 characters of letters, digits, "-" and "_". */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/;
