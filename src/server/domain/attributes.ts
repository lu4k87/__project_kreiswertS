// Technical attributes of an offer (L1-006): which definitions apply to a form, whether entered values are valid,
// which critical values are unknown, and how a value is written. Pure → server validation and browser form share it.
import type { AttributeDefinition } from "./catalogue";
import type { Comparator } from "./listing";

/** Entered value of one attribute. Every field null = unknown (the attribute is then not stored at all). */
export type AttributeValue = {
  /** number / integer: the value · range: lower bound */
  valueMin: number | null;
  /** range: upper bound */
  valueMax: number | null;
  /** number only: null means "equals" */
  comparator: Comparator | null;
  /** text and enum */
  valueText: string | null;
};

export type AttributeValues = Record<string, AttributeValue>;

export type FieldProblem = { field: string; code: string };

export const MAX_ATTRIBUTE_TEXT = 300;

/** Definitions of a category that apply to the chosen form, in their configured order. */
export function applicableAttributes(
  definitions: readonly AttributeDefinition[],
  categoryId: number | null,
  formKey: string | null,
): AttributeDefinition[] {
  if (categoryId == null || formKey == null) return [];
  return definitions.filter(
    (definition) => definition.categoryId === categoryId && (definition.forms.length === 0 || definition.forms.includes(formKey)),
  );
}

/** Unknown: nothing entered. An explicit 0 is a value. */
export function isUnknown(value: AttributeValue | undefined): boolean {
  if (!value) return true;
  return value.valueMin == null && value.valueMax == null && (value.valueText == null || value.valueText.trim() === "");
}

/** Values that would be dropped when the form changes – the UI asks before removing them. */
export function incompatibleKeys(applicable: readonly AttributeDefinition[], values: AttributeValues): string[] {
  const allowed = new Set(applicable.map((definition) => definition.key));
  return Object.keys(values).filter((key) => !allowed.has(key) && !isUnknown(values[key]));
}

function withinLimits(definition: AttributeDefinition, value: number): boolean {
  if (definition.minValue != null && value < definition.minValue) return false;
  return definition.maxValue == null || value <= definition.maxValue;
}

function valueProblem(definition: AttributeDefinition, value: AttributeValue): string | null {
  const { dataType } = definition;
  if (dataType === "text" || dataType === "enum") {
    if (value.valueMin != null || value.valueMax != null || value.comparator != null) return "INVALID";
    const text = value.valueText ?? "";
    if (text.length > MAX_ATTRIBUTE_TEXT) return "TOO_LONG";
    if (dataType === "enum" && !definition.options.some((option) => option.value === text)) return "INVALID_OPTION";
    return null;
  }
  if (value.valueText != null && value.valueText !== "") return "INVALID";
  if (value.valueMin == null) return "INVALID"; // an upper bound alone is not a value
  if (!Number.isFinite(value.valueMin) || (value.valueMax != null && !Number.isFinite(value.valueMax))) return "INVALID";
  if (dataType !== "range" && value.valueMax != null) return "INVALID";
  if (dataType !== "number" && value.comparator != null) return "INVALID";
  if (dataType === "integer" && !Number.isInteger(value.valueMin)) return "NOT_INTEGER";
  if (value.valueMax != null && value.valueMax < value.valueMin) return "RANGE_ORDER";
  if (!withinLimits(definition, value.valueMin) || (value.valueMax != null && !withinLimits(definition, value.valueMax))) {
    return "OUT_OF_RANGE";
  }
  return null;
}

/**
 * Problems of the entered attribute values. Present values must always be valid and applicable to the form;
 * `complete` additionally demands required attributes (publishing).
 */
export function attributeProblems(
  applicable: readonly AttributeDefinition[],
  values: AttributeValues,
  complete: boolean,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const byKey = new Map(applicable.map((definition) => [definition.key, definition]));
  for (const [key, value] of Object.entries(values)) {
    if (isUnknown(value)) continue;
    const definition = byKey.get(key);
    const code = definition ? valueProblem(definition, value) : "NOT_APPLICABLE";
    if (code) problems.push({ field: `attributes.${key}`, code });
  }
  for (const definition of applicable) {
    if (!isUnknown(values[definition.key])) continue;
    // Test conditions belong to the measured value even in a draft: without them the number cannot be compared.
    const neededBy = definition.requiredWith;
    if (neededBy && !isUnknown(values[neededBy])) problems.push({ field: `attributes.${definition.key}`, code: "REQUIRED_WITH" });
    else if (complete && definition.required) problems.push({ field: `attributes.${definition.key}`, code: "REQUIRED" });
  }
  return problems;
}

/** Critical attributes without a value – shown as "unknown" instead of being hidden (missing grade, missing MFR). */
export function criticalUnknowns(applicable: readonly AttributeDefinition[], values: AttributeValues): AttributeDefinition[] {
  return applicable.filter((definition) => definition.critical && isUnknown(values[definition.key]));
}

const COMPARATOR_SIGN: Record<Comparator, string> = { lt: "<", lte: "≤", gte: "≥", gt: ">" };

/** "3–6 mm", "< 1 %", "0.8 g/10 min", the enum label or the text. Number and unit stay together (no-break space). */
export function formatAttributeValue(definition: AttributeDefinition, value: AttributeValue, locale: "de" | "en"): string {
  if (definition.dataType === "enum") {
    const option = definition.options.find((candidate) => candidate.value === value.valueText);
    return option ? option[locale] : (value.valueText ?? "");
  }
  if (definition.dataType === "text") return value.valueText ?? "";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  // "g/10 min" has a space of its own: it must not break either
  const unit = definition.unit ? `\u00a0${definition.unit.replaceAll(" ", "\u00a0")}` : "";
  if (value.valueMin == null) return "";
  if (value.valueMax != null && value.valueMax !== value.valueMin) {
    return `${number.format(value.valueMin)}–${number.format(value.valueMax)}${unit}`;
  }
  const sign = value.comparator ? `${COMPARATOR_SIGN[value.comparator]}\u00a0` : "";
  return `${sign}${number.format(value.valueMin)}${unit}`;
}
