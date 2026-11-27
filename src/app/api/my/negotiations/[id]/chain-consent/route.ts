import { api, readId, readJson } from "@/server/http";
import { getChainView, setChainConsent } from "@/server/dal/chain";
import { getNegotiation } from "@/server/dal/negotiations";
import { chainConsent } from "@/server/validation/contracts";

/** GET /api/my/negotiations/[id]/chain-consent – both releases and, once both are valid, the combined chain benefit. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/negotiations/[id]/chain-consent", async ({ viewer }) => getChainView(viewer, await getNegotiation(viewer, await readId(params))));
}

/** POST /api/my/negotiations/[id]/chain-consent – release the own saved comparison for this proposal, or withdraw it. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/negotiations/[id]/chain-consent", async ({ viewer }) => setChainConsent(viewer, await readId(params), await readJson(request, chainConsent)));
}
