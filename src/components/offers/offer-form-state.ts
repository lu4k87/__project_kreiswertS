// State of the offer form as the inputs hold it (text), and its conversion to and from the validated offer input.
// Pure – no React, no server import – so the conversion and the browser-side checks are tested on their own.
import type { AttributeDefinition, Catalogue } from "@/server/domain/catalogue";
import { applicableAttributes } from "@/server/domain/attributes";
import { amountRule } from "@/server/domain/price";
import { DELIVERY_TERMS, type DeliveryTerm, type PriceMode } from "@/server/domain/listing";
import { offerProblems, type PublishMode } from "@/server/domain/publish";
import { offerInput, type OfferInput } from "@/server/validation/offers";

export type FieldProblem = { field: string; code: string };
export type AttributeState = { min: string; max: string; comparator: string; text: string };
export type DeliveryState = Record<DeliveryTerm, { on: boolean; namedPlace: string; customNote: string }>;

export type FormState = {
  title: string;
  description: string;
  categoryId: string;
  typeId: string;
  formId: string;
  origin: string;
  legalStatus: string;
  wasteCode: string;
  quantity: string;
  unitKey: string;
  minLot: string;
  frequency: string;
  recurrencePeriod: string;
  recurrenceQuantity: string;
  availableFrom: string;
  collectionUntil: string;
  validityDays: string;
  priceMode: string;
  priceAmount: string;
  priceUnitKey: string;
  vatBasis: string;
  delivery: DeliveryState;
  deliveryPricing: string;
  maxDeliveryDistanceKm: string;
  packaging: string;
  loadingEquipment: string;
  evidenceStatus: string;
  datasheetAvailable: boolean;
  datasheetAccess: string;
  photosAvailable: boolean;
  sampleAvailable: string;
  attributes: Record<string, AttributeState>;
};

const text = (value: string | number | null | undefined) => (value == null ? "" : String(value));
export const emptyAttribute: AttributeState = { min: "", max: "", comparator: "", text: "" };

/** Defaults of a new offer: the only enabled category preselected, available from today, 30 days visible. */
export function newOfferInput(catalogue: Catalogue, today: string): OfferInput {
  const enabled = catalogue.categories.filter((category) => category.enabled);
  return offerInput.parse({ title: "New offer", categoryId: enabled.length === 1 ? enabled[0].id : null, availableFrom: today, frequency: "one_time" });
}

export function fromInput(input: OfferInput, isNew = false): FormState {
  const delivery = Object.fromEntries(
    DELIVERY_TERMS.map((term) => {
      const option = input.deliveryOptions.find((candidate) => candidate.term === term);
      return [term, { on: Boolean(option), namedPlace: text(option?.namedPlace), customNote: text(option?.customNote) }];
    }),
  ) as DeliveryState;
  return {
    title: isNew ? "" : input.title,
    description: text(input.description),
    categoryId: text(input.categoryId),
    typeId: text(input.typeId),
    formId: text(input.formId),
    origin: text(input.origin),
    legalStatus: text(input.legalStatus),
    wasteCode: text(input.wasteCode),
    quantity: text(input.quantity),
    unitKey: text(input.unitKey),
    minLot: text(input.minLot),
    frequency: text(input.frequency),
    recurrencePeriod: text(input.recurrencePeriod),
    recurrenceQuantity: text(input.recurrenceQuantity),
    availableFrom: text(input.availableFrom),
    collectionUntil: text(input.collectionUntil),
    validityDays: text(input.validityDays),
    priceMode: text(input.priceMode),
    priceAmount: text(input.priceAmount),
    priceUnitKey: text(input.priceUnitKey),
    vatBasis: input.vatBasis,
    delivery,
    deliveryPricing: text(input.deliveryPricing),
    maxDeliveryDistanceKm: text(input.maxDeliveryDistanceKm),
    packaging: text(input.packaging),
    loadingEquipment: text(input.loadingEquipment),
    evidenceStatus: text(input.evidenceStatus),
    datasheetAvailable: input.datasheetAvailable,
    datasheetAccess: input.datasheetAccess,
    photosAvailable: input.photosAvailable,
    sampleAvailable: input.sampleAvailable,
    attributes: Object.fromEntries(
      Object.entries(input.attributes).map(([key, value]) => [
        key,
        { min: text(value.valueMin), max: text(value.valueMax), comparator: text(value.comparator), text: text(value.valueText) },
      ]),
    ),
  };
}

/** "1.234,5" is not guessed at: a decimal comma or point, nothing else. Empty → null, not a number → NaN. */
export function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return /^-?\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(",", ".")) : Number.NaN;
}

/** Definitions that apply to the chosen category and form. */
export function attributesOf(state: FormState, catalogue: Catalogue): AttributeDefinition[] {
  const form = catalogue.forms.find((candidate) => String(candidate.id) === state.formId);
  return applicableAttributes(catalogue.attributes, state.categoryId ? Number(state.categoryId) : null, form?.key ?? null);
}

/**
 * The body for the API, built from what the inputs hold, plus the problems found while converting (text where a
 * number belongs). Values of attributes that do not apply to the chosen form are left out.
 */
export function toBody(state: FormState, catalogue: Catalogue): { body: Record<string, unknown>; problems: FieldProblem[] } {
  const problems: FieldProblem[] = [];
  const number = (field: string, value: string): number | null => {
    const parsed = parseDecimal(value);
    if (Number.isNaN(parsed)) {
      problems.push({ field, code: "INVALID_NUMBER" });
      return null;
    }
    return parsed;
  };
  const id = (value: string) => (value === "" ? null : Number(value));
  const withAmount = state.priceMode !== "" && amountRule(state.priceMode as PriceMode) !== "none";
  const recurring = state.frequency === "recurring";

  const attributes: Record<string, unknown> = {};
  for (const definition of attributesOf(state, catalogue)) {
    const entry = state.attributes[definition.key] ?? emptyAttribute;
    const numeric = definition.dataType === "number" || definition.dataType === "range" || definition.dataType === "integer";
    const valueMin = numeric ? number(`attributes.${definition.key}`, entry.min) : null;
    const valueMax = definition.dataType === "range" ? number(`attributes.${definition.key}`, entry.max) : null;
    const valueText = numeric ? null : entry.text.trim() || null;
    if (valueMin == null && valueMax == null && valueText == null) continue; // unknown: not sent, not stored
    attributes[definition.key] = {
      // a range with only an upper bound is "up to": stored as that one value
      valueMin: valueMin ?? valueMax,
      valueMax: valueMin == null ? null : valueMax,
      comparator: definition.dataType === "number" && entry.comparator ? entry.comparator : null,
      valueText,
    };
  }

  const body = {
    title: state.title,
    description: state.description,
    categoryId: id(state.categoryId),
    typeId: id(state.typeId),
    formId: id(state.formId),
    origin: state.origin,
    legalStatus: state.legalStatus,
    wasteCode: state.wasteCode,
    quantity: number("quantity", state.quantity),
    unitKey: state.unitKey,
    minLot: number("minLot", state.minLot),
    frequency: state.frequency,
    recurrencePeriod: recurring ? state.recurrencePeriod : null,
    recurrenceQuantity: recurring ? number("recurrenceQuantity", state.recurrenceQuantity) : null,
    availableFrom: state.availableFrom,
    collectionUntil: state.collectionUntil,
    validityDays: number("validityDays", state.validityDays) ?? undefined,
    priceMode: state.priceMode,
    priceAmount: withAmount ? number("priceAmount", state.priceAmount) : null,
    priceUnitKey: withAmount ? state.priceUnitKey : null,
    vatBasis: state.vatBasis,
    deliveryOptions: DELIVERY_TERMS.filter((term) => state.delivery[term].on).map((term) => ({
      term,
      namedPlace: term === "custom" ? null : state.delivery[term].namedPlace,
      customNote: term === "custom" ? state.delivery[term].customNote : null,
    })),
    deliveryPricing: state.deliveryPricing,
    maxDeliveryDistanceKm: number("maxDeliveryDistanceKm", state.maxDeliveryDistanceKm),
    packaging: state.packaging,
    loadingEquipment: state.loadingEquipment,
    evidenceStatus: state.evidenceStatus,
    datasheetAvailable: state.datasheetAvailable,
    datasheetAccess: state.datasheetAccess,
    photosAvailable: state.photosAvailable,
    sampleAvailable: state.sampleAvailable,
    attributes,
  };
  return { body, problems };
}

/**
 * Checks the form in the browser with the same schema and rules as the server (which checks again):
 * returns the body to send, or the problems per field. Field names match the ones the server reports.
 */
export function checkForm(
  state: FormState,
  catalogue: Catalogue,
  mode: PublishMode,
  today: string,
): { ok: true; body: Record<string, unknown> } | { ok: false; problems: FieldProblem[] } {
  const { body, problems } = toBody(state, catalogue);
  if (problems.length > 0) return { ok: false, problems };
  const parsed = offerInput.safeParse(body);
  if (!parsed.success) {
    const terms = (body.deliveryOptions as { term: string }[]).map((option) => option.term);
    const byField = new Map<string, string>();
    for (const issue of parsed.error.issues) {
      const [first, second, third] = issue.path.map(String);
      // "deliveryOptions.0.namedPlace" → "deliveryOptions.fca.namedPlace"; "attributes.grade.valueText" → "attributes.grade"
      const field =
        first === "deliveryOptions" && second !== undefined
          ? ["deliveryOptions", terms[Number(second)] ?? second, third].filter(Boolean).join(".")
          : first === "attributes"
            ? `attributes.${second}`
            : first;
      const isText = "origin" in issue && issue.origin === "string";
      const code = isText && issue.code === "too_small" ? "REQUIRED" : isText && issue.code === "too_big" ? "TOO_LONG" : "INVALID";
      if (!byField.has(field)) byField.set(field, code); // one sentence per field: the first problem
    }
    return { ok: false, problems: [...byField].map(([field, code]) => ({ field, code })) };
  }
  const rules = offerProblems(parsed.data, catalogue, mode, today);
  return rules.length > 0 ? { ok: false, problems: rules } : { ok: true, body };
}
