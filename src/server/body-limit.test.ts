import { describe, expect, it, vi } from "vitest";
import { withBodyLimit } from "./body-limit";

const URL = "http://localhost:3000/api/auth/sign-up/email";
const LIMIT = 16 * 1024;

function post(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body,
    duplex: "half",
  } as RequestInit);
}

/** Body in Stücken ohne Content-Length, wie bei „Transfer-Encoding: chunked“. */
function chunked(totalBytes: number, onPull?: () => void) {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (sent >= totalBytes) return controller.close();
      const size = Math.min(4096, totalBytes - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size).fill(120));
    },
  });
}

describe("withBodyLimit", () => {
  it("passes a small request on unchanged: method, headers and body", async () => {
    const handler = vi.fn(async (request: Request) => Response.json(await request.json()));
    const response = await withBodyLimit(handler, LIMIT)(post(JSON.stringify({ name: "Rhein Polymer" })));
    expect(await response.json()).toEqual({ name: "Rhein Polymer" });
    const seen = handler.mock.calls[0][0];
    expect([seen.method, seen.url, seen.headers.get("origin")]).toEqual(["POST", URL, "http://localhost:3000"]);
  });

  it("accepts exactly the limit", async () => {
    const handler = vi.fn(async (request: Request) => new Response(String((await request.arrayBuffer()).byteLength)));
    const response = await withBodyLimit(handler, LIMIT)(post("x".repeat(LIMIT)));
    expect(await response.text()).toBe(String(LIMIT));
  });

  it("answers 413 for one byte more, without calling the handler", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const response = await withBodyLimit(handler, LIMIT)(post("x".repeat(LIMIT + 1)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not read the body when Content-Length already announces too much", async () => {
    const pull = vi.fn();
    const handler = vi.fn(async () => new Response("ok"));
    const response = await withBodyLimit(handler, LIMIT)(post(chunked(100, pull), { "content-length": "6000000" }));
    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
    expect(pull.mock.calls.length).toBeLessThanOrEqual(1); // der Stream füllt höchstens seinen Puffer vor
  });

  it("stops reading a 6 MB body without Content-Length shortly after the limit", async () => {
    const pull = vi.fn();
    const handler = vi.fn(async () => new Response("ok"));
    const response = await withBodyLimit(handler, LIMIT)(post(chunked(6_000_000, pull)));
    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
    expect(pull.mock.calls.length).toBeLessThan(10); // 16 KB in 4-KB-Stücken, nicht 6 MB
  });

  it("lets requests without a body through (GET, sign-out)", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const request = new Request(URL, { method: "POST" });
    await withBodyLimit(handler, LIMIT)(request);
    expect(handler).toHaveBeenCalledWith(request);
  });
});
