// Sentences for refusals of the assessment routes: their own codes first, then the shared texts.
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, fieldErrorText, type ApiFailure } from "@/lib/api-client";

export function assessmentErrorText(error: ApiFailure, t: PlatformMessages): string {
  if (error.fields.length > 0) return t.errors.summary;
  return (error.reason && t.assessmentLabels.errors[error.reason]) || apiErrorText(error, t.errors);
}

/** Field problems by field name; the body nests the inputs (`inputs.priceAmount`), the forms name them flat. */
export function assessmentFieldErrors(error: ApiFailure, t: PlatformMessages): Record<string, string> {
  const map: Record<string, string> = {};
  for (const problem of error.fields) {
    const field = problem.field.replace(/^inputs\./, "");
    map[field] ??= t.assessmentLabels.errors[problem.code] ?? fieldErrorText(problem.code, t.errors);
  }
  return map;
}
