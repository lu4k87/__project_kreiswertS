import { api, readId, readJson } from "@/server/http";
import { planExchange } from "@/server/dal/exchanges";
import { exchangePlan } from "@/server/validation/negotiations";

/** POST /api/my/negotiations/[id]/exchange – plan the exchange of an agreed negotiation (409 NOT_AGREED otherwise). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/exchange", async ({ viewer }) => planExchange(viewer, await readId(params), await readJson(request, exchangePlan)));
}
