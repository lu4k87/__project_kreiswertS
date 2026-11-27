import { describe, expect, it } from "vitest";
import {
  OFFER_STATUSES,
  VERIFICATION_STATUSES,
  canTransition,
  effectiveOfferStatus,
  exchangeFlow,
  expiryDate,
  isDiscoverable,
  isFinal,
  negotiationFlow,
  offerFlow,
  verificationFlow,
} from "./status";
import { EXCHANGE_STATUSES, NEGOTIATION_STATUSES } from "./negotiation";

describe("negotiationFlow and exchangeFlow", () => {
  it("an open negotiation ends agreed, declined or withdrawn – and nothing follows an agreement (D16)", () => {
    for (const to of ["agreed", "declined", "withdrawn"] as const) expect(canTransition(negotiationFlow, "open", to)).toBe(true);
    expect(canTransition(negotiationFlow, "agreed", "open")).toBe(false);
    expect(NEGOTIATION_STATUSES.filter((s) => isFinal(negotiationFlow, s))).toEqual(["agreed", "declined", "withdrawn"]);
  });

  it("an exchange goes from planned to completed or cancelled, never back", () => {
    expect(canTransition(exchangeFlow, "planned", "completed")).toBe(true);
    expect(canTransition(exchangeFlow, "planned", "cancelled")).toBe(true);
    expect(canTransition(exchangeFlow, "cancelled", "completed")).toBe(false);
    expect(EXCHANGE_STATUSES.filter((s) => isFinal(exchangeFlow, s))).toEqual(["completed", "cancelled"]);
  });
});

describe("offer lifecycle (D05)", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const past = new Date("2026-11-25T12:00:00Z");
  const future = new Date("2026-12-26T12:00:00Z");

  it("draft → active → closed; closed is final", () => {
    expect(canTransition(offerFlow, "draft", "active")).toBe(true);
    expect(canTransition(offerFlow, "active", "closed")).toBe(true);
    expect(canTransition(offerFlow, "draft", "closed")).toBe(false);
    expect(isFinal(offerFlow, "closed")).toBe(true);
  });

  it("AT-L1-007: after the expiry date an active offer counts as expired and leaves discovery", () => {
    expect(effectiveOfferStatus("active", future, now)).toBe("active");
    expect(effectiveOfferStatus("active", past, now)).toBe("expired");
    expect(isDiscoverable("active", past, now)).toBe(false);
    expect(isDiscoverable("active", future, now)).toBe(true);
  });

  it("the moment of expiry itself already counts as expired", () => {
    expect(effectiveOfferStatus("active", now, now)).toBe("expired");
  });

  it("drafts and closed offers are never discoverable, whatever the date", () => {
    expect(isDiscoverable("draft", future, now)).toBe(false);
    expect(isDiscoverable("closed", future, now)).toBe(false);
    expect(effectiveOfferStatus("closed", past, now)).toBe("closed");
  });

  it("an expired offer can be renewed or closed", () => {
    expect(offerFlow.expired).toEqual(["active", "closed"]);
  });

  it("expiry date = start + validity in days", () => {
    expect(expiryDate(30, now).toISOString()).toBe("2026-12-26T12:00:00.000Z");
  });

  it("stored statuses fit into offers.status (varchar 20)", () => {
    for (const status of OFFER_STATUSES) expect(status.length).toBeLessThanOrEqual(20);
  });
});

describe("site verification (D03)", () => {
  it("pending can be verified or declined, and a decision can be revised", () => {
    expect(canTransition(verificationFlow, "pending", "verified")).toBe(true);
    expect(canTransition(verificationFlow, "pending", "declined")).toBe(true);
    expect(canTransition(verificationFlow, "verified", "declined")).toBe(true);
    expect(canTransition(verificationFlow, "declined", "verified")).toBe(true);
  });

  it("every target status is a known status", () => {
    for (const targets of Object.values(verificationFlow)) {
      for (const target of targets) expect(VERIFICATION_STATUSES).toContain(target);
    }
  });
});
