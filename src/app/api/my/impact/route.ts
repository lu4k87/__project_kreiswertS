import { api } from "@/server/http";
import { getImpactOverview } from "@/server/dal/assessments";

/** GET /api/my/impact – the own circularity overview: exchanges (verified apart from simulated) and approved results. */
export function GET(request: Request) {
  return api(request, "GET /api/my/impact", async ({ viewer }) => getImpactOverview(viewer));
}
