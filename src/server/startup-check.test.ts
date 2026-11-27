import { describe, expect, it } from "vitest";
import { authEnvProblem, authSecretProblem, paymentSecretProblem, startupProblem } from "./startup-check";

const GOOD = "Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4";

describe("authSecretProblem", () => {
  it.each([
    ["no secret", {}],
    ["an empty secret", { BETTER_AUTH_SECRET: "" }],
    ["31 characters", { BETTER_AUTH_SECRET: "x".repeat(31) }],
    ["the public default of Better Auth", { BETTER_AUTH_SECRET: "better-auth-secret-12345678901234567890" }],
    // BETTER_AUTH_SECRETS wins inside Better Auth – a good BETTER_AUTH_SECRET next to it must not hide a weak one
    ["a short first entry in BETTER_AUTH_SECRETS", { BETTER_AUTH_SECRET: GOOD, BETTER_AUTH_SECRETS: `2:kurz,1:${GOOD}` }],
    ["an empty first entry in BETTER_AUTH_SECRETS", { BETTER_AUTH_SECRETS: `2:,1:${GOOD}` }],
  ])("rejects %s", (_label, env) => {
    expect(authSecretProblem(env)).toContain("BETTER_AUTH_SECRET");
  });

  it.each([
    ["32 characters", { BETTER_AUTH_SECRET: "x".repeat(32) }],
    ["a generated secret", { BETTER_AUTH_SECRET: GOOD }],
    ["a good first entry in BETTER_AUTH_SECRETS", { BETTER_AUTH_SECRETS: ` 2: ${GOOD} ,1:alt` }],
  ])("accepts %s", (_label, env) => {
    expect(authSecretProblem(env)).toBeNull();
  });
});

describe("authEnvProblem", () => {
  const URL_OK = { BETTER_AUTH_URL: "http://localhost:3000" };

  it.each([
    ["TEST=1", { ...URL_OK, TEST: "1" }, "TEST"],
    ["TEST=true", { ...URL_OK, TEST: "true" }, "TEST"],
    ["NODE_ENV=test", { ...URL_OK, NODE_ENV: "test" }, "TEST"],
    ["no BETTER_AUTH_URL", {}, "BETTER_AUTH_URL"],
    ["an empty BETTER_AUTH_URL", { BETTER_AUTH_URL: "" }, "BETTER_AUTH_URL"],
    ["a BETTER_AUTH_URL without scheme", { BETTER_AUTH_URL: "localhost:3000" }, "BETTER_AUTH_URL"],
    ["a BETTER_AUTH_URL with another scheme", { BETTER_AUTH_URL: "ftp://localhost" }, "BETTER_AUTH_URL"],
    ["a wildcard as host", { BETTER_AUTH_URL: "http://*" }, "BETTER_AUTH_URL"],
    ["a wildcard subdomain", { BETTER_AUTH_URL: "https://*.kreiswerts.example" }, "BETTER_AUTH_URL"],
  ])("rejects %s", (_label, env, variable) => {
    expect(authEnvProblem(env)).toContain(variable);
  });

  it.each([
    ["a local address", URL_OK],
    ["an https address", { BETTER_AUTH_URL: "https://kreiswerts.example" }],
    ["TEST=false", { ...URL_OK, TEST: "false" }],
    ["an empty TEST", { ...URL_OK, TEST: "" }],
    ["NODE_ENV=production", { ...URL_OK, NODE_ENV: "production" }],
  ])("accepts %s", (_label, env) => {
    expect(authEnvProblem(env)).toBeNull();
  });
});

describe("startupProblem", () => {
  it("names the secret first, then the environment, and is null when both are fine", () => {
    expect(startupProblem({})).toContain("BETTER_AUTH_SECRET");
    expect(startupProblem({ BETTER_AUTH_SECRET: GOOD })).toContain("BETTER_AUTH_URL");
    expect(startupProblem({ BETTER_AUTH_SECRET: GOOD, BETTER_AUTH_URL: "http://localhost:3000" })).toBeNull();
  });
});

describe("paymentSecretProblem (security review 2026-11-27)", () => {
  it("unset, empty or at least 32 characters is fine", () => {
    expect(paymentSecretProblem({})).toBeNull();
    expect(paymentSecretProblem({ PAYMENT_WEBHOOK_SECRET: "" })).toBeNull();
    expect(paymentSecretProblem({ PAYMENT_WEBHOOK_SECRET: "a".repeat(32) })).toBeNull();
  });
  it("a short secret stops the server instead of being replaced silently", () => {
    expect(paymentSecretProblem({ PAYMENT_WEBHOOK_SECRET: "a".repeat(31) })).toMatch(/PAYMENT_WEBHOOK_SECRET/);
  });
});
