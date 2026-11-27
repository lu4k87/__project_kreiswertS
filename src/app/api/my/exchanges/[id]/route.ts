import { api, readId, readJson } from "@/server/http";
import { getExchange, updateExchange } from "@/server/dal/exchanges";
import { exchangeUpdate } from "@/server/validation/negotiations";

/** GET /api/my/exchanges/[id] – one exchange with the accepted terms and its history. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/exchanges/[id]", async ({ viewer }) => getExchange(viewer, await readId(params)));
}

/** PUT /api/my/exchanges/[id] – move the planned date or change the note (either party, while planned). */
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "PUT /api/my/exchanges/[id]", async ({ viewer }) => updateExchange(viewer, await readId(params), await readJson(request, exchangeUpdate)));
}
