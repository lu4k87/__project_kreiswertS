import { api, readQuery } from "@/server/http";
import { searchRequests } from "@/server/dal/requests";
import { requestSearchQuery } from "@/server/validation/requests";

/** GET /api/requests?scope=park|radius&radiusKm=&typeId=&formId=… – open requests of other verified sites. */
export function GET(request: Request) {
  return api(request, "GET /api/requests", async ({ viewer }) => searchRequests(viewer, readQuery(request, requestSearchQuery)));
}
