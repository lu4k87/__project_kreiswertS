import { api, readJson } from "@/server/http";
import { getMySite, updateMySite } from "@/server/dal/sites";
import { siteProfile } from "@/server/validation/sites";

/** GET /api/my/site – the own site including address and verification status. */
export function GET(request: Request) {
  return api(request, "GET /api/my/site", async ({ viewer }) => getMySite(viewer));
}

/** PUT /api/my/site – change the own profile (contact, capabilities, visibility); never the verification status. */
export function PUT(request: Request) {
  return api(request, "PUT /api/my/site", async ({ viewer }) => updateMySite(viewer, await readJson(request, siteProfile, 16 * 1024)));
}
