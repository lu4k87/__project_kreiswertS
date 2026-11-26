import { api, readId, readJson } from "@/server/http";
import { renewOffer } from "@/server/dal/offers";
import { offerAction } from "@/server/validation/offers";

/** POST /api/my/offers/[id]/renew – validate again and count the expiry date from now. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/offers/[id]/renew", async ({ viewer }) => {
    const { expectedRevision } = await readJson(request, offerAction, 1024);
    return renewOffer(viewer, await readId(params), expectedRevision);
  });
}
