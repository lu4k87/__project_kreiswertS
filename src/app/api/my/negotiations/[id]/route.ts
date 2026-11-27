import { api, readId } from "@/server/http";
import { getNegotiation } from "@/server/dal/negotiations";

/** GET /api/my/negotiations/[id] – one negotiation with every revision; only the two sites can read it. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/negotiations/[id]", async ({ viewer }) => getNegotiation(viewer, await readId(params)));
}
