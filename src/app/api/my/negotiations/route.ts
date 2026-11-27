import { api, readJson } from "@/server/http";
import { listNegotiations, startNegotiation } from "@/server/dal/negotiations";
import { negotiationStart } from "@/server/validation/negotiations";

/** GET /api/my/negotiations – incoming and outgoing negotiations of the own site. */
export function GET(request: Request) {
  return api(request, "GET /api/my/negotiations", async ({ viewer }) => ({ negotiations: await listNegotiations(viewer) }));
}

/** POST /api/my/negotiations – first proposal for an open offer, optionally for a request; the parties come from the server. */
export function POST(request: Request) {
  return api(request, "POST /api/my/negotiations", async ({ viewer }) => startNegotiation(viewer, await readJson(request, negotiationStart)));
}
