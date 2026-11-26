import { describe, expect, it } from "vitest";
import {
  COOPERATION_STATUSES,
  OFFER_STATUSES,
  VERIFICATION_STATUSES,
  canTransition,
  cooperationFlow,
  effectiveOfferStatus,
  expiryDate,
  isDiscoverable,
  isFinal,
  offerFlow,
  verificationFlow,
} from "./status";

describe("cooperationFlow", () => {
  it("main path Requested → Completed is allowed", () => {
    const path = ["requested", "negotiation", "agreed", "in_progress", "completed"] as const;
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(cooperationFlow, path[i - 1], path[i])).toBe(true);
    }
  });

  it("going backwards and skipping past Agreed are forbidden", () => {
    expect(canTransition(cooperationFlow, "agreed", "negotiation")).toBe(false);
    expect(canTransition(cooperationFlow, "requested", "in_progress")).toBe(false);
    expect(canTransition(cooperationFlow, "negotiation", "completed")).toBe(false);
  });

  it("reject only before agreement, cancel until completion", () => {
    expect(canTransition(cooperationFlow, "negotiation", "rejected")).toBe(true);
    expect(canTransition(cooperationFlow, "agreed", "rejected")).toBe(false);
    expect(canTransition(cooperationFlow, "in_progress", "cancelled")).toBe(true);
    expect(canTransition(cooperationFlow, "completed", "cancelled")).toBe(false);
  });

  it("Endstatus: completed, rejected, cancelled", () => {
    const finals = COOPERATION_STATUSES.filter((s) => isFinal(cooperationFlow, s));
    expect(finals).toEqual(["completed", "rejected", "cancelled"]);
  });

  it("every target status is a known status", () => {
    for (const targets of Object.values(cooperationFlow)) {
      for (const t of targets) expect(COOPERATION_STATUSES).toContain(t);
    }
  });

  it("status values fit into a status column (varchar 20)", () => {
    for (const s of COOPERATION_STATUSES) expect(s.length).toBeLessThanOrEqual(20);
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
