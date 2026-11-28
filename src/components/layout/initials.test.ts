import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Musterplast Fertigung GmbH (fiktiv)")).toBe("MF");
  });
  it("works with one word and with lower case", () => {
    expect(initialsOf("skizze")).toBe("S");
  });
  it("skips words that do not start with a letter", () => {
    expect(initialsOf("  (fiktiv) 3D Druck & Österreich Werk")).toBe("DÖ");
  });
  it("is empty without a word", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf(" 42 & ")).toBe("");
  });
});
