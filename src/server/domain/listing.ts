// Fixed value lists of Level 1 (docs/FEATURES.md). Database, API, validation and UI use the same values.
// Pure data → also loaded in the browser (forms); texts DE/EN are in src/i18n/platform.ts.
// The material catalogue (categories, types, forms, attributes, units) is NOT here: it is data in the database.

export const ORIGINS = ["pre_consumer", "post_consumer", "mixed", "unknown"] as const;
export type Origin = (typeof ORIGINS)[number];

export const LEGAL_STATUSES = ["waste", "by_product", "end_of_waste", "product", "unknown"] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export const FREQUENCIES = ["one_time", "recurring"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const RECURRENCE_PERIODS = ["weekly", "monthly", "quarterly"] as const;
export type RecurrencePeriod = (typeof RECURRENCE_PERIODS)[number];

export const PRICE_MODES = ["fixed", "negotiable", "quotation", "free", "paid_recovery"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const VAT_BASES = ["net", "gross", "unspecified"] as const;
export type VatBasis = (typeof VAT_BASES)[number];

export const PAYERS = ["requester", "offerer"] as const;
export type Payer = (typeof PAYERS)[number];

export const DELIVERY_TERMS = ["exw", "fca", "dap", "dpu", "custom"] as const;
export type DeliveryTerm = (typeof DELIVERY_TERMS)[number];

/** How delivery by the offerer is priced (only relevant with DAP or DPU). */
export const DELIVERY_PRICING = ["quotation", "negotiable", "included"] as const;
export type DeliveryPricing = (typeof DELIVERY_PRICING)[number];

export const PACKAGING = ["big_bags", "bales", "boxes", "pallets", "rolls", "loose", "other"] as const;
export type Packaging = (typeof PACKAGING)[number];

export const LOADING_EQUIPMENT = ["forklift", "ramp", "crane", "none"] as const;
export type LoadingEquipment = (typeof LOADING_EQUIPMENT)[number];

export const EVIDENCE_STATUSES = ["self_declared", "documented", "tested", "unknown"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const SAMPLE_AVAILABILITY = ["yes", "no", "unknown"] as const;
export type SampleAvailability = (typeof SAMPLE_AVAILABILITY)[number];

/** Who may open the datasheet: every verified member, or only after an enquiry. */
export const DOCUMENT_ACCESS = ["members", "on_enquiry"] as const;
export type DocumentAccess = (typeof DOCUMENT_ACCESS)[number];

/** Where a record comes from. "synthetic" = fictional demo data; set by the server, never by the browser. */
export const SITE_PROVENANCES = ["synthetic", "registered"] as const;
export type SiteProvenance = (typeof SITE_PROVENANCES)[number];
export const OFFER_PROVENANCES = ["synthetic", "self_declared"] as const;
export type OfferProvenance = (typeof OFFER_PROVENANCES)[number];

export const CAPABILITIES = ["cutting", "grinding", "sorting", "regranulation", "compounding", "other"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const INDUSTRIES = ["manufacturing", "recycling", "packaging", "construction", "logistics", "other"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const ENQUIRY_TOPICS = ["quotation", "sample", "collection", "specification", "other"] as const;
export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number];

/** The five illustrative cases of the presentation (L1-021); always simulated, never a completed exchange. */
export const DEMO_PATHWAYS = [
  "direct_reuse",
  "pooled_recycling",
  "specialist_recycling",
  "sorting_grinding",
  "unresolved",
] as const;
export type DemoPathway = (typeof DEMO_PATHWAYS)[number];

export const ATTRIBUTE_TYPES = ["number", "range", "integer", "text", "enum"] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const COMPARATORS = ["lt", "lte", "gte", "gt"] as const;
export type Comparator = (typeof COMPARATORS)[number];

/** Radius steps of "Search wider area" in km. */
export const RADIUS_STEPS_KM = [5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 25;

/** Listing validity in days (D05): default and limits. */
export const DEFAULT_VALIDITY_DAYS = 30;
export const MAX_VALIDITY_DAYS = 90;

/** Listing reference shown to users and carried by enquiries, e.g. KW-000042. */
export function listingRef(offerId: number): string {
  return `KW-${String(offerId).padStart(6, "0")}`;
}

// ── Level 2: material requests and matching (docs/FEATURES.md "Requests and matches") ────────────────────

/** Why a request was closed (D05): the need was met, or the requester withdrew it. */
export const CLOSURE_REASONS = ["fulfilled", "withdrawn"] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

/** A technical criterion of a request is either a hard requirement or a preference (D15: kept separate). */
export const CRITERION_KINDS = ["required", "preferred"] as const;
export type CriterionKind = (typeof CRITERION_KINDS)[number];

/** Request reference shown to users and carried by responses, e.g. RQ-000012. */
export function requestRef(requestId: number): string {
  return `RQ-${String(requestId).padStart(6, "0")}`;
}
