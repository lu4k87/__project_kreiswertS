import { api, readId, readJson } from "@/server/http";
import { replyToResponse } from "@/server/dal/requests";
import { replyInput } from "@/server/validation/requests";

/** POST /api/my/responses/[id]/reply – the requester answers a received response once. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/responses/[id]/reply", async ({ viewer }) => {
    const { reply } = await readJson(request, replyInput, 8 * 1024);
    return replyToResponse(viewer, await readId(params), reply);
  });
}
