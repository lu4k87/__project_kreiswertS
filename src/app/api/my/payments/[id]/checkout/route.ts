import { api, readId, readJson } from "@/server/http";
import { simulateCheckout } from "@/server/dal/payments";
import { paymentCheckout } from "@/server/validation/contracts";

/** POST /api/my/payments/[id]/checkout – the payer's simulated checkout: a signed provider confirmation (authorised or failed). */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/payments/[id]/checkout", async ({ viewer }) => {
    const id = await readId(params);
    const { outcome } = await readJson(request, paymentCheckout);
    return simulateCheckout(viewer, id, outcome);
  });
}
