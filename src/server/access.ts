// Station 4 – authorisation: who is asking and what that role may do (docs/FEATURES.md "Roles").
// Pure types + functions without a database → tested on their own (access.test.ts). The Data Access Layer calls
// the require…() functions at the top of every function; pages and routes never decide access themselves.
import type { VerificationStatus } from "./domain/status";

/** The site a member belongs to, as far as access rules and distance need it. Read fresh on every request. */
export type ViewerSite = {
  id: number;
  status: VerificationStatus;
  parkId: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type Guest = { role: "guest" };
/** `site: null` = account without a finished registration (company + site step missing). */
export type Member = { role: "member"; userId: string; site: ViewerSite | null };
export type Admin = { role: "admin"; userId: string };
export type Viewer = Guest | Member | Admin;

export type AccessCode = "UNAUTHENTICATED" | "INVALID_SIGNATURE" | "FORBIDDEN" | "NOT_VERIFIED" | "NO_SITE" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED";

const STATUS: Record<AccessCode, number> = {
  UNAUTHENTICATED: 401,
  /** A provider confirmation whose signature does not check out (payments webhook). */
  INVALID_SIGNATURE: 401,
  FORBIDDEN: 403,
  NOT_VERIFIED: 403,
  NO_SITE: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
};

/** Refused by an access or state rule. The route turns it into a structured answer (src/server/http.ts). */
export class AccessError extends Error {
  readonly status: number;
  constructor(
    readonly code: AccessCode,
    /** Extra data for the browser, e.g. the current revision after a stale edit. */
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "AccessError";
    this.status = STATUS[code];
  }
}

/** Input that is well-formed but breaks a business rule (HTTP 422 with field problems). */
export class RuleError extends Error {
  readonly status = 422;
  constructor(readonly fields: { field: string; code: string }[]) {
    super("VALIDATION");
    this.name = "RuleError";
  }
}

export function isVerifiedMember(viewer: Viewer): viewer is Member & { site: ViewerSite } {
  return viewer.role === "member" && viewer.site?.status === "verified";
}

/** Verified members and the administrator may read listings, the map and the directory (D03, D08). */
export function canBrowse(viewer: Viewer): boolean {
  return viewer.role === "admin" || isVerifiedMember(viewer);
}

/** Any logged-in account. */
export function requireAccount(viewer: Viewer): Member | Admin {
  if (viewer.role === "guest") throw new AccessError("UNAUTHENTICATED");
  return viewer;
}

/** Member with a site (pending, verified or declined): own profile, own drafts, own lists. */
export function requireSite(viewer: Viewer): Member & { site: ViewerSite } {
  const account = requireAccount(viewer);
  // The administrator has no site and never acts as one.
  if (account.role !== "member") throw new AccessError("FORBIDDEN");
  if (!account.site) throw new AccessError("NO_SITE");
  return account as Member & { site: ViewerSite };
}

/** Member of a verified site: publish, renew, enquire, respond. A pending or declined site is refused. */
export function requireVerifiedSite(viewer: Viewer): Member & { site: ViewerSite } {
  const member = requireSite(viewer);
  if (member.site.status !== "verified") throw new AccessError("NOT_VERIFIED");
  return member;
}

/** Verified member or administrator: read listings, map, directory. */
export function requireBrowse(viewer: Viewer): Member | Admin {
  const account = requireAccount(viewer);
  if (account.role === "member" && !account.site) throw new AccessError("NO_SITE");
  if (!canBrowse(account)) throw new AccessError("NOT_VERIFIED");
  return account;
}

export function requireAdmin(viewer: Viewer): Admin {
  const account = requireAccount(viewer);
  if (account.role !== "admin") throw new AccessError("FORBIDDEN");
  return account;
}

/** Site id of a member, null for guests, the administrator and unfinished registrations. */
export function siteIdOf(viewer: Viewer): number | null {
  return viewer.role === "member" ? (viewer.site?.id ?? null) : null;
}

/**
 * Optimistic lock, first half: the revision the caller worked on must be the one just read from the database.
 * A write is then applied to exactly that revision (second half: `UPDATE … WHERE revision = <read>`), so what was
 * validated is what gets changed. An older number is a stale edit; a newer one is refused too – otherwise a
 * guessed future number could attach a change to a state that was never read or checked.
 */
export function requireCurrentRevision(current: number, expected: number | undefined): void {
  if (expected !== undefined && expected !== current) throw new AccessError("CONFLICT", { reason: "STALE", currentRevision: current });
}
