import { api, readId, readJson } from "@/server/http";
import { completeExchange } from "@/server/dal/exchanges";
import { exchangeCompletion } from "@/server/validation/negotiations";

/** POST /api/my/exchanges/[id]/complete – the receiving site records quantity and quality check (403 for the offerer). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/exchanges/[id]/complete", async ({ viewer }) => completeExchange(viewer, await readId(params), await readJson(request, exchangeCompletion)));
}
