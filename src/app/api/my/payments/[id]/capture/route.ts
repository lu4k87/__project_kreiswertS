import { api, readId, readJson } from "@/server/http";
import { capturePayment } from "@/server/dal/payments";
import { paymentStep } from "@/server/validation/contracts";

/** POST /api/my/payments/[id]/capture – either site takes the authorised money after delivery (409 NOT_DELIVERED before); idempotent by key. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/payments/[id]/capture", async ({ viewer }) => {
    const id = await readId(params);
    const { idempotencyKey } = await readJson(request, paymentStep);
    return capturePayment(viewer, id, idempotencyKey);
  });
}
