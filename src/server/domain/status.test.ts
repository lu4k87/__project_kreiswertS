import { describe, expect, it } from "vitest";
import { COOPERATION_STATUSES, canTransition, cooperationFlow, isFinal } from "./status";

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

  it("status values fit into agreements.status (varchar 20)", () => {
    for (const s of COOPERATION_STATUSES) expect(s.length).toBeLessThanOrEqual(20);
  });
});
