// Data model (docs/FEATURES.md "Data model"): company → site → account, industrial parks, generic material
// catalogue, offers with delivery options, attribute values and history, enquiries; Level 2: material requests
// with accepted types/forms, technical criteria, history and responses; negotiations with immutable proposal
// revisions and exchanges with their history.
// Login tables (auth_*) are in auth-schema.ts. Value lists come from src/server/domain/listing.ts and
// status.ts; the CHECK rules below enforce them in the database too.
import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  ATTRIBUTE_TYPES,
  CLOSURE_REASONS,
  COMPARATORS,
  CRITERION_KINDS,
  DELIVERY_PRICING,
  DELIVERY_TERMS,
  DEMO_PATHWAYS,
  DOCUMENT_ACCESS,
  ENQUIRY_TOPICS,
  EVIDENCE_STATUSES,
  FREQUENCIES,
  INDUSTRIES,
  LEGAL_STATUSES,
  LOADING_EQUIPMENT,
  OFFER_PROVENANCES,
  ORIGINS,
  PACKAGING,
  PAYERS,
  PRICE_MODES,
  RECURRENCE_PERIODS,
  SAMPLE_AVAILABILITY,
  SITE_PROVENANCES,
  VAT_BASES,
} from "../domain/listing";
import {
  COST_STATUSES,
  EXCHANGE_STATUSES,
  FREIGHT_PAYERS,
  NEGOTIATION_STATUSES,
  PAYMENT_DIRECTIONS,
  QUALITY_RESULTS,
  TRANSPORT_ORGANISERS,
} from "../domain/negotiation";
import { OFFER_STATUSES, VERIFICATION_STATUSES } from "../domain/status";
import { UNIT_DIMENSIONS } from "../domain/units";

const id = () => bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const ref = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
/** Decimal numbers as JS numbers: quantities, prices and coordinates stay far below 2^53. */
const decimal = (name: string, precision: number, scale: number) =>
  numeric(name, { precision, scale, mode: "number" });

/** CHECK rule "column is one of the values" (or NULL); the values are constants from the code, never user input. */
function oneOf(name: string, column: AnyPgColumn, values: readonly string[]) {
  const list: SQL = sql.raw(values.map((value) => `'${value}'`).join(", "));
  return check(name, sql`${column} in (${list})`);
}

/**
 * Company: several sites can share one (same VAT ID). The row is created by the first registration that names the
 * VAT ID; its name becomes binding with the first verified site (src/server/dal/admin.ts) – an unverified claim
 * cannot name a company for others.
 */
export const companies = pgTable(
  "companies",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull(),
    vatId: varchar("vat_id", { length: 20 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("companies_vat_id_key").on(t.vatId)],
);

/** Industrial park: region geometry is data (X-06). Centre + radius are approximate and labelled as such. */
export const industrialParks = pgTable(
  "industrial_parks",
  {
    id: id(),
    slug: varchar("slug", { length: 60 }).notNull().unique(),
    name: varchar("name", { length: 150 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    latitude: decimal("latitude", 9, 6).notNull(),
    longitude: decimal("longitude", 9, 6).notNull(),
    radiusM: integer("radius_m").notNull().default(600),
    /** Where the position comes from, shown on the reference data page. */
    sourceNote: text("source_note").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("industrial_parks_radius_check", sql`${t.radiusM} between 100 and 5000`)],
);

/** Physical site of a company; one login belongs to exactly one site (auth_users.site_id). */
export const sites = pgTable(
  "sites",
  {
    id: id(),
    companyId: ref("company_id")
      .notNull()
      .references(() => companies.id),
    name: varchar("name", { length: 200 }).notNull(),
    /** Industry of this site (a branch can do something else than the head office). */
    industry: varchar("industry", { length: 30 }).notNull().default("other"),
    description: text("description"),
    streetAddress: varchar("street_address", { length: 255 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    /** street + postal code without case, spaces and punctuation – duplicate screening (D01). */
    addressKey: varchar("address_key", { length: 300 }).notNull(),
    parkId: ref("park_id").references(() => industrialParks.id),
    /** Unknown stays NULL: no geocoding service, the administrator may enter them at verification. */
    latitude: decimal("latitude", 9, 6),
    longitude: decimal("longitude", 9, 6),
    contactName: varchar("contact_name", { length: 150 }).notNull(),
    contactEmail: varchar("contact_email", { length: 254 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 30 }),
    /** Processing capabilities (domain/listing.ts CAPABILITIES). */
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationNote: text("verification_note"),
    /** Set at registration when company + address match an existing site; the administrator resolves it. */
    duplicateOfSiteId: ref("duplicate_of_site_id").references((): AnyPgColumn => sites.id),
    /** Contact name, e-mail and phone visible to verified members (otherwise contact via enquiry only). */
    contactVisible: boolean("contact_visible").notNull().default(true),
    /** Name and park appear in the public projection (regional map). */
    publicListed: boolean("public_listed").notNull().default(false),
    provenance: varchar("provenance", { length: 20 }).notNull().default("registered"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sites_company_idx").on(t.companyId),
    index("sites_park_idx").on(t.parkId),
    oneOf("sites_verification_status_check", t.verificationStatus, VERIFICATION_STATUSES),
    oneOf("sites_industry_check", t.industry, INDUSTRIES),
    oneOf("sites_provenance_check", t.provenance, SITE_PROVENANCES),
    check("sites_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("sites_longitude_check", sql`${t.longitude} between -180 and 180`),
    check("sites_coordinates_pair_check", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
  ],
);

/** Audit trail of verification (X-04): who changed which site from which status to which, and why. */
export const siteVerificationEvents = pgTable(
  "site_verification_events",
  {
    id: id(),
    siteId: ref("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    fromStatus: varchar("from_status", { length: 20 }).notNull(),
    toStatus: varchar("to_status", { length: 20 }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("site_verification_events_site_idx").on(t.siteId)],
);

// ── Material catalogue (reference data, D04) ────────────────────────────────────────────────────────────

export const materialCategories = pgTable("material_categories", {
  id: id(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameDe: varchar("name_de", { length: 100 }).notNull(),
  /** Only enabled categories can be published; the others are shown as "later". */
  enabled: boolean("enabled").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const materialTypes = pgTable(
  "material_types",
  {
    id: id(),
    categoryId: ref("category_id")
      .notNull()
      .references(() => materialCategories.id),
    key: varchar("key", { length: 40 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    nameDe: varchar("name_de", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("material_types_category_key").on(t.categoryId, t.key)],
);

export const materialForms = pgTable(
  "material_forms",
  {
    id: id(),
    categoryId: ref("category_id")
      .notNull()
      .references(() => materialCategories.id),
    key: varchar("key", { length: 40 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    nameDe: varchar("name_de", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("material_forms_category_key").on(t.categoryId, t.key)],
);

/** Measurement unit with its dimension; only units of one dimension are converted (factor to the base unit). */
export const units = pgTable(
  "units",
  {
    key: varchar("key", { length: 10 }).primaryKey(),
    nameEn: varchar("name_en", { length: 40 }).notNull(),
    nameDe: varchar("name_de", { length: 40 }).notNull(),
    dimension: varchar("dimension", { length: 10 }).notNull(),
    toBase: decimal("to_base", 12, 6).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [oneOf("units_dimension_check", t.dimension, UNIT_DIMENSIONS), check("units_to_base_check", sql`${t.toBase} > 0`)],
);

/** Units permitted for quantities and prices of a category. */
export const categoryUnits = pgTable(
  "category_units",
  {
    categoryId: ref("category_id")
      .notNull()
      .references(() => materialCategories.id),
    unitKey: varchar("unit_key", { length: 10 })
      .notNull()
      .references(() => units.key),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.unitKey] })],
);

/** Technical attribute of a category; `forms` limits it to some forms (empty = all forms). */
export const attributeDefinitions = pgTable(
  "attribute_definitions",
  {
    id: id(),
    categoryId: ref("category_id")
      .notNull()
      .references(() => materialCategories.id),
    key: varchar("key", { length: 60 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    nameDe: varchar("name_de", { length: 100 }).notNull(),
    dataType: varchar("data_type", { length: 10 }).notNull(),
    /** Display unit, e.g. "mm", "%", "g/10 min"; NULL for text and enum. */
    unit: varchar("unit", { length: 20 }),
    minValue: decimal("min_value", 14, 4),
    maxValue: decimal("max_value", 14, 4),
    /** Allowed values of an enum with their labels. */
    options: jsonb("options").$type<{ value: string; en: string; de: string }[]>().notNull().default([]),
    /** Form keys the attribute applies to; empty = every form of the category. */
    forms: jsonb("forms").$type<string[]>().notNull().default([]),
    required: boolean("required").notNull().default(false),
    /** Critical: an empty value is shown as "unknown" on the detail page instead of being hidden. */
    critical: boolean("critical").notNull().default(false),
    /** Key of another attribute: this one is required as soon as that one has a value (test conditions of an MFR). */
    requiredWith: varchar("required_with", { length: 60 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("attribute_definitions_category_key").on(t.categoryId, t.key),
    oneOf("attribute_definitions_data_type_check", t.dataType, ATTRIBUTE_TYPES),
  ],
);

// ── Offers ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Material offer of a site. A draft may be incomplete, so most columns are nullable; publishing checks
 * completeness (src/server/domain/publish.ts). "Expired" is not stored: active + expires_at in the past.
 */
export const offers = pgTable(
  "offers",
  {
    id: id(),
    siteId: ref("site_id")
      .notNull()
      .references(() => sites.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    /** Counts every saved change; a write with an outdated number is rejected (stale edit, L1-011). */
    revision: integer("revision").notNull().default(1),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    categoryId: ref("category_id").references(() => materialCategories.id),
    typeId: ref("type_id").references(() => materialTypes.id),
    formId: ref("form_id").references(() => materialForms.id),
    origin: varchar("origin", { length: 20 }),
    legalStatus: varchar("legal_status", { length: 20 }),
    wasteCode: varchar("waste_code", { length: 20 }),
    // Availability (L1-007): current stock and expected future output are separate.
    quantity: decimal("quantity", 14, 3),
    unitKey: varchar("unit_key", { length: 10 }).references(() => units.key),
    minLot: decimal("min_lot", 14, 3),
    frequency: varchar("frequency", { length: 20 }),
    recurrencePeriod: varchar("recurrence_period", { length: 20 }),
    recurrenceQuantity: decimal("recurrence_quantity", 14, 3),
    availableFrom: date("available_from", { mode: "string" }),
    collectionUntil: date("collection_until", { mode: "string" }),
    validityDays: integer("validity_days").notNull().default(30),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Price (L1-008): quotation has no amount, free is an explicit 0, paid recovery is paid by the offerer.
    priceMode: varchar("price_mode", { length: 20 }),
    priceAmount: decimal("price_amount", 12, 2),
    priceUnitKey: varchar("price_unit_key", { length: 10 }).references(() => units.key),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    vatBasis: varchar("vat_basis", { length: 20 }).notNull().default("unspecified"),
    payer: varchar("payer", { length: 20 }),
    // Logistics (L1-009); the accepted arrangements are rows in offer_delivery_options.
    deliveryPricing: varchar("delivery_pricing", { length: 20 }),
    maxDeliveryDistanceKm: integer("max_delivery_distance_km"),
    packaging: varchar("packaging", { length: 20 }),
    loadingEquipment: varchar("loading_equipment", { length: 20 }),
    // Evidence (L1-010): metadata only, no upload.
    evidenceStatus: varchar("evidence_status", { length: 20 }),
    datasheetAvailable: boolean("datasheet_available").notNull().default(false),
    datasheetAccess: varchar("datasheet_access", { length: 20 }).notNull().default("on_enquiry"),
    photosAvailable: boolean("photos_available").notNull().default(false),
    sampleAvailable: varchar("sample_available", { length: 10 }).notNull().default("unknown"),
    /** Set by the server from the owning site; "synthetic" listings keep their label everywhere. */
    provenance: varchar("provenance", { length: 20 }).notNull().default("self_declared"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("offers_site_idx").on(t.siteId),
    index("offers_discovery_idx").on(t.status, t.expiresAt),
    index("offers_material_idx").on(t.categoryId, t.typeId, t.formId),
    oneOf("offers_status_check", t.status, OFFER_STATUSES),
    oneOf("offers_origin_check", t.origin, ORIGINS),
    oneOf("offers_legal_status_check", t.legalStatus, LEGAL_STATUSES),
    oneOf("offers_frequency_check", t.frequency, FREQUENCIES),
    oneOf("offers_recurrence_period_check", t.recurrencePeriod, RECURRENCE_PERIODS),
    oneOf("offers_price_mode_check", t.priceMode, PRICE_MODES),
    oneOf("offers_vat_basis_check", t.vatBasis, VAT_BASES),
    oneOf("offers_payer_check", t.payer, PAYERS),
    oneOf("offers_delivery_pricing_check", t.deliveryPricing, DELIVERY_PRICING),
    oneOf("offers_packaging_check", t.packaging, PACKAGING),
    oneOf("offers_loading_equipment_check", t.loadingEquipment, LOADING_EQUIPMENT),
    oneOf("offers_evidence_status_check", t.evidenceStatus, EVIDENCE_STATUSES),
    oneOf("offers_datasheet_access_check", t.datasheetAccess, DOCUMENT_ACCESS),
    oneOf("offers_sample_available_check", t.sampleAvailable, SAMPLE_AVAILABILITY),
    oneOf("offers_provenance_check", t.provenance, OFFER_PROVENANCES),
    check("offers_quantity_check", sql`${t.quantity} > 0`),
    check("offers_min_lot_check", sql`${t.minLot} > 0`),
    check("offers_recurrence_quantity_check", sql`${t.recurrenceQuantity} > 0`),
    check("offers_price_amount_check", sql`${t.priceAmount} >= 0`),
    check("offers_validity_days_check", sql`${t.validityDays} between 1 and 90`),
    check("offers_max_delivery_distance_check", sql`${t.maxDeliveryDistanceKm} between 1 and 2000`),
    check("offers_revision_check", sql`${t.revision} >= 1`),
    // An active or closed listing always has the core of a published offer – a draft never slips through.
    check(
      "offers_published_complete_check",
      sql`${t.status} = 'draft' or (${t.categoryId} is not null and ${t.typeId} is not null and ${t.formId} is not null
        and ${t.quantity} is not null and ${t.unitKey} is not null and ${t.priceMode} is not null
        and ${t.expiresAt} is not null and ${t.publishedAt} is not null)`,
    ),
  ],
);

/** Accepted delivery arrangement of an offer; formal terms carry a named place and the Incoterms version. */
export const offerDeliveryOptions = pgTable(
  "offer_delivery_options",
  {
    offerId: ref("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 10 }).notNull(),
    namedPlace: varchar("named_place", { length: 200 }),
    incotermsVersion: varchar("incoterms_version", { length: 10 }),
    /** Description of a custom collection or recovery arrangement (never labelled as an Incoterm). */
    customNote: text("custom_note"),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.term] }), oneOf("offer_delivery_options_term_check", t.term, DELIVERY_TERMS)],
);

/** Value of a technical attribute for an offer. No row = unknown (never 0). */
export const offerAttributeValues = pgTable(
  "offer_attribute_values",
  {
    offerId: ref("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    attributeId: ref("attribute_id")
      .notNull()
      .references(() => attributeDefinitions.id),
    /** number / integer: the value · range: the lower bound */
    valueMin: decimal("value_min", 14, 4),
    /** range: the upper bound */
    valueMax: decimal("value_max", 14, 4),
    /** number: "lt" (<), "lte" (≤), "gte" (≥), "gt" (>) or NULL (=) */
    comparator: varchar("comparator", { length: 3 }),
    /** text and enum */
    valueText: text("value_text"),
  },
  (t) => [
    primaryKey({ columns: [t.offerId, t.attributeId] }),
    oneOf("offer_attribute_values_comparator_check", t.comparator, COMPARATORS),
  ],
);

/** History (X-04): one snapshot per saved state of an offer, with the actor and the status at that time. */
export const offerRevisions = pgTable(
  "offer_revisions",
  {
    offerId: ref("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    /** What happened: created, updated, published, renewed, closed */
    action: varchar("action", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.revision] })],
);

/** Private enquiry about one offer with at most one response (D11): no chat, no contract, no stock change. */
export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    offerId: ref("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    fromSiteId: ref("from_site_id")
      .notNull()
      .references(() => sites.id),
    toSiteId: ref("to_site_id")
      .notNull()
      .references(() => sites.id),
    senderUserId: text("sender_user_id").notNull(),
    topic: varchar("topic", { length: 20 }).notNull(),
    message: text("message").notNull(),
    response: text("response"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    responderUserId: text("responder_user_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("enquiries_to_site_idx").on(t.toSiteId, t.createdAt),
    index("enquiries_from_site_idx").on(t.fromSiteId, t.createdAt),
    oneOf("enquiries_topic_check", t.topic, ENQUIRY_TOPICS),
    check("enquiries_sites_differ_check", sql`${t.fromSiteId} <> ${t.toSiteId}`),
  ],
);

/**
 * The five illustrative cases A–E (L1-021). Always simulated: they show a possible pathway between two demo
 * sites and are never counted as a completed exchange.
 */
export const demoCases = pgTable(
  "demo_cases",
  {
    code: varchar("code", { length: 1 }).primaryKey(),
    titleEn: varchar("title_en", { length: 150 }).notNull(),
    titleDe: varchar("title_de", { length: 150 }).notNull(),
    textEn: text("text_en").notNull(),
    textDe: text("text_de").notNull(),
    pathway: varchar("pathway", { length: 30 }).notNull(),
    offerId: ref("offer_id").references(() => offers.id, { onDelete: "set null" }),
    fromSiteId: ref("from_site_id").references(() => sites.id, { onDelete: "set null" }),
    /** Possible receiver; NULL for the unresolved case. */
    toSiteId: ref("to_site_id").references(() => sites.id, { onDelete: "set null" }),
  },
  (t) => [oneOf("demo_cases_pathway_check", t.pathway, DEMO_PATHWAYS)],
);

// ── Level 2: material requests (L2-001 … L2-004) ────────────────────────────────────────────────────────

/**
 * Independent material request of a site: what it needs, not tied to an existing offer. Same lifecycle as an
 * offer (draft → active → closed, expired derived from expires_at); a closed request records why (D05).
 */
export const requests = pgTable(
  "requests",
  {
    id: id(),
    siteId: ref("site_id")
      .notNull()
      .references(() => sites.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    /** Counts every saved change; a write with an outdated number is rejected (stale edit). */
    revision: integer("revision").notNull().default(1),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    categoryId: ref("category_id").references(() => materialCategories.id),
    /** Accepted origins; empty = any. Accepted types and forms are rows in request_types / request_forms. */
    origins: jsonb("origins").$type<string[]>().notNull().default([]),
    quantity: decimal("quantity", 14, 3),
    unitKey: varchar("unit_key", { length: 10 }).references(() => units.key),
    /** Smallest batch the requester still accepts, in the request's unit. */
    minLot: decimal("min_lot", 14, 3),
    frequency: varchar("frequency", { length: 20 }),
    recurrencePeriod: varchar("recurrence_period", { length: 20 }),
    neededFrom: date("needed_from", { mode: "string" }),
    neededUntil: date("needed_until", { mode: "string" }),
    validityDays: integer("validity_days").notNull().default(30),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Price ceiling per unit – a preference for matching, never a binding bid. */
    maxPriceAmount: decimal("max_price_amount", 12, 2),
    maxPriceUnitKey: varchar("max_price_unit_key", { length: 10 }).references(() => units.key),
    /** Preferred delivery arrangements (DELIVERY_TERMS); empty = no preference. */
    deliveryTerms: jsonb("delivery_terms").$type<string[]>().notNull().default([]),
    /** Minimum evidence needed; NULL = any. */
    evidenceStatus: varchar("evidence_status", { length: 20 }),
    sampleRequired: boolean("sample_required").notNull().default(false),
    closureReason: varchar("closure_reason", { length: 20 }),
    /** Set by the server from the owning site, like offers. */
    provenance: varchar("provenance", { length: 20 }).notNull().default("self_declared"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("requests_site_idx").on(t.siteId),
    index("requests_discovery_idx").on(t.status, t.expiresAt),
    index("requests_category_idx").on(t.categoryId),
    oneOf("requests_status_check", t.status, OFFER_STATUSES),
    oneOf("requests_frequency_check", t.frequency, FREQUENCIES),
    oneOf("requests_recurrence_period_check", t.recurrencePeriod, RECURRENCE_PERIODS),
    oneOf("requests_evidence_status_check", t.evidenceStatus, EVIDENCE_STATUSES),
    oneOf("requests_closure_reason_check", t.closureReason, CLOSURE_REASONS),
    oneOf("requests_provenance_check", t.provenance, OFFER_PROVENANCES),
    check("requests_quantity_check", sql`${t.quantity} > 0`),
    check("requests_min_lot_check", sql`${t.minLot} > 0`),
    check("requests_max_price_check", sql`${t.maxPriceAmount} > 0`),
    check("requests_validity_days_check", sql`${t.validityDays} between 1 and 90`),
    check("requests_revision_check", sql`${t.revision} >= 1`),
    check("requests_closed_reason_check", sql`(${t.status} = 'closed') = (${t.closureReason} is not null)`),
    check(
      "requests_published_complete_check",
      sql`${t.status} = 'draft' or (${t.categoryId} is not null and ${t.quantity} is not null and ${t.unitKey} is not null
        and ${t.frequency} is not null and ${t.expiresAt} is not null and ${t.publishedAt} is not null)`,
    ),
  ],
);

/** Accepted material types of a request (foreign keys keep them inside the catalogue, X-02). */
export const requestTypes = pgTable(
  "request_types",
  {
    requestId: ref("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    typeId: ref("type_id")
      .notNull()
      .references(() => materialTypes.id),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.typeId] })],
);

/** Accepted forms of a request. */
export const requestForms = pgTable(
  "request_forms",
  {
    requestId: ref("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    formId: ref("form_id")
      .notNull()
      .references(() => materialForms.id),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.formId] })],
);

/**
 * Technical criterion of a request: an accepted range (numbers, either bound open) or value (enum, text), marked
 * as a hard requirement or a preference. No row = no criterion for that attribute.
 */
export const requestCriteria = pgTable(
  "request_criteria",
  {
    requestId: ref("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    attributeId: ref("attribute_id")
      .notNull()
      .references(() => attributeDefinitions.id),
    kind: varchar("kind", { length: 10 }).notNull(),
    valueMin: decimal("value_min", 14, 4),
    valueMax: decimal("value_max", 14, 4),
    valueText: text("value_text"),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.attributeId] }), oneOf("request_criteria_kind_check", t.kind, CRITERION_KINDS)],
);

/** History (X-04, L2-004): one snapshot per saved state of a request – an edited quantity stays identifiable. */
export const requestRevisions = pgTable(
  "request_revisions",
  {
    requestId: ref("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    /** created, updated, published, renewed, closed */
    action: varchar("action", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.revision] })],
);

/**
 * Response of a supplier site to a request (L2-003): one per site and request, optionally pointing at one of the
 * responder's own offers, and the request revision it answered (kept when the request changes later). The
 * requester may reply once. Only these two sites can read it.
 */
export const requestResponses = pgTable(
  "request_responses",
  {
    id: id(),
    requestId: ref("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    fromSiteId: ref("from_site_id")
      .notNull()
      .references(() => sites.id),
    toSiteId: ref("to_site_id")
      .notNull()
      .references(() => sites.id),
    senderUserId: text("sender_user_id").notNull(),
    offerId: ref("offer_id").references(() => offers.id, { onDelete: "set null" }),
    requestRevision: integer("request_revision").notNull(),
    message: text("message").notNull(),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    replierUserId: text("replier_user_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("request_responses_request_site_key").on(t.requestId, t.fromSiteId),
    index("request_responses_to_site_idx").on(t.toSiteId, t.createdAt),
    index("request_responses_from_site_idx").on(t.fromSiteId, t.createdAt),
    check("request_responses_sites_differ_check", sql`${t.fromSiteId} <> ${t.toSiteId}`),
  ],
);

// ── Level 2: negotiations and exchanges (L2-006, L2-011, D13, D16) ─────────────────────────────────────

/**
 * Negotiation between the site that offers (owner of the offer) and a requesting site about one offer, optionally
 * for one of the requester's requests. The terms live in proposal_revisions; this row holds the state: the current
 * revision, the accepted one, who decided. At most one open negotiation per offer and requesting site.
 * `simulated` is set by the server when the offer or a party is demo data (D13) and never changes.
 */
export const negotiations = pgTable(
  "negotiations",
  {
    id: id(),
    offerId: ref("offer_id")
      .notNull()
      .references(() => offers.id),
    requestId: ref("request_id").references(() => requests.id),
    offererSiteId: ref("offerer_site_id")
      .notNull()
      .references(() => sites.id),
    requesterSiteId: ref("requester_site_id")
      .notNull()
      .references(() => sites.id),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** Number of the newest revision; only this one can be accepted. */
    currentRevision: integer("current_revision").notNull().default(1),
    acceptedRevision: integer("accepted_revision"),
    simulated: boolean("simulated").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Site and user that accepted, declined or withdrew. */
    decidedBySiteId: ref("decided_by_site_id").references(() => sites.id),
    decidedByUserId: text("decided_by_user_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("negotiations_open_pair_key").on(t.offerId, t.requesterSiteId).where(sql`${t.status} = 'open'`),
    index("negotiations_offerer_idx").on(t.offererSiteId, t.updatedAt),
    index("negotiations_requester_idx").on(t.requesterSiteId, t.updatedAt),
    oneOf("negotiations_status_check", t.status, NEGOTIATION_STATUSES),
    check("negotiations_sites_differ_check", sql`${t.offererSiteId} <> ${t.requesterSiteId}`),
    check("negotiations_revision_check", sql`${t.currentRevision} >= 1`),
    check("negotiations_accepted_check", sql`(${t.status} = 'agreed') = (${t.acceptedRevision} is not null)`),
    check("negotiations_decided_check", sql`(${t.status} = 'open') = (${t.decidedAt} is null) and (${t.decidedAt} is null) = (${t.decidedBySiteId} is null)`),
  ],
);

/**
 * One proposal of a negotiation (L2-006). Rows are only ever inserted – a counterproposal is a new row, so every
 * earlier version stays as it was. Whether a revision is pending, superseded, accepted or declined follows from
 * the negotiation row.
 */
export const proposalRevisions = pgTable(
  "proposal_revisions",
  {
    negotiationId: ref("negotiation_id")
      .notNull()
      .references(() => negotiations.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    proposedBySiteId: ref("proposed_by_site_id")
      .notNull()
      .references(() => sites.id),
    authorUserId: text("author_user_id").notNull(),
    quantity: decimal("quantity", 14, 3).notNull(),
    unitKey: varchar("unit_key", { length: 10 })
      .notNull()
      .references(() => units.key),
    paymentDirection: varchar("payment_direction", { length: 20 }).notNull(),
    priceAmount: decimal("price_amount", 12, 2),
    priceUnitKey: varchar("price_unit_key", { length: 10 }).references(() => units.key),
    vatBasis: varchar("vat_basis", { length: 20 }).notNull(),
    deliveryTerm: varchar("delivery_term", { length: 10 }).notNull(),
    namedPlace: varchar("named_place", { length: 200 }).notNull(),
    /** "2020" for a formal term, NULL for a custom arrangement (D07). */
    incotermsVersion: varchar("incoterms_version", { length: 10 }),
    transportOrganiser: varchar("transport_organiser", { length: 20 }).notNull(),
    freightAmount: decimal("freight_amount", 12, 2),
    freightCostStatus: varchar("freight_cost_status", { length: 20 }),
    freightPayer: varchar("freight_payer", { length: 20 }),
    offererSharePercent: integer("offerer_share_percent"),
    deliveryFrom: date("delivery_from", { mode: "string" }),
    deliveryUntil: date("delivery_until", { mode: "string" }),
    technicalConditions: text("technical_conditions"),
    /** Why this revision was made; shown with the history. */
    note: text("note"),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.negotiationId, t.revision] }),
    oneOf("proposal_revisions_payment_check", t.paymentDirection, PAYMENT_DIRECTIONS),
    oneOf("proposal_revisions_vat_basis_check", t.vatBasis, VAT_BASES),
    oneOf("proposal_revisions_delivery_term_check", t.deliveryTerm, DELIVERY_TERMS),
    oneOf("proposal_revisions_transport_check", t.transportOrganiser, TRANSPORT_ORGANISERS),
    oneOf("proposal_revisions_cost_status_check", t.freightCostStatus, COST_STATUSES),
    oneOf("proposal_revisions_freight_payer_check", t.freightPayer, FREIGHT_PAYERS),
    check("proposal_revisions_quantity_check", sql`${t.quantity} > 0`),
    check("proposal_revisions_price_check", sql`(${t.paymentDirection} = 'no_payment') = (${t.priceAmount} is null) and (${t.priceAmount} is null or ${t.priceAmount} > 0)`),
    check("proposal_revisions_freight_check", sql`${t.freightAmount} is null or ${t.freightAmount} >= 0`),
    check("proposal_revisions_share_check", sql`(${t.freightPayer} = 'shared') = (${t.offererSharePercent} is not null) and (${t.offererSharePercent} is null or ${t.offererSharePercent} between 0 and 100)`),
    check("proposal_revisions_window_check", sql`${t.deliveryUntil} is null or ${t.deliveryFrom} is null or ${t.deliveryUntil} >= ${t.deliveryFrom}`),
  ],
);

/**
 * Exchange of an agreed negotiation (L2-011): linked to the accepted revision, planned → completed or cancelled.
 * Only the receiving site records the received quantity and the quality check. Closing a listing or contacting a
 * supplier never creates one. `simulated` is copied from the negotiation – simulated records never count as a
 * verified outcome (D13).
 */
export const exchanges = pgTable(
  "exchanges",
  {
    id: id(),
    negotiationId: ref("negotiation_id")
      .notNull()
      .references(() => negotiations.id),
    acceptedRevision: integer("accepted_revision").notNull(),
    offererSiteId: ref("offerer_site_id")
      .notNull()
      .references(() => sites.id),
    requesterSiteId: ref("requester_site_id")
      .notNull()
      .references(() => sites.id),
    status: varchar("status", { length: 20 }).notNull().default("planned"),
    /** Counts every saved change; a write with an outdated number is rejected (stale edit). */
    revision: integer("revision").notNull().default(1),
    plannedDate: date("planned_date", { mode: "string" }).notNull(),
    planNote: text("plan_note"),
    receivedQuantity: decimal("received_quantity", 14, 3),
    receivedUnitKey: varchar("received_unit_key", { length: 10 }).references(() => units.key),
    receivedOn: date("received_on", { mode: "string" }),
    qualityResult: varchar("quality_result", { length: 30 }),
    qualityNote: text("quality_note"),
    cancelReason: text("cancel_reason"),
    simulated: boolean("simulated").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("exchanges_negotiation_key").on(t.negotiationId),
    foreignKey({ name: "exchanges_accepted_revision_fk", columns: [t.negotiationId, t.acceptedRevision], foreignColumns: [proposalRevisions.negotiationId, proposalRevisions.revision] }),
    index("exchanges_offerer_idx").on(t.offererSiteId, t.updatedAt),
    index("exchanges_requester_idx").on(t.requesterSiteId, t.updatedAt),
    oneOf("exchanges_status_check", t.status, EXCHANGE_STATUSES),
    oneOf("exchanges_quality_check", t.qualityResult, QUALITY_RESULTS),
    check("exchanges_sites_differ_check", sql`${t.offererSiteId} <> ${t.requesterSiteId}`),
    check("exchanges_revision_check", sql`${t.revision} >= 1`),
    check("exchanges_received_quantity_check", sql`${t.receivedQuantity} is null or ${t.receivedQuantity} >= 0`),
    check(
      "exchanges_completed_check",
      sql`(${t.status} = 'completed') = (${t.completedAt} is not null) and (${t.status} <> 'completed' or (${t.receivedQuantity} is not null
        and ${t.receivedUnitKey} is not null and ${t.receivedOn} is not null and ${t.qualityResult} is not null))`,
    ),
    check("exchanges_cancelled_check", sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`),
  ],
);

/** History (X-04): one snapshot per saved state of an exchange, with the actor and the status at that time. */
export const exchangeEvents = pgTable(
  "exchange_events",
  {
    exchangeId: ref("exchange_id")
      .notNull()
      .references(() => exchanges.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    siteId: ref("site_id")
      .notNull()
      .references(() => sites.id),
    actorUserId: text("actor_user_id").notNull(),
    /** planned, updated, completed, cancelled */
    action: varchar("action", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.exchangeId, t.revision] })],
);
