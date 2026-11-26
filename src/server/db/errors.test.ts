import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { describeDatabaseError, isDatabaseError, withoutQueryDetails } from "./errors";

describe("isDatabaseError", () => {
  const dbError = new DrizzleQueryError("select 1", [], new Error("connect ECONNREFUSED"));

  it("recognises a failed query", () => {
    expect(isDatabaseError(dbError)).toBe(true);
  });

  it("recognises a failed query wrapped as cause (Better Auth session lookup)", () => {
    expect(isDatabaseError(new Error("FAILED_TO_GET_SESSION", { cause: dbError }))).toBe(true);
  });

  it.each([[new TypeError("x is not a function")], ["text"], [null], [undefined]])("is false for %o", (value) => {
    expect(isDatabaseError(value)).toBe(false);
  });
});

describe("log output for database errors", () => {
  const TOKEN = "s3ss10n-t0k3n-geheim";
  const QUERY = 'select "id" from "auth_sessions" where "auth_sessions"."token" = $1';
  const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
  const dbError = new DrizzleQueryError(QUERY, [TOKEN], refused);
  const wrapped = new Error("Failed to get session", { cause: dbError });

  it("keeps the cause, drops query and parameters", () => {
    expect(describeDatabaseError(dbError)).toBe("Datenbankfehler: [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:5432");
    expect(describeDatabaseError(wrapped)).toBe(describeDatabaseError(dbError));
  });

  it("works without a code and without a cause", () => {
    expect(describeDatabaseError(new DrizzleQueryError(QUERY, [TOKEN], new Error("DATABASE_URL fehlt")))).toBe(
      "Datenbankfehler: DATABASE_URL fehlt",
    );
    expect(describeDatabaseError(new DrizzleQueryError(QUERY, [TOKEN]))).toBe("Datenbankfehler (Ursache unbekannt)");
  });

  it("caps a long cause message at 200 characters", () => {
    const long = new DrizzleQueryError(QUERY, [TOKEN], new Error("x".repeat(5000)));
    expect(describeDatabaseError(long).length).toBeLessThan(230);
  });

  it.each([
    ["the error itself", dbError],
    ["the error wrapped as cause", wrapped],
    ["an error of another library with query + params", Object.assign(new Error("boom"), { query: QUERY, params: [TOKEN], cause: refused })],
    ["the message text of Drizzle", dbError.message],
    ["a text with a prefix", `INTERNAL_SERVER_ERROR ${dbError.message}`],
  ])("removes the session token from %s", (_label, value) => {
    const printed = String(withoutQueryDetails(value));
    expect(printed).not.toContain(TOKEN);
    expect(printed).not.toContain("auth_sessions");
    expect(printed).toContain("Datenbankfehler");
  });

  it("leaves everything else untouched", () => {
    const other = new TypeError("x is not a function");
    expect(withoutQueryDetails(other)).toBe(other);
    expect(withoutQueryDetails("INTERNAL_SERVER_ERROR")).toBe("INTERNAL_SERVER_ERROR");
    expect(withoutQueryDetails(42)).toBe(42);
  });
});
