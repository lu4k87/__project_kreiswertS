import { api, readQuery } from "@/server/http";
import { memberMap } from "@/server/dal/map";
import { offerSearchQuery } from "@/server/validation/offers";

/** GET /api/map – parks, verified sites and the offers of the same search as GET /api/offers (verified members). */
export function GET(request: Request) {
  return api(request, "GET /api/map", async ({ viewer }) => memberMap(viewer, readQuery(request, offerSearchQuery)));
}
