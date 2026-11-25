import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrUnavailable } from "./auth-client";

afterEach(() => vi.unstubAllGlobals());

describe("fetchOrUnavailable", () => {
  it("answers 503 instead of throwing when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const response = await fetchOrUnavailable("http://localhost/api/auth/sign-in/email", { method: "POST" });
    expect(response.status).toBe(503);
  });

  it("passes a normal answer through unchanged", async () => {
    const answer = new Response("{}", { status: 401 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer));
    expect(await fetchOrUnavailable("http://localhost/api/auth/sign-in/email")).toBe(answer);
  });
});
