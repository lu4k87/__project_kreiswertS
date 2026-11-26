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

  it.each([["NUL", "Moers\u0000"], ["a line break inside", "Kamp\nLintfort"], ["an escape sequence", "\u001b[2J"]])(
    "rejects a city with %s",
    (_label, city) => {
      expect(offerListQuery.safeParse({ city }).success).toBe(false);
    },
  );

  it("accepts city names with umlauts, hyphens and spaces", () => {
    expect(offerListQuery.parse({ city: " Kamp-Lintfort " }).city).toBe("Kamp-Lintfort");
    expect(offerListQuery.parse({ city: "Mülheim an der Ruhr" }).city).toBe("Mülheim an der Ruhr");
  });
});
