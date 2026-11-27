import { api, readId } from "@/server/http";
import { getMatch } from "@/server/dal/matches";

type Context = { params: Promise<{ requestId: string; offerId: string }> };

/** GET /api/matches/[requestId]/[offerId] – one request against one offer; the viewer owns exactly one of them. */
export function GET(request: Request, { params }: Context) {
  return api(request, "GET /api/matches/[requestId]/[offerId]", async ({ viewer }) =>
    getMatch(viewer, await readId(params, "requestId"), await readId(params, "offerId")),
  );
}
