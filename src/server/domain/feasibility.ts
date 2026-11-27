// Economic feasibility (L2-007, D17): delivered cost for the requester and net proceeds for the offerer on one
// quantity and price basis, freight split between them, then the viewer's own private costs and baseline,
// contribution and break-even. Pure → tested on its own (feasibility.test.ts) and used by the page.
//
// Conventions:
// - All money is EUR for the scenario quantity. Variable costs and the baseline rate are per unit of the scenario
//   quantity (the requester's baseline per usable unit after the processing yield).
// - Freight is one amount per shipment (fixed), shared by percent. A price that already includes delivery takes no
//   extra freight – adding it again would count it twice (NT-L2-007).
// - Unknown stays unknown: a missing price, freight amount, cost or baseline gives no total, never 0.
// - Break-even only for a positive contribution (AT-L2-007): the quantity at which the fixed costs are covered.
import type { CostStatus, FreightPayer, PaymentDirection, TermProblem } from "./negotiation";
import { convertQuantity, type Unit } from "./units";

export const COST_BASES = ["fixed", "variable"] as const;
export type CostBasis = (typeof COST_BASES)[number];
export type Party = "offerer" | "requester";

/** One of the viewer's own costs: preparation, testing, processing, handling … */
export type CostLine = { label: string; basis: CostBasis; amount: number | null; status: CostStatus };

export type Freight = { amount: number | null; status: CostStatus; payer: FreightPayer; offererSharePercent: number | null };

/** What both sites look at: from the listings (match) or from a proposal (negotiation). */
export type SharedInputs = {
  quantity: number;
  unit: Unit;
  paymentDirection: PaymentDirection;
  /** Per price unit; null = not known yet (on enquiry). */
  priceAmount: number | null;
  priceUnit: Unit | null;
  priceStatus: CostStatus;
  /** The price is a delivered price: freight is part of it. */
  priceIncludesFreight: boolean;
  /** Extra freight on top of the price; null = none. */
  freight: Freight | null;
};

/** The viewer's own inputs – visible to the viewer's site only. */
export type PrivateInputs = {
  /** Requester only: usable share after preparation, in percent (null = not known). */
  yieldPercent: number | null;
  costs: CostLine[];
  /**
   * Existing route, per unit. Requester: what the material it replaces costs today (per usable unit).
   * Offerer: what the current route costs today (disposal fee; negative when it earns money).
   */
  baseline: { rate: number | null; status: CostStatus } | null;
};

export type BreakEven = { kind: "quantity"; quantity: number } | { kind: "none" } | { kind: "unknown" };

export type OwnResult = {
  party: Party;
  /** Net proceeds (offerer) or delivered cost (requester) before the own costs. */
  beforeCosts: number | null;
  fixedCosts: number | null;
  variableCosts: number | null;
  /** Offerer: net proceeds after own costs. Requester: delivered cost including own costs. */
  total: number | null;
  usableQuantity: number | null;
  /** Requester: total per usable unit. */
  perUsableUnit: number | null;
  baseline: number | null;
  /** Benefit against the existing route; positive = better than today. */
  contribution: number | null;
  breakEven: BreakEven;
  /** Weakest status of the inputs used: estimated < quoted < confirmed. */
  status: CostStatus | null;
  /** Inputs that are unknown, so the totals that need them stay empty. */
  missing: string[];
};

export type FeasibilityResult = {
  problems: TermProblem[];
  /** Amount of the material payment for the quantity (always ≥ 0; the direction says who pays). */
  materialPayment: number | null;
  freight: { total: number | null; offerer: number | null; requester: number | null } | null;
  /** Both before other costs – the same for both sites, built from shared inputs only. */
  offererNetProceeds: number | null;
  requesterDeliveredCost: number | null;
  own: OwnResult;
};

const STATUS_ORDER: readonly CostStatus[] = ["estimated", "quoted", "confirmed"];

/** Weakest of the given statuses; null when there are none. */
export function weakestStatus(statuses: readonly CostStatus[]): CostStatus | null {
  if (statuses.length === 0) return null;
  return STATUS_ORDER[Math.min(...statuses.map((status) => STATUS_ORDER.indexOf(status)))];
}

const cents = (value: number) => Math.round(value * 100) / 100;
const sum = (values: (number | null)[]) => (values.some((value) => value == null) ? null : cents(values.reduce<number>((total, value) => total + value!, 0)));

/** Problems that make the inputs contradictory (HTTP 422 at save). */
export function feasibilityProblems(shared: SharedInputs, own: PrivateInputs): TermProblem[] {
  const problems: TermProblem[] = [];
  const add = (field: string, code: string) => problems.push({ field, code });
  if (shared.paymentDirection === "no_payment") {
    if (shared.priceAmount != null) add("priceAmount", "NOT_APPLICABLE");
  } else if (shared.priceAmount != null && shared.priceUnit == null) add("priceUnitKey", "REQUIRED");
  // NT-L2-007: a delivered price already contains the freight – the same freight may not be added again
  if (shared.priceIncludesFreight && shared.freight != null) add("freight", "FREIGHT_ALREADY_INCLUDED");
  if (shared.freight) {
    if (shared.freight.payer === "shared") {
      if (shared.freight.offererSharePercent == null) add("freight.offererSharePercent", "REQUIRED");
    } else if (shared.freight.offererSharePercent != null) add("freight.offererSharePercent", "NOT_APPLICABLE");
  }
  if (own.yieldPercent != null && (own.yieldPercent <= 0 || own.yieldPercent > 100)) add("yieldPercent", "RANGE");
  return problems;
}

/** Total of the material payment for the quantity; null when the price is unknown or the units do not fit. */
function materialPayment(shared: SharedInputs, missing: string[]): number | null {
  if (shared.paymentDirection === "no_payment") return 0;
  if (shared.priceAmount == null || shared.priceUnit == null) {
    missing.push("price");
    return null;
  }
  // D17: no total on incompatible bases (a price per item for a quantity in kg)
  const inPriceUnits = convertQuantity(shared.quantity, shared.unit, shared.priceUnit);
  if (inPriceUnits == null) {
    missing.push("priceBasis");
    return null;
  }
  return cents(inPriceUnits * shared.priceAmount);
}

/** Freight split by the agreed shares; offerer + requester always add up to the total. */
function freightSplit(freight: Freight | null, missing: string[]) {
  if (!freight) return null;
  if (freight.amount == null) {
    missing.push("freight");
    return { total: null, offerer: null, requester: null };
  }
  const share = freight.payer === "offerer" ? 100 : freight.payer === "requester" ? 0 : (freight.offererSharePercent ?? 0);
  const offerer = cents((freight.amount * share) / 100);
  return { total: freight.amount, offerer, requester: cents(freight.amount - offerer) };
}

export function calculateFeasibility(shared: SharedInputs, own: PrivateInputs, party: Party): FeasibilityResult {
  const problems = feasibilityProblems(shared, own);
  const sharedMissing: string[] = [];
  const payment = materialPayment(shared, sharedMissing);
  const freight = freightSplit(shared.priceIncludesFreight ? null : shared.freight, sharedMissing);
  // signed for each side: what the side receives (offerer) or pays (requester) for the material
  const toOfferer = payment == null ? null : shared.paymentDirection === "requester_pays" ? payment : shared.paymentDirection === "offerer_pays" ? -payment : 0;
  const offererNetProceeds = toOfferer == null ? null : sum([toOfferer, freight ? (freight.offerer == null ? null : -freight.offerer) : 0]);
  const requesterDeliveredCost = toOfferer == null ? null : sum([toOfferer, freight ? freight.requester : 0]);

  const missing = [...sharedMissing];
  const fixedLines = own.costs.filter((cost) => cost.basis === "fixed");
  const variableLines = own.costs.filter((cost) => cost.basis === "variable");
  if (own.costs.some((cost) => cost.amount == null)) missing.push("costs");
  const fixedCosts = sum(fixedLines.map((cost) => cost.amount));
  const variablePerUnit = sum(variableLines.map((cost) => cost.amount));
  const variableCosts = variablePerUnit == null ? null : cents(variablePerUnit * shared.quantity);

  const beforeCosts = party === "offerer" ? offererNetProceeds : requesterDeliveredCost;
  const total = beforeCosts == null || fixedCosts == null || variableCosts == null ? null : party === "offerer" ? cents(beforeCosts - fixedCosts - variableCosts) : cents(beforeCosts + fixedCosts + variableCosts);

  const yieldShare = party === "requester" ? (own.yieldPercent == null ? null : own.yieldPercent / 100) : 1;
  if (party === "requester" && yieldShare == null) missing.push("yield");
  const usableQuantity = yieldShare == null ? null : Math.round(shared.quantity * yieldShare * 1000) / 1000;
  const perUsableUnit = party === "requester" && total != null && usableQuantity ? cents(total / usableQuantity) : null;

  const rate = own.baseline?.rate ?? null;
  if (rate == null) missing.push("baseline");
  // offerer: avoided cost of today's route; requester: what the replaced material costs today for the usable quantity
  const baseline = rate == null || usableQuantity == null ? null : cents(rate * usableQuantity);
  const contribution = baseline == null || total == null ? null : party === "offerer" ? cents(total + baseline) : cents(baseline - total);

  // Break-even: contribution(q) = margin × q − fixed. Freight counts as fixed (one shipment).
  let breakEven: BreakEven = { kind: "unknown" };
  if (contribution != null) {
    if (contribution <= 0) breakEven = { kind: "none" };
    else {
      const ownFreight = freight ? (party === "offerer" ? freight.offerer : freight.requester) : 0;
      const fixed = (fixedCosts ?? 0) + (ownFreight ?? 0);
      const margin = (contribution + fixed) / shared.quantity;
      breakEven = margin > 0 ? { kind: "quantity", quantity: Math.round((fixed / margin) * 1000) / 1000 } : { kind: "none" };
    }
  }

  const statuses: CostStatus[] = [];
  if (payment != null && shared.paymentDirection !== "no_payment") statuses.push(shared.priceStatus);
  if (freight && shared.freight && freight.total != null) statuses.push(shared.freight.status);
  for (const cost of own.costs) if (cost.amount != null) statuses.push(cost.status);
  if (own.baseline && rate != null) statuses.push(own.baseline.status);

  return {
    problems,
    materialPayment: payment,
    freight,
    offererNetProceeds,
    requesterDeliveredCost,
    own: {
      party,
      beforeCosts,
      fixedCosts,
      variableCosts,
      total,
      usableQuantity: party === "requester" ? usableQuantity : null,
      perUsableUnit,
      baseline,
      contribution,
      breakEven,
      status: weakestStatus(statuses),
      missing: [...new Set(missing)],
    },
  };
}
