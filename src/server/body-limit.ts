// Limits the size of the request body before a handler reads it – otherwise the server keeps arbitrarily large requests in memory.

/** Returns the request with its body read in – or null if it is larger than `maxBytes`. */
export async function readBodyUpTo(request: Request, maxBytes: number): Promise<Request | null> {
  // Announced size: do not even read it.
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  if (!request.body) return request;
  // Without Content-Length (chunked), what actually arrives counts.
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Request(request.url, { method: request.method, headers: request.headers, body: Buffer.concat(chunks) });
}

/** Wraps a route handler: the server answers larger requests with HTTP 413 without calling the handler. */
export function withBodyLimit(handler: (request: Request) => Promise<Response>, maxBytes: number) {
  return async (request: Request): Promise<Response> => {
    const limited = await readBodyUpTo(request, maxBytes);
    if (limited) return handler(limited);
    return Response.json({ code: "PAYLOAD_TOO_LARGE", message: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  };
}
