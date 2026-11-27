// Provider confirmation endpoint: called server to server, so no session and no Origin – instead every body must
// carry a valid HMAC signature over its raw bytes (KW-Signature header), also for the simulated provider.
import { api } from "@/server/http";
import { readBodyUpTo } from "@/server/body-limit";
import { handleProviderEvent } from "@/server/dal/payments";
import { SIGNATURE_HEADER } from "@/server/payments/signature";

const MAX_BYTES = 8 * 1024;

/** POST /api/payments/webhook – signed confirmation of the payment provider (401 INVALID_SIGNATURE otherwise). */
export function POST(request: Request) {
  return api(
    request,
    "POST /api/payments/webhook",
    async () => {
      const limited = await readBodyUpTo(request, MAX_BYTES);
      if (!limited) return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
      return handleProviderEvent(await limited.text(), request.headers.get(SIGNATURE_HEADER));
    },
    { external: true },
  );
}
