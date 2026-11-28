import { describe, expect, it } from "vitest";
import { pathwayAlpha, pathwayGradient } from "./pathway-style";

/** The stop positions of an interpolate expression (every second entry after the input). */
const positions = (expression: unknown[]) => expression.slice(3).filter((_, index) => index % 2 === 0) as number[];

describe("pathwayAlpha", () => {
  it("grows from the sender to the receiver", () => {
    expect(pathwayAlpha(0)).toBe(0.35);
    expect(pathwayAlpha(0.6)).toBe(0.8);
    expect(pathwayAlpha(1)).toBe(1);
    expect(pathwayAlpha(0.3)).toBeCloseTo(0.575);
  });
});

describe("pathwayGradient", () => {
  it("is the full gradient once drawn", () => {
    const expression = pathwayGradient(1) as unknown[];
    expect(positions(expression)).toEqual([0, 0.6, 1]);
    expect(expression.at(-1)).toBe("rgba(194, 65, 12, 1)");
  });

  it("ends in a transparent stop while it is still being drawn", () => {
    const expression = pathwayGradient(0.3) as unknown[];
    expect(positions(expression)).toEqual([0, 0.3, 0.3001]);
    expect(expression.at(-1)).toBe("rgba(255, 255, 255, 0)");
  });

  it("keeps the stops strictly ascending at the edges", () => {
    for (const progress of [-1, 0, 0.6, 0.9999, 2]) {
      const stops = positions(pathwayGradient(progress) as unknown[]);
      expect(stops.every((stop, index) => index === 0 || stop > stops[index - 1])).toBe(true);
    }
  });
});
