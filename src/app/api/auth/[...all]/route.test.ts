import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const BASE = "http://localhost:3000";
const EMAIL = "niemand@example.invalid";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Loads the route fresh (empty rate-limit counter). No database needed: limit, sizes and hooks apply before the first query. */
async function loadRoute() {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("BETTER_AUTH_SECRET", "only-for-this-test-0123456789abcdef");
  return import("./route");
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth: rate limit", () => {
  it("stops the 4th login attempt within 10 s, even when every request claims another X-Forwarded-For", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await loadRoute();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const forwarded = { "x-forwarded-for": `203.0.113.${50 + attempt}` };
      statuses.push((await POST(post("/sign-in/email", { email: EMAIL, password: "Falsch123x" }, forwarded))).status);
    }
    expect(statuses).toEqual([500, 500, 500, 429, 429, 429]); // 500: this test has no database
  });
});

describe("POST /api/auth: server log on a database error", () => {
  it("names the cause, but neither the query nor its parameters", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await loadRoute();
    // Different path than in the test above: the rate-limit counter is per path and persists across tests.
    const response = await POST(post("/sign-in/username", { username: "rhein.polymer", password: "Falsch123x" }));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    const printed = errors.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(printed).toContain("POST /api/auth/sign-in/username: Datenbankfehler: DATABASE_URL fehlt");
    expect(printed).not.toContain("rhein.polymer");
    expect(printed).not.toContain("auth_users");
  });
});

describe("/api/auth: server log", () => {
  it("writes a value from the request on one line, without control characters", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await loadRoute();
    const { auth } = await import("@/server/auth");
    // This is how Better Auth logs a rejected callbackURL (origin-check.mjs); under vitest the check itself is disabled.
    const forged = "https://evil.example/\n2026-11-26 ERROR [Better Auth] erfundene Zeile \u001b[2J %s";
    (await auth.$context).logger.error(`Invalid callbackURL: ${forged}`, "x".repeat(5000));
    expect(errors.mock.calls).toHaveLength(1);
    const [prefix, message, extra] = errors.mock.calls[0] as string[];
    expect(prefix).toBe("[Better Auth]"); // the format string never contains the "%s" of a request
    expect(message).toBe("Invalid callbackURL: https://evil.example/ 2026-11-26 ERROR [Better Auth] erfundene Zeile  [2J %s");
    expect(extra).toHaveLength(500);
  });

  it("masks the token of a password reset link", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await loadRoute();
    const request = new Request(`${BASE}/api/auth/reset-password/GEHEIMES-TOKEN?callbackURL=/login`);
    const response = await GET(request);
    const printed = errors.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(response.status).toBe(500); // no database in this test
    expect(printed).toContain("GET /api/auth/reset-password/***");
    expect(printed).not.toContain("GEHEIMES-TOKEN");
  });
});

describe("POST /api/auth: sizes and profile fields", () => {
  it("answers 413 for a 6 MB request", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post("/sign-up/email", { name: "N".repeat(6_000_000) }));
    expect(response.status).toBe(413);
  });

  it.each([
    ["a name of 101 characters", { name: "N".repeat(101) }, "INVALID_NAME"],
    ["an empty name", { name: "" }, "INVALID_NAME"],
    ["a profile picture address", { image: "javascript:alert(1)" }, "IMAGE_NOT_ALLOWED"],
  ])("rejects %s on update-user", async (_label, body, code) => {
    const { POST } = await loadRoute();
    const response = await POST(post("/update-user", body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
  });

  it.each([
    ["null", "null", "VALIDATION_ERROR"],
    ["nothing", "", "BAD_REQUEST"], // Better Auth rejects an empty JSON body itself
  ])("answers 400, not 500, for update-user with %s as body", async (_label, body, code) => {
    const { POST } = await loadRoute();
    const request = new Request(`${BASE}/api/auth/update-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
  });

  it("rejects a profile picture on sign-up", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post("/sign-up/email", {
        companyName: "Rhein Polymer GmbH",
        vatId: "DE294681207",
        materialInterest: "plastics",
        username: "rhein.polymer",
        name: "rhein.polymer",
        email: "einkauf@rhein-polymer.example",
        password: "Sicher123",
        image: "https://example.invalid/a.png",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "IMAGE_NOT_ALLOWED" });
  });
});
