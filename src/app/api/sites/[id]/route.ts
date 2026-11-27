import { api, readId } from "@/server/http";
import { listActiveOffersOfSite } from "@/server/dal/offers";
import { getSiteProfile } from "@/server/dal/sites";
import { canBrowse } from "@/server/access";

/** GET /api/sites/[id] – profile of one site with its active offers. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/sites/[id]", async ({ viewer }) => {
    const id = await readId(params);
    const site = await getSiteProfile(viewer, id);
    // the owner of a pending site may read the own profile, but not browse offers
    return { site, offers: canBrowse(viewer) ? await listActiveOffersOfSite(viewer, id) : [] };
  });
}
