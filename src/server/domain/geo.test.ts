import { describe, expect, it } from "vitest";
import { coordinatesOf, distanceKm } from "./geo";

const kampLintfort = { latitude: 51.5131, longitude: 6.5672 };
const moers = { latitude: 51.4684, longitude: 6.6001 };

describe("straight-line distance (L1-014, D10)", () => {
  it("measures a known pair within 100 m", () => {
    const distance = distanceKm(kampLintfort, moers);
    expect(distance).toBeGreaterThan(5.3);
    expect(distance).toBeLessThan(5.6);
  });

  it("is symmetric and 0 for the same point", () => {
    expect(distanceKm(moers, kampLintfort)).toBe(distanceKm(kampLintfort, moers));
    expect(distanceKm(moers, moers)).toBe(0);
  });

  it("NT-L1-014: missing coordinates give an unknown distance, never 0", () => {
    expect(distanceKm(null, moers)).toBeNull();
    expect(distanceKm(kampLintfort, null)).toBeNull();
    expect(coordinatesOf({ latitude: 51.5, longitude: null })).toBeNull();
    expect(coordinatesOf({ latitude: null, longitude: null })).toBeNull();
  });

  it("keeps a real 0 coordinate (equator, prime meridian)", () => {
    expect(coordinatesOf({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0 });
  });
});
