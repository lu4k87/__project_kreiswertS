import { api, readId, readJson } from "@/server/http";
import { closeOffer } from "@/server/dal/offers";
import { offerAction } from "@/server/validation/offers";

/** POST /api/my/offers/[id]/close – idempotent: closing a closed listing answers the same. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/offers/[id]/close", async ({ viewer }) => {
    await readJson(request, offerAction, 1024); // body must be JSON (cross-site forms cannot send it); no field is needed
    return closeOffer(viewer, await readId(params));
  });
}
