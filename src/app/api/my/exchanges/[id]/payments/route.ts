import { api, readId, readJson } from "@/server/http";
import { createPayment, getExchangePayment } from "@/server/dal/payments";
import { paymentCreate } from "@/server/validation/contracts";

/** GET /api/my/exchanges/[id]/payments – what the signed contract calls for and the (simulated) payment so far. */
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "GET /api/my/exchanges/[id]/payments", async ({ viewer }) => getExchangePayment(viewer, await readId(params)));
}

/** POST /api/my/exchanges/[id]/payments – the payer starts the simulated payment; the same idempotency key is the same payment. */
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(request, "POST /api/my/exchanges/[id]/payments", async ({ viewer }) => {
    const id = await readId(params);
    const { idempotencyKey } = await readJson(request, paymentCreate);
    return createPayment(viewer, id, idempotencyKey);
  });
}
