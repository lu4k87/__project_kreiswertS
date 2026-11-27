// Data Access Layer: private assessments of a match or negotiation (L2-007 feasibility, L2-008 environmental) and the
// company circularity overview (PG-27). An assessment belongs to one site: every query filters by the viewer's site,
// so the other site of a match never sees the baseline, the own costs or the result – to anyone else it does not
// exist. Access to the subject itself goes through getMatch() / getNegotiation(), the same rules as their pages.
import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { AccessError, RuleError, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { assessments, impactFactors, offers, requests, sites } from "../db/schema";
import { subjectKey, type AssessmentKind, type AssessmentStatus, type AssessmentSubject } from "../domain/assessment";
import { findUnit, type Catalogue } from "../domain/catalogue";
import { calculateEnvironment, type EnvironmentInputs, type EnvironmentResult, type Factor, type FactorBoundary, type FactorKind, type FactorUnit } from "../domain/environment";
import { calculateFeasibility, type FeasibilityResult, type Party, type SharedInputs } from "../domain/feasibility";
import { listingRef, requestRef } from "../domain/listing";
import type { TermProblem } from "../domain/negotiation";
import { convertQuantity } from "../domain/units";
import {
  environmentalInput,
  matchFeasibility,
  privateFeasibility,
  type AssessmentSave,
  type EnvironmentalInput,
  type MatchFeasibilityInput,
  type PrivateFeasibilityInput,
} from "../validation/assessments";
import { getCatalogue } from "./catalogue";
import { listExchanges, type ExchangeSummary } from "./exchanges";
import { getMatch, type MatchDetail } from "./matches";
import { getNegotiation, type NegotiationDetail } from "./negotiations";

/** Ceiling per site (one row per subject and kind, so this is only reached by unusual use). */
const MAX_ASSESSMENTS_PER_SITE = 500;

/**
 * Stored inputs are read through the same Zod schema they were saved with: a row that no longer fits (schema
 * changed, edited by hand) is treated as missing instead of breaking the page, the release or the overview.
 */
export function storedInputs<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, row: { id: number; inputs: unknown } | null): T | null {
  if (!row) return null;
  const parsed = schema.safeParse(row.inputs);
  if (parsed.success) return parsed.data;
  console.error(`assessment ${row.id}: stored inputs no longer valid`);
  return null;
}

// ── Factors ─────────────────────────────────────────────────────────────────────────────────────────────

export type FactorView = Factor & { key: string; nameEn: string; nameDe: string; source: string; sourceUrl: string | null };

/** Reference data: every stored factor version, in seed order. */
export async function listFactors(): Promise<FactorView[]> {
  const rows = await db.select().from(impactFactors).orderBy(asc(impactFactors.sortOrder), asc(impactFactors.key), asc(impactFactors.version));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    version: row.version,
    nameEn: row.nameEn,
    nameDe: row.nameDe,
    kind: row.kind as FactorKind,
    value: row.value,
    unit: row.unit as FactorUnit,
    geography: row.geography,
    boundary: row.boundary as FactorBoundary,
    source: row.source,
    sourceUrl: row.sourceUrl,
    example: row.example,
  }));
}

// ── Inputs → domain ─────────────────────────────────────────────────────────────────────────────────────

/** Shared terms of a match: the viewer's own assumptions, prefilled from the listings. */
function sharedFromMatch(input: MatchFeasibilityInput, catalogue: Catalogue, permitted: readonly string[]): { shared: SharedInputs | null; problems: TermProblem[] } {
  const unit = permitted.includes(input.unitKey) ? findUnit(catalogue, input.unitKey) : null;
  const priceUnit = input.priceUnitKey == null || !permitted.includes(input.priceUnitKey) ? null : findUnit(catalogue, input.priceUnitKey);
  const problems: TermProblem[] = [];
  if (!unit) problems.push({ field: "unitKey", code: "UNIT_NOT_PERMITTED" });
  if (input.priceUnitKey != null && !priceUnit) problems.push({ field: "priceUnitKey", code: "UNIT_NOT_PERMITTED" });
  if (!unit) return { shared: null, problems };
  return {
    shared: {
      quantity: input.quantity,
      unit,
      paymentDirection: input.paymentDirection,
      priceAmount: input.priceAmount,
      priceUnit,
      priceStatus: input.priceStatus,
      priceIncludesFreight: input.priceIncludesFreight,
      freight: input.freight,
    },
    problems,
  };
}

/** Shared terms of a negotiation: the current (or agreed) proposal – quoted while open, confirmed once agreed. */
export function sharedFromNegotiation(negotiation: NegotiationDetail, catalogue: Catalogue): SharedInputs | null {
  const terms = negotiation.current.terms;
  const unit = findUnit(catalogue, terms.unitKey);
  if (!unit) return null;
  return {
    quantity: terms.quantity,
    unit,
    paymentDirection: terms.paymentDirection,
    priceAmount: terms.priceAmount,
    priceUnit: findUnit(catalogue, terms.priceUnitKey),
    priceStatus: negotiation.status === "agreed" ? "confirmed" : "quoted",
    // a proposal names freight separately from the price (L2-006), so nothing is included twice
    priceIncludesFreight: false,
    freight:
      terms.freightAmount == null
        ? null
        : { amount: terms.freightAmount, status: terms.freightCostStatus ?? "estimated", payer: terms.freightPayer ?? "requester", offererSharePercent: terms.offererSharePercent },
  };
}

function environmentInputs(input: EnvironmentalInput, catalogue: Catalogue, factors: FactorView[], permitted?: readonly string[]): { inputs: EnvironmentInputs | null; problems: TermProblem[] } {
  const problems: TermProblem[] = [];
  const unit = !permitted || permitted.includes(input.unitKey) ? findUnit(catalogue, input.unitKey) : null;
  if (!unit) problems.push({ field: "unitKey", code: "UNIT_NOT_PERMITTED" });
  const factor = (id: number | null | undefined, field: string): Factor | null => {
    if (id == null) return null;
    const found = factors.find((candidate) => candidate.id === id);
    if (!found) problems.push({ field, code: "UNKNOWN_FACTOR" });
    return found ?? null;
  };
  const inputs: EnvironmentInputs | null = unit
    ? {
        quantity: input.quantity,
        unit,
        yieldPercent: input.yieldPercent,
        substitutionPercent: input.substitutionPercent,
        existing: input.existing ? { treatment: factor(input.existing.treatmentFactorId, "existingTreatment"), distanceKm: input.existing.distanceKm } : null,
        processing: input.processingFactorId === "none" ? "none" : factor(input.processingFactorId, "processing"),
        proposedDistanceKm: input.proposedDistanceKm,
        residueTreatment: factor(input.residueTreatmentFactorId, "residueTreatment"),
        virginProduction: factor(input.virginProductionFactorId, "virginProduction"),
        transport: factor(input.transportFactorId, "transport"),
      }
    : null;
  return { inputs, problems };
}

/** Units permitted for the offer's category – the same list as the forms of the listings. */
export function permittedUnitsOf(detail: MatchDetail, catalogue: Catalogue): string[] {
  return catalogue.categories.find((category) => category.id === detail.offer.category?.id)?.unitKeys ?? [];
}

// ── Defaults ────────────────────────────────────────────────────────────────────────────────────────────

/** Common quantity basis of a match: the need, in the offer's unit, at most the offered batch. */
function matchQuantity(detail: MatchDetail, catalogue: Catalogue): { quantity: number; unitKey: string } {
  const { offer, request } = detail;
  const unitKey = offer.unitKey ?? request.unitKey ?? "kg";
  const offerUnit = findUnit(catalogue, unitKey);
  const requestUnit = findUnit(catalogue, request.unitKey);
  const need = request.quantity != null && offerUnit && requestUnit ? convertQuantity(request.quantity, requestUnit, offerUnit) : null;
  const quantity = need != null && offer.quantity != null ? Math.min(need, offer.quantity) : (need ?? offer.quantity ?? 1);
  return { quantity, unitKey };
}

function matchFeasibilityDefaults(detail: MatchDetail, catalogue: Catalogue): MatchFeasibilityInput {
  const { offer } = detail;
  const mode = offer.priceMode;
  const paymentDirection = mode === "paid_recovery" ? "offerer_pays" : mode === "free" ? "no_payment" : "requester_pays";
  return {
    ...matchQuantity(detail, catalogue),
    paymentDirection,
    priceAmount: paymentDirection === "no_payment" ? null : (offer.priceAmount ?? null),
    priceUnitKey: paymentDirection === "no_payment" ? null : (offer.priceUnitKey ?? null),
    priceStatus: "estimated",
    priceIncludesFreight: offer.deliveryPricing === "included",
    freight: null,
    yieldPercent: null,
    costs: [],
    baseline: null,
  };
}

const PRIVATE_DEFAULTS: PrivateFeasibilityInput = { yieldPercent: null, costs: [], baseline: null };

/** Virgin material the offer's polymer replaces – a suggestion the viewer can change; a sourced factor first. */
const VIRGIN_BY_TYPE: Record<string, string[]> = { hdpe: ["virgin-pe"], ldpe: ["virgin-pe"], lldpe: ["virgin-pe"], pp: ["virgin-pp"], pc: ["virgin-pc"], pvc: ["virgin-s-pvc", "virgin-pvc"] };

function environmentDefaults(detail: MatchDetail, catalogue: Catalogue, factors: FactorView[]): EnvironmentalInput {
  const byKey = (keys: string[] | undefined) => keys?.map((key) => factors.find((factor) => factor.key === key)?.id).find((id) => id != null) ?? null;
  return {
    ...matchQuantity(detail, catalogue),
    yieldPercent: null,
    substitutionPercent: null,
    existing: null,
    processingFactorId: detail.evaluation.steps.length === 0 ? "none" : null,
    // straight line between the two sites – labelled as such on the page; factors come in seed order, sourced first
    proposedDistanceKm: detail.distanceKm == null ? null : Math.round(detail.distanceKm * 10) / 10,
    residueTreatmentFactorId: null,
    virginProductionFactorId: byKey(detail.offer.type?.key ? VIRGIN_BY_TYPE[detail.offer.type.key] : undefined),
    transportFactorId: factors.find((factor) => factor.kind === "transport")?.id ?? null,
    assumptions: null,
  };
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

export type SavedState = { id: number; revision: number; status: AssessmentStatus; updatedAt: string } | null;

export type MatchFeasibilityView = { saved: SavedState; party: Party; inputs: MatchFeasibilityInput; result: FeasibilityResult | null; problems: TermProblem[] };
export type NegotiationFeasibilityView = { saved: SavedState; party: Party; inputs: PrivateFeasibilityInput; shared: SharedInputs | null; result: FeasibilityResult | null };
export type EnvironmentView = { saved: SavedState; inputs: EnvironmentalInput; result: EnvironmentResult | null; problems: TermProblem[]; factors: FactorView[] };

type Row = typeof assessments.$inferSelect;

async function loadOwn(siteId: number, kind: AssessmentKind, subject: AssessmentSubject): Promise<Row | null> {
  const [row] = await db.select().from(assessments).where(and(eq(assessments.siteId, siteId), eq(assessments.kind, kind), eq(assessments.subjectKey, subjectKey(subject))));
  return row ?? null;
}

const savedState = (row: Row | null): SavedState => (row ? { id: row.id, revision: row.revision, status: row.status as AssessmentStatus, updatedAt: row.updatedAt.toISOString() } : null);

/** The viewer must be one of the two sides of the match it was handed (getMatch() checked everything else). */
function sideOf(viewer: Viewer, detail: MatchDetail): Party {
  const { site } = requireVerifiedSite(viewer);
  const party: Party = detail.side === "request" ? "requester" : "offerer";
  const ownSiteId = party === "requester" ? detail.request.requester.id : detail.offer.supplier.id;
  if (ownSiteId !== site.id) throw new AccessError("NOT_FOUND");
  return party;
}

/** PG-22: the viewer's private feasibility and environmental assessment of a match it may open. */
export async function getMatchAssessments(viewer: Viewer, detail: MatchDetail): Promise<{ feasibility: MatchFeasibilityView; environment: EnvironmentView }> {
  const party = sideOf(viewer, detail);
  const { site } = requireVerifiedSite(viewer);
  const subject: AssessmentSubject = { kind: "match", requestId: detail.request.id, offerId: detail.offer.id };
  const [catalogue, factors, feasibilityRow, environmentRow] = await Promise.all([
    getCatalogue(),
    listFactors(),
    loadOwn(site.id, "feasibility", subject),
    loadOwn(site.id, "environmental", subject),
  ]);

  const feasibilityInputs = storedInputs(matchFeasibility, feasibilityRow) ?? matchFeasibilityDefaults(detail, catalogue);
  const permitted = permittedUnitsOf(detail, catalogue);
  const { shared, problems } = sharedFromMatch(feasibilityInputs, catalogue, permitted);
  const environmentInput = storedInputs(environmentalInput, environmentRow) ?? environmentDefaults(detail, catalogue, factors);
  const environment = environmentInputs(environmentInput, catalogue, factors, permitted);
  return {
    feasibility: { saved: savedState(feasibilityRow), party, inputs: feasibilityInputs, result: shared ? calculateFeasibility(shared, feasibilityInputs, party) : null, problems },
    environment: {
      saved: savedState(environmentRow),
      inputs: environmentInput,
      result: environment.inputs ? calculateEnvironment(environment.inputs) : null,
      problems: environment.problems,
      factors,
    },
  };
}

/** PG-24: the viewer's private costs and baseline against the current (or agreed) proposal. */
export async function getNegotiationFeasibility(viewer: Viewer, negotiation: NegotiationDetail): Promise<NegotiationFeasibilityView> {
  const { site } = requireSite(viewer);
  const [catalogue, row] = await Promise.all([getCatalogue(), loadOwn(site.id, "feasibility", { kind: "negotiation", negotiationId: negotiation.id })]);
  const inputs = storedInputs(privateFeasibility, row) ?? PRIVATE_DEFAULTS;
  const shared = sharedFromNegotiation(negotiation, catalogue);
  return { saved: savedState(row), party: negotiation.role, inputs, shared, result: shared ? calculateFeasibility(shared, inputs, negotiation.role) : null };
}

// ── Writing ─────────────────────────────────────────────────────────────────────────────────────────────

type Resolved = {
  kind: AssessmentKind;
  subject: AssessmentSubject;
  offerId: number;
  requestId: number | null;
  negotiationId: number | null;
  simulated: boolean;
  problems: TermProblem[];
  result: FeasibilityResult | EnvironmentResult | null;
};

/** Checks access to the subject (the same rules as its page) and the business rules of the inputs. */
async function resolve(viewer: Viewer, input: AssessmentSave): Promise<Resolved> {
  const catalogue = await getCatalogue();
  if (input.type === "negotiation_feasibility") {
    const negotiation = await getNegotiation(viewer, input.subject.negotiationId);
    const shared = sharedFromNegotiation(negotiation, catalogue);
    const result = shared ? calculateFeasibility(shared, input.inputs, negotiation.role) : null;
    return {
      kind: "feasibility",
      subject: input.subject,
      offerId: negotiation.offer.id,
      requestId: negotiation.request?.id ?? null,
      negotiationId: negotiation.id,
      simulated: negotiation.simulated,
      problems: result?.problems ?? [],
      result,
    };
  }
  const detail = await getMatch(viewer, input.subject.requestId, input.subject.offerId);
  const party = sideOf(viewer, detail);
  // D13: demo data anywhere – either listing or either site – makes it simulated (as for negotiations)
  const siteRows = await db
    .select({ provenance: sites.provenance })
    .from(sites)
    .where(inArray(sites.id, [detail.offer.supplier.id, detail.request.requester.id]));
  const simulated = [detail.offer.provenance, detail.request.provenance, ...siteRows.map((row) => row.provenance)].includes("synthetic");
  const base = { subject: input.subject, offerId: detail.offer.id, requestId: detail.request.id, negotiationId: null, simulated };
  const permitted = permittedUnitsOf(detail, catalogue);
  if (input.type === "feasibility") {
    const { shared, problems } = sharedFromMatch(input.inputs, catalogue, permitted);
    const result = shared ? calculateFeasibility(shared, input.inputs, party) : null;
    return { ...base, kind: "feasibility", problems: [...problems, ...(result?.problems ?? [])], result };
  }
  const { inputs, problems } = environmentInputs(input.inputs, catalogue, await listFactors(), permitted);
  const result = inputs ? calculateEnvironment(inputs) : null;
  return { ...base, kind: "environmental", problems: [...problems, ...(result?.problems ?? [])], result };
}

/**
 * PUT /api/my/assessments: create (expectedRevision null) or replace (the revision the page showed) the viewer's
 * assessment of one subject. Every save returns an approved assessment to draft – an approval covers what was
 * reviewed, not later changes. The answer carries the result calculated from the saved inputs.
 */
export async function saveAssessment(
  viewer: Viewer,
  input: AssessmentSave,
): Promise<{ id: number; revision: number; status: AssessmentStatus; result: FeasibilityResult | EnvironmentResult | null }> {
  const { site } = requireVerifiedSite(viewer);
  const resolved = await resolve(viewer, input);
  if (resolved.problems.length > 0) throw new RuleError(resolved.problems);
  const key = subjectKey(resolved.subject);
  const stale = (current: number) => new AccessError("CONFLICT", { reason: "STALE", currentRevision: current });

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: assessments.id, revision: assessments.revision })
      .from(assessments)
      .where(and(eq(assessments.siteId, site.id), eq(assessments.kind, resolved.kind), eq(assessments.subjectKey, key)))
      .for("update");
    if (existing) {
      if (input.expectedRevision !== existing.revision) throw stale(existing.revision);
      const [updated] = await tx
        .update(assessments)
        .set({ inputs: input.inputs, status: "draft", approvedAt: null, revision: existing.revision + 1, simulated: resolved.simulated, updatedAt: new Date() })
        .where(and(eq(assessments.id, existing.id), eq(assessments.revision, existing.revision)))
        .returning({ id: assessments.id, revision: assessments.revision });
      if (!updated) throw stale(existing.revision);
      return { ...updated, status: "draft" as const, result: resolved.result };
    }
    if (input.expectedRevision != null) throw stale(0);
    // the ceiling is counted under a row lock of the site (as the enquiry limits), so parallel saves cannot pass it
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, site.id)).for("update");
    const [{ n }] = await tx.select({ n: count() }).from(assessments).where(eq(assessments.siteId, site.id));
    if (n >= MAX_ASSESSMENTS_PER_SITE) throw new AccessError("RATE_LIMITED");
    const [created] = await tx
      .insert(assessments)
      .values({
        siteId: site.id,
        kind: resolved.kind,
        subjectKey: key,
        offerId: resolved.offerId,
        requestId: resolved.requestId,
        negotiationId: resolved.negotiationId,
        inputs: input.inputs,
        simulated: resolved.simulated,
      })
      .onConflictDoNothing()
      .returning({ id: assessments.id, revision: assessments.revision });
    if (!created) throw stale(1); // another save of the same site was faster
    return { ...created, status: "draft" as const, result: resolved.result };
  });
}

/** POST /api/my/assessments/[id]/approve: release an environmental result for the own overview (PG-27). */
export async function approveAssessment(viewer: Viewer, assessmentId: number, expectedRevision: number): Promise<{ id: number; revision: number; status: "approved" }> {
  const { site } = requireVerifiedSite(viewer);
  const [catalogue, factors] = await Promise.all([getCatalogue(), listFactors()]);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.siteId, site.id))).for("update");
    if (!row) throw new AccessError("NOT_FOUND");
    if (row.kind !== "environmental") throw new RuleError([{ field: "kind", code: "NOT_APPLICABLE" }]);
    if (row.revision !== expectedRevision) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: row.revision });
    if (row.status === "approved") return { id: row.id, revision: row.revision, status: "approved" as const };
    const stored = storedInputs(environmentalInput, row);
    const { inputs } = stored ? environmentInputs(stored, catalogue, factors) : { inputs: null };
    // D18: only a comparative result can be released – without baseline or factors there is nothing to show
    if (!inputs || calculateEnvironment(inputs).status === "incomplete") throw new RuleError([{ field: "result", code: "INCOMPLETE" }]);
    const [updated] = await tx
      .update(assessments)
      .set({ status: "approved", approvedAt: new Date(), revision: row.revision + 1, updatedAt: new Date() })
      .where(and(eq(assessments.id, row.id), eq(assessments.revision, row.revision)))
      .returning({ id: assessments.id, revision: assessments.revision });
    if (!updated) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: row.revision });
    return { ...updated, status: "approved" as const };
  });
}

// ── Circularity overview (PG-27) ────────────────────────────────────────────────────────────────────────

export type ImpactCard = {
  id: number;
  status: AssessmentStatus;
  request: { id: number; ref: string; title: string } | null;
  offer: { id: number; ref: string; title: string };
  simulated: boolean;
  illustrative: boolean;
  result: EnvironmentStatusView;
  approvedAt: string | null;
};
type EnvironmentStatusView = Pick<EnvironmentResult, "status" | "quantityKg" | "displacementKg" | "transport" | "lifecycle">;

/** Sums of approved assessments; simulated ones are summed apart and never mixed in (D13). */
export type ImpactTotals = { count: number; quantityKg: number; displacementKg: number; lifecycleDifferenceKg: number; lifecycleCount: number; transportDifferenceKg: number; transportCount: number };

export type ImpactOverview = {
  exchanges: ExchangeSummary & { verifiedReceived: { unitKey: string; quantity: number }[] };
  approved: ImpactCard[];
  drafts: number;
  totals: { actual: ImpactTotals; simulated: ImpactTotals };
  /** Any approved result uses an example factor without a source. */
  illustrative: boolean;
};

const emptyTotals = (): ImpactTotals => ({ count: 0, quantityKg: 0, displacementKg: 0, lifecycleDifferenceKg: 0, lifecycleCount: 0, transportDifferenceKg: 0, transportCount: 0 });
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * PG-27: the viewer's own outcome indicators. Exchanges count as realised only when completed, not simulated and
 * not rejected; environmental results only when the owner approved them, and they stay estimates – never a
 * realised saving.
 */
export async function getImpactOverview(viewer: Viewer): Promise<ImpactOverview> {
  const { site } = requireSite(viewer);
  const own = and(eq(assessments.siteId, site.id), eq(assessments.kind, "environmental"));
  // every released assessment (at most the site ceiling), so no sum is cut off; drafts only counted
  const [catalogue, factors, exchangeList, rows, [{ drafts }]] = await Promise.all([
    getCatalogue(),
    listFactors(),
    listExchanges(viewer),
    db
      .select({ assessment: assessments, offerTitle: offers.title, requestTitle: requests.title })
      .from(assessments)
      .innerJoin(offers, eq(assessments.offerId, offers.id))
      .leftJoin(requests, eq(assessments.requestId, requests.id))
      .where(and(own, eq(assessments.status, "approved")))
      .orderBy(sql`${assessments.approvedAt} desc`)
      .limit(MAX_ASSESSMENTS_PER_SITE),
    db.select({ drafts: count() }).from(assessments).where(and(own, eq(assessments.status, "draft"))),
  ]);

  const received = new Map<string, number>();
  for (const exchange of exchangeList.exchanges) {
    if (exchange.verifiedOutcome && exchange.received) received.set(exchange.received.unitKey, round3((received.get(exchange.received.unitKey) ?? 0) + exchange.received.quantity));
  }

  const totals = { actual: emptyTotals(), simulated: emptyTotals() };
  const approved: ImpactCard[] = [];
  for (const { assessment, offerTitle, requestTitle } of rows) {
    const stored = storedInputs(environmentalInput, assessment);
    const inputs = stored ? environmentInputs(stored, catalogue, factors).inputs : null;
    const result = inputs ? calculateEnvironment(inputs) : null;
    if (!result) continue;
    approved.push({
      id: assessment.id,
      status: "approved",
      request: assessment.requestId != null && requestTitle != null ? { id: assessment.requestId, ref: requestRef(assessment.requestId), title: requestTitle } : null,
      offer: { id: assessment.offerId, ref: listingRef(assessment.offerId), title: offerTitle },
      simulated: assessment.simulated,
      illustrative: result.illustrative,
      result: { status: result.status, quantityKg: result.quantityKg, displacementKg: result.displacementKg, transport: result.transport, lifecycle: result.lifecycle },
      approvedAt: assessment.approvedAt?.toISOString() ?? null,
    });
    const bucket = assessment.simulated ? totals.simulated : totals.actual;
    bucket.count += 1;
    bucket.quantityKg = round3(bucket.quantityKg + (result.quantityKg ?? 0));
    bucket.displacementKg = round3(bucket.displacementKg + (result.displacementKg ?? 0));
    if (result.lifecycle) {
      bucket.lifecycleCount += 1;
      bucket.lifecycleDifferenceKg = round3(bucket.lifecycleDifferenceKg + result.lifecycle.differenceKg);
    }
    if (result.transport) {
      bucket.transportCount += 1;
      bucket.transportDifferenceKg = round3(bucket.transportDifferenceKg + result.transport.differenceKg);
    }
  }

  return {
    exchanges: { ...exchangeList.summary, verifiedReceived: [...received].map(([unitKey, quantity]) => ({ unitKey, quantity })) },
    approved,
    drafts,
    totals,
    illustrative: approved.some((card) => card.illustrative),
  };
}

