import "server-only";
import { auth } from "./auth";
import { isDatabaseError } from "./db/errors";

/** Who is asking? Guest (no cookie) or member (with session cookie). */
export type Viewer =
  | { role: "guest" }
  | { role: "member"; userId: string; siteId: number | null };

export async function getViewer(headers: Headers): Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { role: "guest" };
  return { role: "member", userId: session.user.id, siteId: session.user.siteId ?? null };
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
