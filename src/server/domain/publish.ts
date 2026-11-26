// Business rules of an offer (L1-005 … L1-010, X-02): what must be valid whenever it is saved, and what must be
// complete before it may be published. Needs the catalogue, no database → pure, tested, and shared with the form
// so the browser shows the same problems the server would report.
import { applicableAttributes, attributeProblems, type AttributeValues, type FieldProblem } from "./attributes";
import type { Catalogue } from "./catalogue";
import { isFormalTerm, deliveryMode } from "./delivery";
import type { DeliveryTerm, Frequency, PriceMode } from "./listing";
import { amountRule } from "./price";

/** The fields the rules look at – the validated body (src/server/validation/offers.ts) fits this shape. */
export type OfferFields = {
  title: string;
  description: string | null;
  categoryId: number | null;
  typeId: number | null;
  formId: number | null;
  origin: string | null;
  legalStatus: string | null;
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: Frequency | null;
  recurrencePeriod: string | null;
  availableFrom: string | null;
  collectionUntil: string | null;
  priceMode: PriceMode | null;
  priceAmount: number | null;
  priceUnitKey: string | null;
  deliveryOptions: { term: DeliveryTerm; namedPlace: string | null; customNote: string | null }[];
  deliveryPricing: string | null;
  evidenceStatus: string | null;
  attributes: AttributeValues;
};

export type PublishMode = "draft" | "publish";

/**
 * Problems of an offer as `{ field, code }`. Mode "draft": only what is entered must be valid (catalogue
 * combination, permitted unit, attribute values). Mode "publish": additionally everything a listing needs.
 * `today` (YYYY-MM-DD) is passed in so the function stays pure.
 */
export function offerProblems(offer: OfferFields, catalogue: Catalogue, mode: PublishMode, today: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, code: string) => problems.push({ field, code });
  const complete = mode === "publish";
  const required = (field: keyof OfferFields) => {
    const value = offer[field];
    if (complete && (value == null || value === "")) add(field, "REQUIRED");
  };

  required("description");

  // Material: category enabled, type and form belong to it (L1-005, L1-006).
  const category = catalogue.categories.find((candidate) => candidate.id === offer.categoryId) ?? null;
  const type = catalogue.types.find((candidate) => candidate.id === offer.typeId) ?? null;
  const form = catalogue.forms.find((candidate) => candidate.id === offer.formId) ?? null;
  required("categoryId");
  required("typeId");
  required("formId");
  if (offer.categoryId != null && !category) add("categoryId", "INVALID");
  // A disabled category blocks publishing, not drafting: an administrator may prepare it before enabling.
  if (category && !category.enabled && complete) add("categoryId", "CATEGORY_DISABLED");
  if (offer.typeId != null && (!type || type.categoryId !== offer.categoryId)) add("typeId", "INVALID_COMBINATION");
  if (offer.formId != null && (!form || form.categoryId !== offer.categoryId)) add("formId", "INVALID_COMBINATION");

  required("origin");
  required("legalStatus");

  // Quantity and availability (L1-007): one unit for stock, minimum lot and expected output.
  required("quantity");
  required("unitKey");
  const unitKnown = offer.unitKey == null || catalogue.units.some((unit) => unit.key === offer.unitKey);
  if (!unitKnown) add("unitKey", "INVALID");
  else if (offer.unitKey != null && category && !category.unitKeys.includes(offer.unitKey)) add("unitKey", "UNIT_NOT_PERMITTED");
  if (offer.minLot != null && offer.quantity != null && offer.minLot > offer.quantity) add("minLot", "MIN_LOT_EXCEEDS_STOCK");
  required("frequency");
  if (offer.frequency === "recurring" && offer.recurrencePeriod == null && complete) add("recurrencePeriod", "REQUIRED");
  required("availableFrom");
  if (offer.availableFrom && offer.collectionUntil && offer.collectionUntil < offer.availableFrom) add("collectionUntil", "DATE_ORDER");
  else if (complete && offer.collectionUntil && offer.collectionUntil < today) add("collectionUntil", "DATE_PAST");

  // Price (L1-008): the mode decides whether an amount is needed; an amount always needs a permitted unit.
  required("priceMode");
  if (offer.priceMode) {
    const rule = amountRule(offer.priceMode);
    const hasAmount = rule !== "none" && offer.priceAmount != null;
    if (rule === "required" && offer.priceAmount == null && complete) add("priceAmount", "REQUIRED");
    if (hasAmount && offer.priceAmount! <= 0) add("priceAmount", "POSITIVE");
    if (hasAmount && offer.priceUnitKey == null && complete) add("priceUnitKey", "REQUIRED");
    if (hasAmount && offer.priceUnitKey != null && category && !category.unitKeys.includes(offer.priceUnitKey)) {
      add("priceUnitKey", "UNIT_NOT_PERMITTED");
    }
  }

  // Delivery (L1-009): at least one arrangement; formal terms name a place, a custom one is described.
  if (complete && offer.deliveryOptions.length === 0) add("deliveryOptions", "REQUIRED");
  for (const option of offer.deliveryOptions) {
    if (!complete) continue;
    if (isFormalTerm(option.term) && !option.namedPlace) add(`deliveryOptions.${option.term}.namedPlace`, "NAMED_PLACE_REQUIRED");
    if (!isFormalTerm(option.term) && !option.customNote) add("deliveryOptions.custom.customNote", "REQUIRED");
  }
  const delivers = offer.deliveryOptions.some((option) => deliveryMode(option.term) === "delivered");
  if (complete && delivers && offer.deliveryPricing == null) add("deliveryPricing", "REQUIRED");

  required("evidenceStatus");

  problems.push(...attributeProblems(applicableAttributes(catalogue.attributes, offer.categoryId, form?.key ?? null), offer.attributes, complete));
  return problems;
}
