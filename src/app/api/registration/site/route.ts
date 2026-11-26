import { api, readJson } from "@/server/http";
import { registerSite } from "@/server/dal/sites";
import { siteRegistration } from "@/server/validation/sites";

/** POST /api/registration/site – second step of the registration: company + physical site for the logged-in account. */
export function POST(request: Request) {
  return api(request, "POST /api/registration/site", async ({ viewer }) =>
    registerSite(viewer, await readJson(request, siteRegistration, 16 * 1024)),
  );
}
