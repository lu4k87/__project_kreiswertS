import { describe, expect, it } from "vitest";
import { offerListQuery } from "./offers";

describe("offerListQuery", () => {
  it("wandelt Query-Strings um und setzt das Limit", () => {
    expect(offerListQuery.parse({ materialId: "3" })).toEqual({ materialId: 3, limit: 50 });
  });

  it("behandelt leere Felder wie fehlende", () => {
    expect(offerListQuery.parse({ materialId: "", city: "", limit: "" })).toEqual({ limit: 50 });
  });

  it("lehnt ungültige Werte ab", () => {
    expect(offerListQuery.safeParse({ materialId: "-1" }).success).toBe(false);
    expect(offerListQuery.safeParse({ limit: "1000" }).success).toBe(false);
    expect(offerListQuery.safeParse({ city: "   " }).success).toBe(false);
  });
});
