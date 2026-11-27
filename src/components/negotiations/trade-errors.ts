// Sentences for refusals of the negotiation and exchange routes: their own reasons first, then the shared texts.
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, fieldErrorText, type ApiFailure } from "@/lib/api-client";

type TradeError = keyof PlatformMessages["tradeErrors"];

export function tradeErrorText(error: ApiFailure, t: PlatformMessages): string {
  // STALE of the shared texts speaks of an offer – here something in the negotiation or exchange changed
  const reason = error.reason === "STALE" ? "STALE_NEGOTIATION" : error.reason;
  return (reason && t.tradeErrors[reason as TradeError]) || apiErrorText(error, t.errors);
}

/** Field problems by field name; the body nests the terms (`terms.priceAmount`), the form names them flat. */
export function tradeFieldErrors(error: ApiFailure, t: PlatformMessages): Record<string, string> {
  const map: Record<string, string> = {};
  for (const problem of error.fields) {
    const field = problem.field.replace(/^terms\./, "");
    map[field] ??= t.tradeErrors[problem.code as TradeError] ?? fieldErrorText(problem.code, t.errors);
  }
  return map;
}
