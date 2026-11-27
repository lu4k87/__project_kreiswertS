import { describe, expect, it } from "vitest";
import {
  AccessError,
  canBrowse,
  isVerifiedMember,
  requireAccount,
  requireAdmin,
  requireBrowse,
  requireCurrentRevision,
  requireSite,
  requireVerifiedSite,
  siteIdOf,
  type Viewer,
  type ViewerSite,
} from "./access";

const site = (status: ViewerSite["status"]): ViewerSite => ({ id: 7, status, parkId: 1, latitude: 51.5, longitude: 6.5 });
const guest: Viewer = { role: "guest" };
const noSite: Viewer = { role: "member", userId: "u0", site: null };
const pending: Viewer = { role: "member", userId: "u1", site: site("pending") };
const verified: Viewer = { role: "member", userId: "u2", site: site("verified") };
const declined: Viewer = { role: "member", userId: "u3", site: site("declined") };
const admin: Viewer = { role: "admin", userId: "a1" };
const everyone = { guest, noSite, pending, verified, declined, admin };

/** Code a rule answers with for a viewer, or "ok". */
function outcome(rule: (viewer: Viewer) => unknown, viewer: Viewer): string {
  try {
    rule(viewer);
    return "ok";
  } catch (error) {
    if (error instanceof AccessError) return error.code;
    throw error;
  }
}
const table = (rule: (viewer: Viewer) => unknown) => Object.fromEntries(Object.entries(everyone).map(([name, viewer]) => [name, outcome(rule, viewer)]));

describe("access rules (D03, X-01)", () => {
  it("NT-L1-002: a guest is refused everywhere with UNAUTHENTICATED", () => {
    for (const rule of [requireAccount, requireSite, requireVerifiedSite, requireBrowse, requireAdmin]) {
      expect(outcome(rule, guest)).toBe("UNAUTHENTICATED");
    }
  });

  it("own profile and drafts: every member with a site, never the administrator", () => {
    expect(table(requireSite)).toEqual({ guest: "UNAUTHENTICATED", noSite: "NO_SITE", pending: "ok", verified: "ok", declined: "ok", admin: "FORBIDDEN" });
  });

  it("NT-L1-003: publishing and contacting need a verified site – pending and declined are refused", () => {
    expect(table(requireVerifiedSite)).toEqual({
      guest: "UNAUTHENTICATED",
      noSite: "NO_SITE",
      pending: "NOT_VERIFIED",
      verified: "ok",
      declined: "NOT_VERIFIED",
      admin: "FORBIDDEN",
    });
  });

  it("listings, map and directory: verified members and the administrator", () => {
    expect(table(requireBrowse)).toEqual({ guest: "UNAUTHENTICATED", noSite: "NO_SITE", pending: "NOT_VERIFIED", verified: "ok", declined: "NOT_VERIFIED", admin: "ok" });
    expect(canBrowse(pending)).toBe(false);
    expect(canBrowse(admin)).toBe(true);
  });

  it("AT-L1-003: only the administrator passes the admin rule – no member, whatever the status of the site", () => {
    expect(table(requireAdmin)).toEqual({ guest: "UNAUTHENTICATED", noSite: "FORBIDDEN", pending: "FORBIDDEN", verified: "FORBIDDEN", declined: "FORBIDDEN", admin: "ok" });
  });

  it("the administrator never acts as a site", () => {
    expect(siteIdOf(admin)).toBeNull();
    expect(siteIdOf(guest)).toBeNull();
    expect(siteIdOf(noSite)).toBeNull();
    expect(siteIdOf(verified)).toBe(7);
    expect(isVerifiedMember(admin)).toBe(false);
  });

  it("maps the codes to HTTP statuses", () => {
    expect(new AccessError("UNAUTHENTICATED").status).toBe(401);
    expect(new AccessError("NOT_VERIFIED").status).toBe(403);
    expect(new AccessError("NOT_FOUND").status).toBe(404);
    expect(new AccessError("CONFLICT", { currentRevision: 3 }).details).toEqual({ currentRevision: 3 });
    expect(new AccessError("RATE_LIMITED").status).toBe(429);
  });
});

describe("requireCurrentRevision (review 2026-11-26: write only onto the state that was read and validated)", () => {
  it("passes when the caller's revision is the one that was read, or when none was sent", () => {
    expect(() => requireCurrentRevision(3, 3)).not.toThrow();
    expect(() => requireCurrentRevision(3, undefined)).not.toThrow();
  });

  it("refuses an older and a newer revision alike – a guessed future number must not slip past the read", () => {
    for (const expected of [2, 4]) {
      try {
        requireCurrentRevision(3, expected);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(AccessError);
        expect((error as AccessError).code).toBe("CONFLICT");
        expect((error as AccessError).details).toEqual({ reason: "STALE", currentRevision: 3 });
      }
    }
  });
});
