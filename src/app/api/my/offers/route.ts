import { api, readJson } from "@/server/http";
import { createOffer, listMyOffers } from "@/server/dal/offers";
import { offerInput } from "@/server/validation/offers";

/** GET /api/my/offers – all offers of the own site, every status. */
export function GET(request: Request) {
  return api(request, "GET /api/my/offers", async ({ viewer }) => ({ offers: await listMyOffers(viewer) }));
}

/** POST /api/my/offers – save a new draft; the owner is the site of the session. */
export function POST(request: Request) {
  return api(request, "POST /api/my/offers", async ({ viewer }) => createOffer(viewer, await readJson(request, offerInput)));
}
