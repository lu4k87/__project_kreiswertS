// The five stations of a trade for the progress bar on the negotiation page (decision of 2026-11-28, preview Stand:A):
// proposal → negotiation → agreed → contract → exchange. Pure, so the rule is tested without a page.
import type { ContractStatus } from "@/server/domain/contract";
import type { ExchangeStatus, NegotiationDisplayStatus } from "@/server/domain/negotiation";

export type Station = "proposal" | "negotiation" | "agreed" | "contract" | "exchange";
/** done = passed · now = where the trade stands (the viewer or the other site acts) · ended = stopped here · later = not reached. */
export type StationState = "done" | "now" | "ended" | "later";

export function negotiationProgress(status: NegotiationDisplayStatus, contract: ContractStatus | null, exchange: ExchangeStatus | null): { station: Station; state: StationState }[] {
  const done: Record<Station, boolean> = {
    proposal: true,
    negotiation: status === "agreed",
    agreed: status === "agreed",
    contract: contract === "signed",
    exchange: exchange === "completed",
  };
  const order: Station[] = ["proposal", "negotiation", "agreed", "contract", "exchange"];
  // declined, withdrawn or expired: the negotiation itself is where it stopped, nothing follows
  if (status !== "open" && status !== "agreed") {
    return order.map((station) => ({ station, state: station === "proposal" ? "done" : station === "negotiation" ? "ended" : "later" }));
  }
  if (exchange === "cancelled") done.exchange = false;
  // a planned exchange or an unsigned contract is "now", even if an earlier optional station was skipped
  const now: Station | undefined =
    status === "open" ? "negotiation" : exchange === "planned" ? "exchange" : contract === "awaiting_signatures" ? "contract" : order.find((station) => !done[station]);
  return order.map((station) => ({ station, state: station === now ? "now" : done[station] ? "done" : "later" }));
}
