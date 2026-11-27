import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import type { Viewer, ViewerSite } from "./access";
import { db } from "./db/client";
import { isDatabaseError } from "./db/errors";
import { sites } from "./db/schema";
import type { VerificationStatus } from "./domain/status";

export type { Viewer } from "./access";

/** The member's site with the fields access rules and distance need – read on every request, never cached. */
async function loadSite(siteId: number): Promise<ViewerSite | null> {
  const [row] = await db
    .select({
      id: sites.id,
      status: sites.verificationStatus,
      parkId: sites.parkId,
      latitude: sites.latitude,
      longitude: sites.longitude,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  return row ? { ...row, status: row.status as VerificationStatus } : null;
}

/**
 * Who is asking? Guest (no session), member (with the current state of their site) or administrator.
 * Role and site come from the database row of the session's user: a verification or a role change takes
 * effect with the next request.
 */
export async function getViewer(headers: Headers): Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { role: "guest" };
  const { id: userId, role, siteId } = session.user;
  if (role === "admin") return { role: "admin", userId };
  return { role: "member", userId, site: siteId == null ? null : await loadSite(siteId) };
}

/**
 * For pages: if the database is unreachable, the session cannot be read → show the page as for a guest
 * (fewest rights) instead of an error page. API routes use getViewer() and answer with 503 themselves.
 */
export async function getViewerOrGuest(headers: Headers): Promise<Viewer> {
  try {
    return await getViewer(headers);
  } catch (error) {
    if (!isDatabaseError(error)) throw error; // a programming error stays an error
    // Without the error object: its message contains the query including the session token; Better Auth already logs the error.
    console.error("Session unreadable: database unreachable → page shown as for a guest");
    return { role: "guest" };
  }
}
