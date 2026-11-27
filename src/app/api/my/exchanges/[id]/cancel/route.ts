import { api, readId, readJson } from "@/server/http";
import { cancelExchange } from "@/server/dal/exchanges";
import { exchangeCancel } from "@/server/validation/negotiations";

/** POST /api/my/exchanges/[id]/cancel – either party cancels a planned exchange with a reason; no delivery is recorded. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/exchanges/[id]/cancel", async ({ viewer }) => cancelExchange(viewer, await readId(params), await readJson(request, exchangeCancel)));
}
