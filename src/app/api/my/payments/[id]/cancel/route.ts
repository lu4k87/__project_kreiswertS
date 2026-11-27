import { api, readId, readJson } from "@/server/http";
import { cancelPayment } from "@/server/dal/payments";
import { paymentStep } from "@/server/validation/contracts";

/** POST /api/my/payments/[id]/cancel – the payer releases a pending or authorised payment; idempotent by key. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/payments/[id]/cancel", async ({ viewer }) => {
    const id = await readId(params);
    const { idempotencyKey } = await readJson(request, paymentStep);
    return cancelPayment(viewer, id, idempotencyKey);
  });
}
