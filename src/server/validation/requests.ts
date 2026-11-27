// Station 3 – validation of material requests and responses: shape and types of what the browser sends. Rules that
// need the catalogue (types of the category? criterion applies to an accepted form?) are in
// src/server/domain/request-rules.ts. Only zod + pure modules are imported → the request form uses the same schema.
import { z } from "zod";
import { MAX_ATTRIBUTE_TEXT } from "../domain/attributes";
import {
  CLOSURE_REASONS,
  CRITERION_KINDS,
  DEFAULT_RADIUS_KM,
  DEFAULT_VALIDITY_DAYS,
  DELIVERY_TERMS,
  FREQUENCIES,
  MAX_VALIDITY_DAYS,
  ORIGINS,
  RADIUS_STEPS_KM,
  RECURRENCE_PERIODS,
} from "../domain/listing";
import { HAS_LETTER_OR_DIGIT, decimal, idParam, isoDate, line, nullable, optionalParam, paragraph } from "./common";
import { SEARCH_SCOPES } from "./offers";

/** Far more than any category has; keeps bodies and history snapshots small. */
const MAX_CRITERIA = 100;
const MAX_CHOICES = 50;

const positive = (decimals: number, max?: number) => decimal(decimals, max).refine((value) => value > 0);
const uniqueList = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((list) => new Set(list).size === list.length)
    .default([]);

const criterion = z.object({
  kind: z.enum(CRITERION_KINDS),
  valueMin: nullable(z.number().finite().min(-1e9).max(1e9)),
  valueMax: nullable(z.number().finite().min(-1e9).max(1e9)),
  valueText: nullable(line(MAX_ATTRIBUTE_TEXT)),
});

/**
 * Body of POST /api/my/requests and PUT /api/my/requests/[id]. A draft needs only a title. Fields the server sets
 * itself (owner site, status, provenance, revision, closure) are not part of it – anything else is dropped.
 */
export const requestInput = z.object({
  title: line(200).min(3).regex(HAS_LETTER_OR_DIGIT),
  description: nullable(paragraph(2000)),
  categoryId: nullable(idParam),
  typeIds: uniqueList(idParam, MAX_CHOICES),
  formIds: uniqueList(idParam, MAX_CHOICES),
  origins: uniqueList(z.enum(ORIGINS), ORIGINS.length),
  quantity: nullable(positive(3)),
  unitKey: nullable(line(10)),
  minLot: nullable(positive(3)),
  frequency: nullable(z.enum(FREQUENCIES)),
  recurrencePeriod: nullable(z.enum(RECURRENCE_PERIODS)),
  neededFrom: nullable(isoDate),
  neededUntil: nullable(isoDate),
  validityDays: z.number().int().min(1).max(MAX_VALIDITY_DAYS).default(DEFAULT_VALIDITY_DAYS),
  maxPriceAmount: nullable(positive(2, 1e8)),
  maxPriceUnitKey: nullable(line(10)),
  deliveryTerms: uniqueList(z.enum(DELIVERY_TERMS), DELIVERY_TERMS.length),
  evidenceStatus: nullable(z.enum(["self_declared", "documented", "tested"])),
  sampleRequired: z.boolean().default(false),
  /** Criteria by attribute key; an attribute without a criterion is simply left out. */
  criteria: z
    .record(z.string().max(60), criterion)
    .refine((values) => Object.keys(values).length <= MAX_CRITERIA)
    .default({}),
});

export type RequestInput = z.infer<typeof requestInput>;

/** PUT: the revision the browser loaded – an outdated one is answered with HTTP 409 (stale edit). */
export const requestUpdate = requestInput.extend({ expectedRevision: z.number().int().min(1) });
export type RequestUpdate = z.infer<typeof requestUpdate>;

/** POST …/publish, …/renew: optional revision check for buttons on a page that may be outdated. */
export const requestAction = z.object({ expectedRevision: z.number().int().min(1).optional() });

/** POST …/close: why the request ends (D05: fulfilled or withdrawn). */
export const requestClose = z.object({ reason: z.enum(CLOSURE_REASONS) });

export const REQUEST_SORTS = ["newest", "distance"] as const;

/**
 * Filters of GET /api/requests and /requests (L2-002): own park first, wider area by radius, the same filters in
 * both. Type and form filters find requests that accept that type or form.
 */
export const requestSearchQuery = z.object({
  scope: optionalParam(z.enum(SEARCH_SCOPES).default("park")),
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
  frequency: optionalParam(z.enum(FREQUENCIES).optional()),
  sort: optionalParam(z.enum(REQUEST_SORTS).optional()),
  limit: optionalParam(z.coerce.number().int().min(1).max(100).default(50)),
});

export type RequestSearchQuery = z.infer<typeof requestSearchQuery>;

/** Body of POST /api/requests/[id]/responses: a message and optionally one of the responder's own active offers. */
export const responseInput = z.object({
  message: paragraph(2000).min(10).regex(HAS_LETTER_OR_DIGIT),
  offerId: nullable(idParam),
});
export type ResponseInput = z.infer<typeof responseInput>;

/** Body of POST /api/my/responses/[id]/reply. */
export const replyInput = z.object({ reply: paragraph(2000).min(2).regex(HAS_LETTER_OR_DIGIT) });
