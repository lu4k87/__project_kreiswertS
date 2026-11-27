// Sentences for refusals of the contract, payment and chain-consent routes: their own reasons first, then the
// texts of the negotiation and exchange routes.
import type { PlatformMessages } from "@/i18n/platform";
import type { ApiFailure } from "@/lib/api-client";
import { tradeErrorText } from "@/components/negotiations/trade-errors";

export function contractErrorText(error: ApiFailure, t: PlatformMessages): string {
  return (error.reason && t.contractLabels.contractErrors[error.reason]) || tradeErrorText(error, t);
}

export const contractPath = (id: number) => `/contracts/${id}`;
