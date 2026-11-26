import { api, readId } from "@/server/http";
import { getOffer } from "@/server/dal/offers";

/** GET /api/offers/[id] – one offer: full for verified members and the owner, "unavailable" once closed or expired. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/offers/[id]", async ({ viewer }) => getOffer(viewer, await readId(params)));
}
