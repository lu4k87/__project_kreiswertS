import { describe, expect, it } from "vitest";
import type { Position } from "./geo";
import { comet, flowAt, FLOW, materialColour, PATHWAY_FALLBACK, REVEAL, revealProgress, revealTotal, revealWindow, ripple } from "./pathway-style";

/** WCAG contrast of a #rrggbb colour against white. */
function contrastOnWhite(hex: string): number {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return 1.05 / (luminance + 0.05);
}

const LINE: Position[] = [
  [6.5, 51.5],
  [6.55, 51.5],
  [6.6, 51.5],
];
const TYPES = ["hdpe", "ldpe", "lldpe", "pp", "pet", "pc", "pmma", "pvc", "abs", "ps", "other", "mixed", "unknown", "aluminium", "steel", "copper"];

describe("materialColour", () => {
  it("gives different materials different colours and one family one colour", () => {
    expect(new Set(["pc", "ldpe", "pvc", "mixed"].map(materialColour)).size).toBe(4);
    expect(materialColour("hdpe")).toBe(materialColour("ldpe"));
  });

  it("falls back to the pathway orange for an unknown or missing material", () => {
    expect(materialColour("unobtainium")).toBe(PATHWAY_FALLBACK);
    expect(materialColour(undefined)).toBe(PATHWAY_FALLBACK);
  });

  it("keeps every colour readable as text on white and under white text (≥ 4.5:1)", () => {
    for (const key of TYPES) expect(contrastOnWhite(materialColour(key)), key).toBeGreaterThanOrEqual(4.5);
  });
});

describe("entrance", () => {
  it("draws the lines one after the other and ends after the last ripple", () => {
    expect(revealWindow(1).start).toBe(revealWindow(0).start + REVEAL.staggerMs);
    expect(revealProgress(1, revealWindow(1).start)).toBe(0);
    expect(revealProgress(0, revealWindow(0).end)).toBe(1);
    expect(revealTotal(3)).toBe(revealWindow(2).end + REVEAL.rippleMs);
    expect(revealTotal(0)).toBe(REVEAL.parksMs);
  });

  it("shows a ripple only while it runs", () => {
    expect(ripple(LINE[2], 0, "#000000")).toEqual([]);
    expect(ripple(LINE[2], 1, "#000000")).toEqual([]);
    const [ring] = ripple(LINE[2], 0.5, "#000000");
    expect(ring.properties.k).toBe("ripple");
    expect(ring.properties.o).toBeGreaterThan(0);
  });
});

describe("comet", () => {
  it("has a tail that gets thinner and fainter away from its light", () => {
    const features = comet(LINE, 0.8, "#7c3aed", 1);
    const tail = features.filter((feature) => feature.properties.k === "trail");
    expect(tail).toHaveLength(FLOW.segments);
    for (let index = 1; index < tail.length; index++) {
      expect(tail[index].properties.o).toBeLessThan(tail[index - 1].properties.o);
      expect(tail[index].properties.w).toBeLessThan(tail[index - 1].properties.w);
    }
    expect(features.at(-1)?.properties.k).toBe("head");
    expect(features.every((feature) => feature.properties.c === "#7c3aed")).toBe(true);
  });

  it("has no tail behind the sender and nothing when faded out", () => {
    expect(comet(LINE, 0, "#7c3aed", 1).filter((feature) => feature.properties.k === "trail")).toHaveLength(0);
    expect(comet(LINE, 0.5, "#7c3aed", 0)).toEqual([]);
  });
});

describe("flowAt", () => {
  it("waits for its turn, travels, then sends a ripple at the receiver", () => {
    expect(flowAt(LINE, 0, FLOW.restMs - 1, "#000000")).toEqual([]);
    const travelling = flowAt(LINE, 0, FLOW.restMs + FLOW.tripMs / 2, "#000000");
    expect(travelling.some((feature) => feature.properties.k === "head")).toBe(true);
    const arriving = flowAt(LINE, 0, FLOW.restMs + FLOW.tripMs + 200, "#000000");
    expect(arriving.map((feature) => feature.properties.k)).toEqual(["ripple"]);
    expect(arriving[0].geometry.coordinates).toEqual(LINE[2]);
  });

  it("lets the lines take turns instead of starting together", () => {
    const at = FLOW.restMs + 100;
    expect(flowAt(LINE, 0, at, "#000000")).not.toEqual([]);
    expect(flowAt(LINE, 1, at, "#000000")).toEqual([]);
  });
});
