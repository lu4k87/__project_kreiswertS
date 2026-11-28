import { describe, expect, it } from "vitest";
import { negotiationProgress } from "./progress";

const states = (...args: Parameters<typeof negotiationProgress>) => negotiationProgress(...args).map((step) => step.state);

describe("negotiationProgress", () => {
  it("open: the negotiation is where the trade stands", () => {
    expect(states("open", null, null)).toEqual(["done", "now", "later", "later", "later"]);
  });

  it("agreed without contract or exchange: the contract is next", () => {
    expect(states("agreed", null, null)).toEqual(["done", "done", "done", "now", "later"]);
  });

  it("agreed with a planned exchange but no contract: the exchange is now, the contract stays open", () => {
    expect(states("agreed", null, "planned")).toEqual(["done", "done", "done", "later", "now"]);
  });

  it("contract awaiting signatures is now", () => {
    expect(states("agreed", "awaiting_signatures", null)).toEqual(["done", "done", "done", "now", "later"]);
  });

  it("signed contract and completed exchange: everything done", () => {
    expect(states("agreed", "signed", "completed")).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("declined, withdrawn or expired: stopped at the negotiation", () => {
    for (const status of ["declined", "withdrawn", "expired"] as const) expect(states(status, null, null)).toEqual(["done", "ended", "later", "later", "later"]);
  });
});
