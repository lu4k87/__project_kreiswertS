import { api, readJson } from "@/server/http";
import { createSavedSearch, listSavedSearches } from "@/server/dal/alerts";
import { savedSearchInput } from "@/server/validation/saved-searches";

/** GET /api/my/saved-searches – saved offer searches of the own site (function no. 19). */
export function GET(request: Request) {
  return api(request, "GET /api/my/saved-searches", async ({ viewer }) => ({ searches: await listSavedSearches(viewer) }));
}

/** POST /api/my/saved-searches – save the filters of /offers (verified site, at most 20 per site). */
export function POST(request: Request) {
  return api(request, "POST /api/my/saved-searches", async ({ viewer }) => createSavedSearch(viewer, await readJson(request, savedSearchInput, 4096)));
}
