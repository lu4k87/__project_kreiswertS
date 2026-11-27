// Combined chain benefit of both sites of a negotiation (Level 2): the offerer's and the requester's contribution
// against today's routes, added up. The material payment between them cancels out in the sum, so the total shows
// what the exchange is worth to the chain as a whole. Pure → tested on its own (chain.test.ts).
//
// Consent rule: each site's private inputs are used only after that site released them explicitly, and a release
// covers exactly the saved assessment and the proposal it was given for – a new save or a counterproposal ends it.
import { weakestStatus, type OwnResult } from "./feasibility";
import type { CostStatus } from "./negotiation";

export type Consent = { assessmentRevision: number; termsRevision: number };

/** A release is valid only for the assessment revision and the proposal revision it was given for. */
export function consentValid(consent: Consent | null, current: { assessmentRevision: number | null; termsRevision: number }): boolean {
  return consent != null && current.assessmentRevision === consent.assessmentRevision && current.termsRevision === consent.termsRevision;
}

export type ChainBenefit = {
  /** Offerer's contribution + requester's contribution in EUR; null when either is unknown. */
  total: number | null;
  /** Weakest cost status of both sides. */
  status: CostStatus | null;
  /** Sides whose contribution is still unknown (missing baseline or costs). */
  unknown: ("offerer" | "requester")[];
};

export function combinedChainBenefit(offerer: Pick<OwnResult, "contribution" | "status">, requester: Pick<OwnResult, "contribution" | "status">): ChainBenefit {
  const unknown: ChainBenefit["unknown"] = [];
  if (offerer.contribution == null) unknown.push("offerer");
  if (requester.contribution == null) unknown.push("requester");
  const total = unknown.length > 0 ? null : Math.round((offerer.contribution! + requester.contribution!) * 100) / 100;
  const statuses = [offerer.status, requester.status].filter((status): status is CostStatus => status != null);
  return { total, status: weakestStatus(statuses), unknown };
}
