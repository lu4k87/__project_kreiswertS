import { describe, expect, it } from "vitest";
import { DEMO_LOGINS, demoMark } from "./demo";

describe("demoMark", () => {
  it("keeps the letter of the lettered demo sites", () => {
    expect(demoMark("Werk A")).toBe("A");
    expect(demoMark("Compoundierwerk I")).toBe("I");
  });

  it("uses initials for a site without a letter (was the last letter of the name: \"e\" for Campus Kleve)", () => {
    expect(demoMark("Campus Kleve")).toBe("CK");
    expect(demoMark("Campus Kamp-Lintfort")).toBe("CK");
  });

  it("gives every site login a mark in capitals", () => {
    for (const entry of DEMO_LOGINS) if (entry.name) expect(demoMark(entry.name)).toMatch(/^\p{Lu}{1,2}$/u);
  });
});
