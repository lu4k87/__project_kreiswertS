import { api } from "@/server/http";
import { listMatches } from "@/server/dal/matches";

/** GET /api/matches – candidate pairs of the own active requests and offers, explained per criterion (verified sites). */
export function GET(request: Request) {
  return api(request, "GET /api/matches", async ({ viewer }) => listMatches(viewer));
}
