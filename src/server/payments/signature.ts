// Signature of provider confirmations (webhooks): HMAC-SHA256 over "<unix seconds>.<raw body>", sent as
// `KW-Signature: t=<unix seconds>,v1=<hex>`. Checked in constant time and only within a few minutes of the
// timestamp, so a recorded confirmation cannot be replayed later (the event id is also stored once). Applies to the
// simulated provider too – the confirmation endpoint never trusts an unsigned body.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "kw-signature";
/** How far the timestamp may be from the server clock (seconds). */
export const SIGNATURE_TOLERANCE_S = 300;

export function signPayload(secret: string, body: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export type SignatureProblem = "MISSING" | "MALFORMED" | "EXPIRED" | "MISMATCH";

/** null = valid; otherwise why the signature was refused. */
export function verifySignature(secret: string, body: string, header: string | null, now: number = Math.floor(Date.now() / 1000)): SignatureProblem | null {
  if (!header) return "MISSING";
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const given = parts.v1 ?? "";
  if (!/^\d{1,12}$/.test(parts.t ?? "") || !/^[0-9a-f]{64}$/.test(given)) return "MALFORMED";
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_S) return "EXPIRED";
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(given, "hex")) ? null : "MISMATCH";
}
