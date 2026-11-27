import { api } from "@/server/http";
import { listExchanges } from "@/server/dal/exchanges";

/** GET /api/my/exchanges – exchanges of the own site with counts; simulated ones never count as verified (D13). */
export function GET(request: Request) {
  return api(request, "GET /api/my/exchanges", async ({ viewer }) => listExchanges(viewer));
}
