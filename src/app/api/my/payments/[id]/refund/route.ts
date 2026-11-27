import { api, readId, readJson } from "@/server/http";
import { refundPayment } from "@/server/dal/payments";
import { paymentRefund } from "@/server/validation/contracts";

/** POST /api/my/payments/[id]/refund – the payee pays captured money back with a reason; idempotent by key. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/payments/[id]/refund", async ({ viewer }) => refundPayment(viewer, await readId(params), await readJson(request, paymentRefund)));
}
