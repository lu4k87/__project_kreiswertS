// Business rules of a material request (L2-001, L2-004, X-02): what must be valid whenever it is saved, and what must
// be complete before it may be published. Needs the catalogue, no database → pure, tested, and shared with the
// request form so the browser shows the same problems the server would report.
import { MAX_ATTRIBUTE_TEXT, type FieldProblem } from "./attributes";
import type { AttributeDefinition, Catalogue } from "./catalogue";
import type { CriterionKind, DeliveryTerm, EvidenceStatus, Frequency, Origin } from "./listing";

/** One technical criterion: numbers as an accepted range (either bound may be open), enum and text as a value. */
export type CriterionValue = {
  kind: CriterionKind;
  valueMin: number | null;
  valueMax: number | null;
  valueText: string | null;
};

export type Criteria = Record<string, CriterionValue>;

/** The fields the rules look at – the validated body (src/server/validation/requests.ts) fits this shape. */
export type RequestFields = {
  title: string;
  description: string | null;
  categoryId: number | null;
  /** Accepted material types; publishing needs at least one. */
  typeIds: number[];
  /** Accepted forms; publishing needs at least one. */
  formIds: number[];
  /** Accepted origins; empty = any origin. */
  origins: Origin[];
  quantity: number | null;
  unitKey: string | null;
  /** Smallest batch the requester still accepts, in the request's unit; empty = the full quantity. */
  minLot: number | null;
  frequency: Frequency | null;
  recurrencePeriod: string | null;
  neededFrom: string | null;
  neededUntil: string | null;
  /** Highest acceptable price per `maxPriceUnitKey`; a preference, never a hard requirement. */
  maxPriceAmount: number | null;
  maxPriceUnitKey: string | null;
  /** Preferred delivery arrangements; empty = no preference. */
  deliveryTerms: DeliveryTerm[];
  /** Minimum evidence the requester needs; null = any. */
  evidenceStatus: Exclude<EvidenceStatus, "unknown"> | null;
  sampleRequired: boolean;
  criteria: Criteria;
};

export type PublishMode = "draft" | "publish";

/**
 * Attribute definitions a request can set criteria for: those of the category that apply to at least one accepted
 * form. Without a chosen form only the attributes of every form are offered.
 */
export function criteriaDefinitions(definitions: readonly AttributeDefinition[], categoryId: number | null, formKeys: readonly string[]): AttributeDefinition[] {
  if (categoryId == null) return [];
  return definitions.filter(
    (definition) =>
      definition.categoryId === categoryId &&
      // test conditions belong to a measured value of an offer; a request states the range it accepts instead
      definition.requiredWith == null &&
      (definition.forms.length === 0 || definition.forms.some((form) => formKeys.includes(form))),
  );
}

function withinLimits(definition: AttributeDefinition, value: number): boolean {
  if (definition.minValue != null && value < definition.minValue) return false;
  return definition.maxValue == null || value <= definition.maxValue;
}

/** Problem code of one criterion, or null. A criterion is never "unknown": an empty one is simply not sent. */
export function criterionProblem(definition: AttributeDefinition, value: CriterionValue): string | null {
  const { dataType } = definition;
  if (dataType === "text" || dataType === "enum") {
    if (value.valueMin != null || value.valueMax != null) return "INVALID";
    const text = value.valueText?.trim() ?? "";
    if (text === "") return "REQUIRED";
    if (text.length > MAX_ATTRIBUTE_TEXT) return "TOO_LONG";
    if (dataType === "enum" && !definition.options.some((option) => option.value === text)) return "INVALID_OPTION";
    return null;
  }
  if (value.valueText != null && value.valueText !== "") return "INVALID";
  if (value.valueMin == null && value.valueMax == null) return "REQUIRED";
  for (const bound of [value.valueMin, value.valueMax]) {
    if (bound == null) continue;
    if (!Number.isFinite(bound)) return "INVALID";
    if (dataType === "integer" && !Number.isInteger(bound)) return "NOT_INTEGER";
    if (!withinLimits(definition, bound)) return "OUT_OF_RANGE";
  }
  if (value.valueMin != null && value.valueMax != null && value.valueMax < value.valueMin) return "RANGE_ORDER";
  return null;
}

/**
 * Problems of a request as `{ field, code }`. Mode "draft": only what is entered must be valid. Mode "publish":
 * additionally everything a published request needs. `today` (YYYY-MM-DD) is passed in so the function stays pure.
 */
export function requestProblems(request: RequestFields, catalogue: Catalogue, mode: PublishMode, today: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, code: string) => problems.push({ field, code });
  const complete = mode === "publish";
  const required = (field: keyof RequestFields) => {
    const value = request[field];
    if (complete && (value == null || value === "")) add(field, "REQUIRED");
  };

  required("description");

  // Material: category enabled, every accepted type and form belongs to it (L2-001, D04).
  const category = catalogue.categories.find((candidate) => candidate.id === request.categoryId) ?? null;
  required("categoryId");
  if (request.categoryId != null && !category) add("categoryId", "INVALID");
  if (category && !category.enabled && complete) add("categoryId", "CATEGORY_DISABLED");
  const types = request.typeIds.map((id) => catalogue.types.find((candidate) => candidate.id === id));
  const forms = request.formIds.map((id) => catalogue.forms.find((candidate) => candidate.id === id));
  if (types.some((type) => !type || type.categoryId !== request.categoryId)) add("typeIds", "INVALID_COMBINATION");
  else if (complete && types.length === 0) add("typeIds", "REQUIRED");
  if (forms.some((form) => !form || form.categoryId !== request.categoryId)) add("formIds", "INVALID_COMBINATION");
  else if (complete && forms.length === 0) add("formIds", "REQUIRED");

  // Quantity and timing: one unit for the need and the smallest accepted batch.
  required("quantity");
  required("unitKey");
  const unitKnown = request.unitKey == null || catalogue.units.some((unit) => unit.key === request.unitKey);
  if (!unitKnown) add("unitKey", "INVALID");
  else if (request.unitKey != null && category && !category.unitKeys.includes(request.unitKey)) add("unitKey", "UNIT_NOT_PERMITTED");
  if (request.minLot != null && request.quantity != null && request.minLot > request.quantity) add("minLot", "MIN_LOT_EXCEEDS_NEED");
  required("frequency");
  if (request.frequency === "recurring" && request.recurrencePeriod == null && complete) add("recurrencePeriod", "REQUIRED");
  if (request.neededFrom && request.neededUntil && request.neededUntil < request.neededFrom) add("neededUntil", "DATE_ORDER");
  else if (complete && request.neededUntil && request.neededUntil < today) add("neededUntil", "DATE_PAST");

  // Price ceiling (a preference): an amount needs a permitted unit.
  if (request.maxPriceAmount != null) {
    if (request.maxPriceAmount <= 0) add("maxPriceAmount", "POSITIVE");
    if (request.maxPriceUnitKey == null) add("maxPriceUnitKey", "REQUIRED");
    else if (category && !category.unitKeys.includes(request.maxPriceUnitKey)) add("maxPriceUnitKey", "UNIT_NOT_PERMITTED");
  }

  // Technical criteria: only attributes of the category that apply to an accepted form, each one valid.
  const formKeys = forms.filter((form) => form != null).map((form) => form.key);
  const allowed = new Map(criteriaDefinitions(catalogue.attributes, request.categoryId, formKeys).map((definition) => [definition.key, definition]));
  for (const [key, value] of Object.entries(request.criteria)) {
    const definition = allowed.get(key);
    const code = definition ? criterionProblem(definition, value) : "NOT_APPLICABLE";
    if (code) add(`criteria.${key}`, code);
  }
  return problems;
}
