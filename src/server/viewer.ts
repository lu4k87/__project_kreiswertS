import "server-only";
import { auth } from "./auth";

/** Wer fragt? Gast (ohne Cookie) oder Mitglied (mit Session-Cookie). */
export type Viewer =
  | { role: "guest" }
  | { role: "member"; userId: string; siteId: number | null };

export async function getViewer(headers: Headers): Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { role: "guest" };
  return { role: "member", userId: session.user.id, siteId: session.user.siteId ?? null };
}
