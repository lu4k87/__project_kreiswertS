import { describe, expect, it } from "vitest";
import { authSecretProblem } from "./startup-check";

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
