import { describe, expect, it } from "vitest";
import { offerListQuery } from "./offers";

describe("offerListQuery", () => {
  it("converts query strings and sets the limit", () => {
    expect(offerListQuery.parse({ materialId: "3" })).toEqual({ materialId: 3, limit: 50 });
  });

  it("behandelt leere Felder wie fehlende", () => {
    expect(offerListQuery.parse({ materialId: "", city: "", limit: "" })).toEqual({ limit: 50 });
  });

  it("rejects invalid values", () => {
    expect(offerListQuery.safeParse({ materialId: "-1" }).success).toBe(false);
    expect(offerListQuery.safeParse({ limit: "1000" }).success).toBe(false);
    expect(offerListQuery.safeParse({ city: "   " }).success).toBe(false);
  });
});
