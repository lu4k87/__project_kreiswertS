// State of the request form as the inputs hold it (text, ticked lists), and its conversion to and from the validated
// request input. Pure – no React, no server import – so conversion and browser-side checks are tested on their own.
import type { AttributeDefinition, Catalogue } from "@/server/domain/catalogue";
import { criteriaDefinitions, requestProblems, type PublishMode } from "@/server/domain/request-rules";
import { requestInput, type RequestInput } from "@/server/validation/requests";
import { parseDecimal } from "@/components/offers/offer-form-state";

export type FieldProblem = { field: string; code: string };
/** kind "" = the attribute is not used as a criterion (nothing is sent for it). */
export type CriterionState = { kind: "" | "required" | "preferred"; min: string; max: string; text: string };

export type RequestFormState = {
  title: string;
  description: string;
  categoryId: string;
  typeIds: string[];
  formIds: string[];
  origins: string[];
  quantity: string;
  unitKey: string;
  minLot: string;
  frequency: string;
  recurrencePeriod: string;
  neededFrom: string;
  neededUntil: string;
  validityDays: string;
  maxPriceAmount: string;
  maxPriceUnitKey: string;
  deliveryTerms: string[];
  evidenceStatus: string;
  sampleRequired: boolean;
  criteria: Record<string, CriterionState>;
};

const text = (value: string | number | null | undefined) => (value == null ? "" : String(value));
export const emptyCriterion: CriterionState = { kind: "", min: "", max: "", text: "" };

/** Defaults of a new request: the only enabled category preselected, one-off demand, 30 days open. */
export function newRequestInput(catalogue: Catalogue): RequestInput {
  const enabled = catalogue.categories.filter((category) => category.enabled);
  return requestInput.parse({ title: "New request", categoryId: enabled.length === 1 ? enabled[0].id : null, frequency: "one_time" });
}

export function fromInput(input: RequestInput, isNew = false): RequestFormState {
  return {
    title: isNew ? "" : input.title,
    description: text(input.description),
    categoryId: text(input.categoryId),
    typeIds: input.typeIds.map(String),
    formIds: input.formIds.map(String),
    origins: [...input.origins],
    quantity: text(input.quantity),
    unitKey: text(input.unitKey),
    minLot: text(input.minLot),
    frequency: text(input.frequency),
    recurrencePeriod: text(input.recurrencePeriod),
    neededFrom: text(input.neededFrom),
    neededUntil: text(input.neededUntil),
    validityDays: text(input.validityDays),
    maxPriceAmount: text(input.maxPriceAmount),
    maxPriceUnitKey: text(input.maxPriceUnitKey),
    deliveryTerms: [...input.deliveryTerms],
    evidenceStatus: text(input.evidenceStatus),
    sampleRequired: input.sampleRequired,
    criteria: Object.fromEntries(
      Object.entries(input.criteria).map(([key, value]) => [key, { kind: value.kind, min: text(value.valueMin), max: text(value.valueMax), text: text(value.valueText) }]),
    ),
  };
}

/** Attribute definitions the form offers criteria for: category + every accepted form. */
export function criteriaOf(state: RequestFormState, catalogue: Catalogue): AttributeDefinition[] {
  const formKeys = catalogue.forms.filter((form) => state.formIds.includes(String(form.id))).map((form) => form.key);
  return criteriaDefinitions(catalogue.attributes, state.categoryId ? Number(state.categoryId) : null, formKeys);
}

/** The body for the API plus the problems found while converting (text where a number belongs). */
export function toBody(state: RequestFormState, catalogue: Catalogue): { body: Record<string, unknown>; problems: FieldProblem[] } {
  const problems: FieldProblem[] = [];
  const number = (field: string, value: string): number | null => {
    const parsed = parseDecimal(value);
    if (Number.isNaN(parsed)) {
      problems.push({ field, code: "INVALID_NUMBER" });
      return null;
    }
    return parsed;
  };
  const criteria: Record<string, unknown> = {};
  for (const definition of criteriaOf(state, catalogue)) {
    const entry = state.criteria[definition.key];
    if (!entry || entry.kind === "") continue; // not used: not sent
    const numeric = definition.dataType === "number" || definition.dataType === "range" || definition.dataType === "integer";
    const field = `criteria.${definition.key}`;
    criteria[definition.key] = {
      kind: entry.kind,
      valueMin: numeric ? number(field, entry.min) : null,
      valueMax: numeric ? number(field, entry.max) : null,
      valueText: numeric ? null : entry.text.trim() || null,
    };
  }
  const recurring = state.frequency === "recurring";
  const body = {
    title: state.title,
    description: state.description,
    categoryId: state.categoryId === "" ? null : Number(state.categoryId),
    typeIds: state.typeIds.map(Number),
    formIds: state.formIds.map(Number),
    origins: state.origins,
    quantity: number("quantity", state.quantity),
    unitKey: state.unitKey,
    minLot: number("minLot", state.minLot),
    frequency: state.frequency,
    recurrencePeriod: recurring ? state.recurrencePeriod : null,
    neededFrom: state.neededFrom,
    neededUntil: state.neededUntil,
    validityDays: number("validityDays", state.validityDays) ?? undefined,
    maxPriceAmount: number("maxPriceAmount", state.maxPriceAmount),
    maxPriceUnitKey: state.maxPriceAmount.trim() === "" ? null : state.maxPriceUnitKey,
    deliveryTerms: state.deliveryTerms,
    evidenceStatus: state.evidenceStatus,
    sampleRequired: state.sampleRequired,
    criteria,
  };
  return { body, problems };
}

/**
 * Checks the form in the browser with the same schema and rules as the server (which checks again): the body to
 * send, or the problems per field. Field names match the ones the server reports.
 */
export function checkRequestForm(
  state: RequestFormState,
  catalogue: Catalogue,
  mode: PublishMode,
  today: string,
): { ok: true; body: Record<string, unknown> } | { ok: false; problems: FieldProblem[] } {
  const { body, problems } = toBody(state, catalogue);
  if (problems.length > 0) return { ok: false, problems };
  const parsed = requestInput.safeParse(body);
  if (!parsed.success) {
    const byField = new Map<string, string>();
    for (const issue of parsed.error.issues) {
      const [first, second] = issue.path.map(String);
      const field = first === "criteria" && second !== undefined ? `criteria.${second}` : first;
      const isText = "origin" in issue && issue.origin === "string";
      const code = isText && issue.code === "too_small" ? "REQUIRED" : isText && issue.code === "too_big" ? "TOO_LONG" : "INVALID";
      if (!byField.has(field)) byField.set(field, code);
    }
    return { ok: false, problems: [...byField].map(([field, code]) => ({ field, code })) };
  }
  const rules = requestProblems(parsed.data, catalogue, mode, today);
  return rules.length > 0 ? { ok: false, problems: rules } : { ok: true, body };
}
