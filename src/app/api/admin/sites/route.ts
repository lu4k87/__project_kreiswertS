import { api, readQuery } from "@/server/http";
import { listSitesForReview } from "@/server/dal/admin";
import { siteReviewQuery } from "@/server/validation/sites";

/** GET /api/admin/sites?status=pending|verified|declined&before= – registered sites for verification (administrator). */
export function GET(request: Request) {
  return api(request, "GET /api/admin/sites", async ({ viewer }) => listSitesForReview(viewer, readQuery(request, siteReviewQuery)));
}
