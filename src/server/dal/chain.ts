// Data Access Layer: combined chain benefit of both sites of a negotiation (Level 2). Each site's commercial
// comparison stays private; it is used for the combined figure only after that site released it explicitly, and
// only for the saved revision and the proposal it released it for. The other site then sees the combined total –
// never the baseline, the costs or the contribution of the other side (which it could only work out by subtracting
// its own; the release text says so).
import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { AccessError, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { assessments, chainConsents, negotiations } from "../db/schema";
import { subjectKey } from "../domain/assessment";
import { combinedChainBenefit, consentValid, type ChainBenefit } from "../domain/chain";
import { calculateFeasibility } from "../domain/feasibility";
import { privateFeasibility } from "../validation/assessments";
import type { ChainConsentInput } from "../validation/contracts";
import { sharedFromNegotiation, storedInputs } from "./assessments";
import { getCatalogue } from "./catalogue";
import { getNegotiation, type NegotiationDetail } from "./negotiations";

/** Negotiations shown with a combined benefit on the overview (newest consent first). Each card loads its
 *  negotiation – kept small so one page view stays a bounded number of queries (security review, CWE-400). */
const MAX_LISTED = 20;

type AssessmentRow = typeof assessments.$inferSelect;
type ConsentRow = typeof chainConsents.$inferSelect;

export type ChainView = {
  /** The viewer's saved commercial comparison of this negotiation (needed for a release). */
  own: { id: number; revision: number } | null;
  /** The viewer's release: valid, or given for an older save or proposal. */
  ownConsent: "valid" | "outdated" | null;
  otherConsent: "valid" | null;
  termsRevision: number;
  /** Only when both releases are valid. */
  combined: ChainBenefit | null;
  simulated: boolean;
};

async function loadAssessment(siteId: number, negotiationId: number): Promise<AssessmentRow | null> {
  const [row] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.siteId, siteId), eq(assessments.kind, "feasibility"), eq(assessments.subjectKey, subjectKey({ kind: "negotiation", negotiationId }))));
  return row ?? null;
}

const state = (consent: ConsentRow | undefined, row: AssessmentRow | null, termsRevision: number) =>
  consent == null ? null : consentValid(consent, { assessmentRevision: row?.revision ?? null, termsRevision }) ? ("valid" as const) : ("outdated" as const);

/** The chain section of a negotiation the viewer may open (getNegotiation() checked the access). */
export async function getChainView(viewer: Viewer, negotiation: NegotiationDetail): Promise<ChainView> {
  const { site } = requireSite(viewer);
  const otherSiteId = negotiation.otherSite.id;
  const [consents, own, other, catalogue] = await Promise.all([
    db.select().from(chainConsents).where(eq(chainConsents.negotiationId, negotiation.id)),
    loadAssessment(site.id, negotiation.id),
    loadAssessment(otherSiteId, negotiation.id),
    getCatalogue(),
  ]);
  const termsRevision = negotiation.current.revision;
  const ownConsent = state(consents.find((consent) => consent.siteId === site.id), own, termsRevision);
  // an outdated release of the other site is shown as none: "outdated" would tell that it saved its private
  // comparison again (security review 2026-11-27)
  const otherState = state(consents.find((consent) => consent.siteId === otherSiteId), other, termsRevision);
  const otherConsent = otherState === "valid" ? otherState : null;
  let combined: ChainBenefit | null = null;
  const shared = sharedFromNegotiation(negotiation, catalogue);
  const ownInputs = storedInputs(privateFeasibility, own);
  const otherInputs = storedInputs(privateFeasibility, other);
  if (ownConsent === "valid" && otherConsent === "valid" && shared && ownInputs && otherInputs) {
    const ownResult = calculateFeasibility(shared, ownInputs, negotiation.role).own;
    const otherResult = calculateFeasibility(shared, otherInputs, negotiation.role === "offerer" ? "requester" : "offerer").own;
    combined = negotiation.role === "offerer" ? combinedChainBenefit(ownResult, otherResult) : combinedChainBenefit(otherResult, ownResult);
  }
  return { own: own ? { id: own.id, revision: own.revision } : null, ownConsent, otherConsent, termsRevision, combined, simulated: negotiation.simulated };
}

/**
 * Give or withdraw the viewer's release. Giving needs the saved comparison and the proposal the page showed (409
 * STALE otherwise) – the release covers exactly that state.
 */
export async function setChainConsent(viewer: Viewer, negotiationId: number, input: ChainConsentInput): Promise<{ consent: boolean }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const negotiation = await getNegotiation(viewer, negotiationId); // 404 for anyone outside the pair
  if (!input.consent) {
    await db.delete(chainConsents).where(and(eq(chainConsents.negotiationId, negotiationId), eq(chainConsents.siteId, site.id)));
    return { consent: false };
  }
  const own = await loadAssessment(site.id, negotiationId);
  if (!own) throw new AccessError("CONFLICT", { reason: "NO_ASSESSMENT" });
  if (own.revision !== input.assessmentRevision) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: own.revision });
  if (negotiation.current.revision !== input.termsRevision) throw new AccessError("CONFLICT", { reason: "STALE_TERMS" });
  const values = { negotiationId, siteId: site.id, assessmentId: own.id, assessmentRevision: own.revision, termsRevision: input.termsRevision, userId, createdAt: new Date() };
  await db
    .insert(chainConsents)
    .values(values)
    .onConflictDoUpdate({ target: [chainConsents.negotiationId, chainConsents.siteId], set: { assessmentId: own.id, assessmentRevision: own.revision, termsRevision: input.termsRevision, userId, createdAt: values.createdAt } });
  return { consent: true };
}

export type ChainCard = { negotiation: { id: number; ref: string; offerTitle: string }; otherSite: string; combined: ChainBenefit; simulated: boolean };

/** PG-27: negotiations of the viewer where both sites released their comparison – the combined benefit of each. */
export async function listChainBenefits(viewer: Viewer): Promise<ChainCard[]> {
  const { site } = requireSite(viewer);
  const other = sql`exists (select 1 from ${chainConsents} c2 where c2.negotiation_id = ${chainConsents.negotiationId} and c2.site_id <> ${site.id})`;
  const rows = await db
    .select({ negotiationId: chainConsents.negotiationId })
    .from(chainConsents)
    .innerJoin(negotiations, eq(chainConsents.negotiationId, negotiations.id))
    .where(and(eq(chainConsents.siteId, site.id), ne(negotiations.status, "withdrawn"), other))
    .orderBy(sql`${chainConsents.createdAt} desc`)
    .limit(MAX_LISTED);
  const cards: ChainCard[] = [];
  for (const { negotiationId } of rows) {
    const negotiation = await getNegotiation(viewer, negotiationId);
    const view = await getChainView(viewer, negotiation);
    if (view.combined) cards.push({ negotiation: { id: negotiation.id, ref: negotiation.ref, offerTitle: negotiation.offer.title }, otherSite: `${negotiation.otherSite.companyName} – ${negotiation.otherSite.name}`, combined: view.combined, simulated: negotiation.simulated });
  }
  return cards;
}
