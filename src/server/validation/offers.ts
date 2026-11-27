// Station 3 – validation of offers: shape and types of what the browser sends. Business rules that need the
// catalogue (unit permitted? attribute applies to the form? complete enough to publish?) are in
// src/server/domain/publish.ts. Only zod + pure modules are imported → the offer form uses the same schema.
import { z } from "zod";
import {
  COMPARATORS,
  DEFAULT_RADIUS_KM,
  DEFAULT_VALIDITY_DAYS,
  DELIVERY_PRICING,
  DELIVERY_TERMS,
  DOCUMENT_ACCESS,
  ENQUIRY_TOPICS,
  EVIDENCE_STATUSES,
  FREQUENCIES,
  LEGAL_STATUSES,
  LOADING_EQUIPMENT,
  MAX_VALIDITY_DAYS,
  ORIGINS,
  PACKAGING,
  PRICE_MODES,
  RADIUS_STEPS_KM,
  RECURRENCE_PERIODS,
  SAMPLE_AVAILABILITY,
  VAT_BASES,
} from "../domain/listing";
import { MAX_ATTRIBUTE_TEXT } from "../domain/attributes";
import { HAS_LETTER_OR_DIGIT, decimal, idParam, isoDate, line, nullable, optionalParam, paragraph } from "./common";

/** No category has anywhere near this many attributes; the limit keeps bodies and history snapshots small. */
const MAX_ATTRIBUTES = 100;

const positive = (decimals: number) => decimal(decimals).refine((value) => value > 0);

const attributeValue = z.object({
  valueMin: nullable(z.number().finite().min(-1e9).max(1e9)),
  valueMax: nullable(z.number().finite().min(-1e9).max(1e9)),
  comparator: nullable(z.enum(COMPARATORS)),
  valueText: nullable(paragraph(MAX_ATTRIBUTE_TEXT)),
});

const deliveryOption = z.object({
  term: z.enum(DELIVERY_TERMS),
  namedPlace: nullable(line(200)),
  customNote: nullable(paragraph(500)),
});

/**
 * Body of POST /api/my/offers and PUT /api/my/offers/[id]. A draft needs only a title; everything else may be
 * null. Fields the server sets itself (owner site, status, provenance, payer, revision) are not part of it –
 * anything else in the body is dropped.
 */
export const offerInput = z.object({
  title: line(200).min(3).regex(HAS_LETTER_OR_DIGIT),
  description: nullable(paragraph(2000)),
  categoryId: nullable(idParam),
  typeId: nullable(idParam),
  formId: nullable(idParam),
  origin: nullable(z.enum(ORIGINS)),
  legalStatus: nullable(z.enum(LEGAL_STATUSES)),
  wasteCode: nullable(line(20)),
  quantity: nullable(positive(3)),
  unitKey: nullable(line(10)),
  minLot: nullable(positive(3)),
  frequency: nullable(z.enum(FREQUENCIES)),
  recurrencePeriod: nullable(z.enum(RECURRENCE_PERIODS)),
  recurrenceQuantity: nullable(positive(3)),
  availableFrom: nullable(isoDate),
  collectionUntil: nullable(isoDate),
  validityDays: z.number().int().min(1).max(MAX_VALIDITY_DAYS).default(DEFAULT_VALIDITY_DAYS),
  priceMode: nullable(z.enum(PRICE_MODES)),
  priceAmount: nullable(decimal(2, 1e8)),
  priceUnitKey: nullable(line(10)),
  vatBasis: z.enum(VAT_BASES).default("unspecified"),
  deliveryOptions: z
    .array(deliveryOption)
    .max(DELIVERY_TERMS.length)
    .refine((options) => new Set(options.map((option) => option.term)).size === options.length)
    .default([]),
  deliveryPricing: nullable(z.enum(DELIVERY_PRICING)),
  maxDeliveryDistanceKm: nullable(z.number().int().min(1).max(2000)),
  packaging: nullable(z.enum(PACKAGING)),
  loadingEquipment: nullable(z.enum(LOADING_EQUIPMENT)),
  evidenceStatus: nullable(z.enum(EVIDENCE_STATUSES)),
  datasheetAvailable: z.boolean().default(false),
  datasheetAccess: z.enum(DOCUMENT_ACCESS).default("on_enquiry"),
  photosAvailable: z.boolean().default(false),
  sampleAvailable: z.enum(SAMPLE_AVAILABILITY).default("unknown"),
  /** Attribute values by attribute key; a missing key or an all-null value means unknown. At most 100 keys per offer. */
  attributes: z
    .record(z.string().max(60), attributeValue)
    .refine((values) => Object.keys(values).length <= MAX_ATTRIBUTES)
    .default({}),
});

export type OfferInput = z.infer<typeof offerInput>;

/** PUT: the revision the browser loaded – an outdated one is answered with HTTP 409 (stale edit). */
export const offerUpdate = offerInput.extend({ expectedRevision: z.number().int().min(1) });
export type OfferUpdate = z.infer<typeof offerUpdate>;

/** POST …/publish, …/close, …/renew: optional revision check for the buttons on a page that may be outdated. */
export const offerAction = z.object({ expectedRevision: z.number().int().min(1).optional() });

export const SEARCH_SCOPES = ["park", "radius"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];
export const SEARCH_SORTS = ["newest", "distance", "quantity"] as const;
export const DELIVERY_FILTERS = ["collection", "delivered"] as const;

/**
 * Filters of GET /api/offers, /offers and /map (L1-013, L1-014): the same parameters for the local and the wider
 * search, so widening keeps every filter.
 */
export const offerSearchQuery = z.object({
  scope: optionalParam(z.enum(SEARCH_SCOPES).default("park")),
  /** Explicit area when the own park is unknown (or to look into another park). */
  parkId: optionalParam(idParam.optional()),
  radiusKm: optionalParam(
    z.coerce
      .number()
      .refine((value) => (RADIUS_STEPS_KM as readonly number[]).includes(value))
      .default(DEFAULT_RADIUS_KM),
  ),
  categoryId: optionalParam(idParam.optional()),
  typeId: optionalParam(idParam.optional()),
  formId: optionalParam(idParam.optional()),
  origin: optionalParam(z.enum(ORIGINS).optional()),
  frequency: optionalParam(z.enum(FREQUENCIES).optional()),
  delivery: optionalParam(z.enum(DELIVERY_FILTERS).optional()),
  /** Minimum current stock in kg; listings in a unit that is not a mass cannot be compared and drop out. */
  minQuantityKg: optionalParam(z.coerce.number().positive().max(1e9).optional()),
  sort: optionalParam(z.enum(SEARCH_SORTS).optional()),
  limit: optionalParam(z.coerce.number().int().min(1).max(100).default(50)),
});

export type OfferSearchQuery = z.infer<typeof offerSearchQuery>;

/** Body of POST /api/offers/[id]/enquiries. */
export const enquiryInput = z.object({
  topic: z.enum(ENQUIRY_TOPICS),
  message: paragraph(2000).min(10).regex(HAS_LETTER_OR_DIGIT),
});
export type EnquiryInput = z.infer<typeof enquiryInput>;

/** Body of POST /api/my/enquiries/[id]/response. */
export const enquiryResponseInput = z.object({ response: paragraph(2000).min(2).regex(HAS_LETTER_OR_DIGIT) });
