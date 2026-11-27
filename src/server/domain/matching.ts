// Explained matching of a request and an offer (L2-005, D15). Every criterion is compared on its own and keeps its
// reason; there is no score. Hard requirements decide the result, preferences are reported next to it:
//   a known failed requirement            → incompatible (unless a documented processing step resolves it)
//   a requirement resolved by processing  → processing required (the missing preparation step is named)
//   a requirement without data            → conditional ("compatible on declared data" is not yet possible)
//   every requirement met                 → compatible on declared data
// Pure → tested on its own (matching.test.ts) and used by the Data Access Layer for lists and the detail page.
import { isUnknown, type AttributeValue, type AttributeValues } from "./attributes";
import { findUnit, type AttributeDefinition, type Catalogue } from "./catalogue";
import type { Capability, DeliveryTerm, Frequency, Origin, PriceMode } from "./listing";
import type { Criteria, CriterionValue } from "./request-rules";
import { convertPrice, convertQuantity } from "./units";

export const MATCH_RESULTS = ["compatible", "processing_required", "conditional", "incompatible"] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number];

/** met · failed · unknown (no or incomparable data) · processing (a preparation step would resolve it) */
export type Outcome = "met" | "failed" | "unknown" | "processing";

export type CriterionCheck = {
  /** "category", "type", "form", "origin", "quantity", "minLot", "timing", "evidence", "sample",
   *  "frequency", "price", "delivery" or "attributes.<key>" */
  key: string;
  /** Hard requirement (decides the result) or preference (reported only). */
  hard: boolean;
  outcome: Outcome;
  /** Preparation steps that would resolve it, in order (only with outcome "processing"). */
  steps?: Capability[];
};

export type MatchEvaluation = {
  result: MatchResult;
  checks: CriterionCheck[];
  /** All preparation steps the hard checks name, without repetition, in order. */
  steps: Capability[];
};

/** The request side as the rules need it: catalogue keys instead of ids. */
export type MatchRequest = {
  categoryId: number | null;
  typeKeys: string[];
  formKeys: string[];
  origins: Origin[];
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: Frequency | null;
  neededFrom: string | null;
  neededUntil: string | null;
  maxPriceAmount: number | null;
  maxPriceUnitKey: string | null;
  deliveryTerms: DeliveryTerm[];
  evidenceStatus: "self_declared" | "documented" | "tested" | null;
  sampleRequired: boolean;
  criteria: Criteria;
};

/** The offer side as the rules need it. */
export type MatchOffer = {
  categoryId: number | null;
  typeKey: string | null;
  formKey: string | null;
  origin: string | null;
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: string | null;
  availableFrom: string | null;
  collectionUntil: string | null;
  priceMode: string | null;
  priceAmount: number | null;
  priceUnitKey: string | null;
  deliveryTerms: DeliveryTerm[];
  evidenceStatus: string | null;
  sampleAvailable: string;
  attributes: AttributeValues;
};

/**
 * Documented preparation routes between plastic forms (Material fields sheet: "route may resolve"). A processor
 * with the capability is a candidate, not an acceptance – the result stays "processing required".
 */
export const PROCESSING_ROUTES: readonly { from: string; to: string; step: Capability }[] = [
  { from: "sheet", to: "regrind", step: "grinding" },
  { from: "component", to: "regrind", step: "grinding" },
  { from: "film", to: "regrind", step: "grinding" },
  { from: "regrind", to: "granulate", step: "regranulation" },
];

/** Shortest chain of preparation steps from one form to any accepted form; null = no documented route. */
export function processingSteps(from: string, accepted: readonly string[]): Capability[] | null {
  const queue: { form: string; steps: Capability[] }[] = [{ form: from, steps: [] }];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const { form, steps } = queue.shift()!;
    if (accepted.includes(form) && steps.length > 0) return steps;
    for (const route of PROCESSING_ROUTES) {
      if (route.from !== form || seen.has(route.to)) continue;
      seen.add(route.to);
      queue.push({ form: route.to, steps: [...steps, route.step] });
    }
  }
  return null;
}

const EVIDENCE_RANK: Record<string, number> = { self_declared: 1, documented: 2, tested: 3 };

/** Interval an entered offer value stands for: "< 2" → (−∞, 2], "3–6" → [3, 6], "0.8" → [0.8, 0.8]. */
function offerInterval(value: AttributeValue): [number, number] | null {
  if (value.valueMin == null) return null;
  if (value.valueMax != null) return [value.valueMin, value.valueMax];
  if (value.comparator === "lt" || value.comparator === "lte") return [-Infinity, value.valueMin];
  if (value.comparator === "gt" || value.comparator === "gte") return [value.valueMin, Infinity];
  return [value.valueMin, value.valueMin];
}

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** One technical criterion against the offer's value. */
export function attributeOutcome(definition: AttributeDefinition, criterion: CriterionValue, value: AttributeValue | undefined): Outcome {
  if (!value || isUnknown(value)) return "unknown";
  if (definition.dataType === "enum") return value.valueText === criterion.valueText ? "met" : "failed";
  if (definition.dataType === "text") {
    // Free text cannot prove a mismatch ("PC klar" vs "polycarbonate, clear"): no match stays open for review.
    const offered = normalise(value.valueText ?? "");
    const wanted = normalise(criterion.valueText ?? "");
    return offered.includes(wanted) || wanted.includes(offered) ? "met" : "unknown";
  }
  const range = offerInterval(value);
  if (!range) return "unknown";
  const low = criterion.valueMin ?? -Infinity;
  const high = criterion.valueMax ?? Infinity;
  if (range[0] >= low && range[1] <= high) return "met";
  if (range[1] < low || range[0] > high) return "failed";
  return "unknown"; // partly inside: the batch may or may not meet it
}

/** Compares one request with one offer. `catalogue` supplies units and attribute definitions. */
export function evaluateMatch(request: MatchRequest, offer: MatchOffer, catalogue: Pick<Catalogue, "units" | "attributes">): MatchEvaluation {
  const checks: CriterionCheck[] = [];
  const hard = (key: string, outcome: Outcome, steps?: Capability[]) => checks.push(steps ? { key, hard: true, outcome, steps } : { key, hard: true, outcome });
  const soft = (key: string, outcome: Outcome) => checks.push({ key, hard: false, outcome });

  hard("category", request.categoryId != null && request.categoryId === offer.categoryId ? "met" : "failed");

  // Material type: an unidentified polymer is unknown; mixed plastics need sorting first.
  if (request.typeKeys.length > 0) {
    if (offer.typeKey && request.typeKeys.includes(offer.typeKey)) hard("type", "met");
    else if (!offer.typeKey || offer.typeKey === "unknown") hard("type", "unknown");
    else if (offer.typeKey === "mixed") hard("type", "processing", ["sorting"]);
    else hard("type", "failed");
  }

  // Form: another form fails unless a documented route turns it into an accepted one.
  if (request.formKeys.length > 0) {
    if (offer.formKey && request.formKeys.includes(offer.formKey)) hard("form", "met");
    else if (!offer.formKey || offer.formKey === "other") hard("form", "unknown");
    else {
      const steps = processingSteps(offer.formKey, request.formKeys);
      if (steps) hard("form", "processing", steps);
      else hard("form", "failed");
    }
  }

  if (request.origins.length > 0) {
    if (!offer.origin || offer.origin === "unknown") hard("origin", "unknown");
    else hard("origin", request.origins.includes(offer.origin as Origin) ? "met" : "failed");
  }

  // Quantity: the batch must reach the smallest accepted lot; masses are compared in one unit, other units not at all.
  const requestUnit = findUnit(catalogue, request.unitKey);
  const offerUnit = findUnit(catalogue, offer.unitKey);
  if (request.quantity != null && requestUnit) {
    const available = offer.quantity != null && offerUnit ? convertQuantity(offer.quantity, offerUnit, requestUnit) : null;
    const needed = request.minLot ?? request.quantity;
    hard("quantity", available == null ? "unknown" : available >= needed ? "met" : "failed");
    if (offer.minLot != null && offerUnit) {
      const smallest = convertQuantity(offer.minLot, offerUnit, requestUnit);
      hard("minLot", smallest == null ? "unknown" : smallest <= request.quantity ? "met" : "failed");
    }
  }

  // Timing: the batch must be available within the requested window.
  if (request.neededFrom || request.neededUntil) {
    const tooLate = request.neededUntil != null && offer.availableFrom != null && offer.availableFrom > request.neededUntil;
    const tooEarly = request.neededFrom != null && offer.collectionUntil != null && offer.collectionUntil < request.neededFrom;
    hard("timing", tooLate || tooEarly ? "failed" : "met");
  }

  // Evidence: weaker or missing evidence is not a failure but keeps the result conditional (D15).
  if (request.evidenceStatus) {
    const rank = EVIDENCE_RANK[offer.evidenceStatus ?? ""] ?? 0;
    hard("evidence", rank >= EVIDENCE_RANK[request.evidenceStatus] ? "met" : "unknown");
  }
  if (request.sampleRequired) {
    hard("sample", offer.sampleAvailable === "yes" ? "met" : offer.sampleAvailable === "no" ? "failed" : "unknown");
  }

  // Technical criteria: required ones are hard, preferred ones only reported – a preference never overrides a failure.
  for (const [key, criterion] of Object.entries(request.criteria)) {
    const definition = catalogue.attributes.find((candidate) => candidate.categoryId === request.categoryId && candidate.key === key);
    if (!definition) continue;
    const outcome = attributeOutcome(definition, criterion, offer.attributes[key]);
    if (criterion.kind === "required") hard(`attributes.${key}`, outcome);
    else soft(`attributes.${key}`, outcome);
  }

  // Preferences.
  if (request.frequency === "recurring") soft("frequency", offer.frequency === "recurring" ? "met" : offer.frequency ? "failed" : "unknown");
  if (request.maxPriceAmount != null) soft("price", priceOutcome(request, offer, catalogue));
  if (request.deliveryTerms.length > 0) {
    soft("delivery", offer.deliveryTerms.length === 0 ? "unknown" : offer.deliveryTerms.some((term) => request.deliveryTerms.includes(term)) ? "met" : "failed");
  }

  const required = checks.filter((check) => check.hard);
  const result: MatchResult = required.some((check) => check.outcome === "failed")
    ? "incompatible"
    : required.some((check) => check.outcome === "processing")
      ? "processing_required"
      : required.some((check) => check.outcome === "unknown")
        ? "conditional"
        : "compatible";
  const steps = [...new Set(required.flatMap((check) => check.steps ?? []))];
  return { result, checks, steps };
}

/** Price ceiling: free and paid recovery are below any ceiling; "on enquiry" and other dimensions stay unknown. */
function priceOutcome(request: MatchRequest, offer: MatchOffer, catalogue: Pick<Catalogue, "units">): Outcome {
  const mode = offer.priceMode as PriceMode | null;
  if (mode === "free" || mode === "paid_recovery") return "met";
  if (!mode || mode === "quotation" || offer.priceAmount == null) return "unknown";
  const from = findUnit(catalogue, offer.priceUnitKey);
  const to = findUnit(catalogue, request.maxPriceUnitKey);
  const price = from && to ? convertPrice(offer.priceAmount, from, to) : null;
  if (price == null) return "unknown";
  return price <= request.maxPriceAmount! ? "met" : "failed";
}

/** Order of results in lists: what can be used as declared first, the incompatible last. */
export const RESULT_ORDER: Record<MatchResult, number> = { compatible: 0, processing_required: 1, conditional: 2, incompatible: 3 };
