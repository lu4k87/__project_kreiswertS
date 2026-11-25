import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { isDatabaseError } from "./errors";

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
