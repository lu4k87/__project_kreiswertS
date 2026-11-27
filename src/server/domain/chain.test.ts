import { describe, expect, it } from "vitest";
import { combinedChainBenefit, consentValid } from "./chain";

describe("combined chain benefit", () => {
  it("adds both contributions; the internal payment has already cancelled out", () => {
    // offerer: €160 proceeds + €100 avoided disposal = 260; requester: €300 virgin material − €240 delivered = 60
    expect(combinedChainBenefit({ contribution: 260, status: "confirmed" }, { contribution: 60, status: "quoted" })).toEqual({ total: 320, status: "quoted", unknown: [] });
  });
  it("a negative contribution reduces the total", () => {
    expect(combinedChainBenefit({ contribution: -50.5, status: "estimated" }, { contribution: 20.25, status: "confirmed" }).total).toBe(-30.25);
  });
  it("unknown on either side gives no total – never 0", () => {
    expect(combinedChainBenefit({ contribution: null, status: null }, { contribution: 60, status: "quoted" })).toEqual({ total: null, status: "quoted", unknown: ["offerer"] });
  });
});

describe("consent", () => {
  const consent = { assessmentRevision: 3, termsRevision: 2 };
  it("covers exactly the saved assessment and proposal it was given for", () => {
    expect(consentValid(consent, { assessmentRevision: 3, termsRevision: 2 })).toBe(true);
  });
  it("ends with a new save, a counterproposal or a missing assessment", () => {
    expect(consentValid(consent, { assessmentRevision: 4, termsRevision: 2 })).toBe(false);
    expect(consentValid(consent, { assessmentRevision: 3, termsRevision: 3 })).toBe(false);
    expect(consentValid(consent, { assessmentRevision: null, termsRevision: 2 })).toBe(false);
    expect(consentValid(null, { assessmentRevision: 3, termsRevision: 2 })).toBe(false);
  });
});
