// Begrenzt die Größe des Anfrage-Bodys, bevor ein Handler ihn liest – sonst hält der Server beliebig große Anfragen im Speicher.

/** Liefert die Anfrage mit eingelesenem Body zurück – oder null, wenn er größer als `maxBytes` ist. */
export async function readBodyUpTo(request: Request, maxBytes: number): Promise<Request | null> {
  // Angekündigte Größe: gar nicht erst lesen.
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  if (!request.body) return request;
  // Ohne Content-Length (chunked) zählt, was wirklich ankommt.
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

/** Umhüllt einen Route Handler: größere Anfragen beantwortet der Server mit HTTP 413, ohne den Handler aufzurufen. */
export function withBodyLimit(handler: (request: Request) => Promise<Response>, maxBytes: number) {
  return async (request: Request): Promise<Response> => {
    const limited = await readBodyUpTo(request, maxBytes);
    if (limited) return handler(limited);
    return Response.json({ code: "PAYLOAD_TOO_LARGE", message: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  };
}
