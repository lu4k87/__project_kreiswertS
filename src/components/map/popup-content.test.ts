import { describe, expect, it } from "vitest";
import { monogram } from "./popup-content";

describe("monogram", () => {
  it("takes the first letters of the first two telling words", () => {
    expect(monogram("Demo Formteile GmbH (fiktiv)")).toBe("DF");
    expect(monogram("Modell Kunststofftechnik GmbH (fiktiv)")).toBe("MK");
  });
  it("skips legal forms, connectors and dashes", () => {
    expect(monogram("Müller & Co. KG")).toBe("M");
    expect(monogram("Rhein-Ruhr Recycling AG")).toBe("RR");
    expect(monogram("Ölwerke der Region")).toBe("ÖR");
  });
  it("never returns an empty mark", () => {
    expect(monogram("(fiktiv)")).toBe("?");
    expect(monogram("")).toBe("?");
  });
});
