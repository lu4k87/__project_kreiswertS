import { api, readId, readJson } from "@/server/http";
import { publishOffer } from "@/server/dal/offers";
import { offerAction } from "@/server/validation/offers";

/** POST /api/my/offers/[id]/publish – publish a draft (verified site, complete offer); sets the expiry date. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/offers/[id]/publish", async ({ viewer }) => {
    const { expectedRevision } = await readJson(request, offerAction, 1024);
    return publishOffer(viewer, await readId(params), expectedRevision);
  });
}
