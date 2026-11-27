import { describe, expect, it } from "vitest";
import { distanceKm } from "@/server/domain/geo";
import { arc, boundsOf, circleRing, sameSpotOffsets } from "./geo";

const KAMP_LINTFORT = { latitude: 51.5, longitude: 6.533 };
const MOERS = { latitude: 51.451, longitude: 6.626 };
const point = ([longitude, latitude]: [number, number]) => ({ latitude, longitude });

describe("circleRing", () => {
  it("is closed and every point lies at the radius", () => {
    const ring = circleRing(KAMP_LINTFORT, 700, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const position of ring) expect(distanceKm(KAMP_LINTFORT, point(position))).toBeCloseTo(0.7, 2);
  });
});

describe("arc", () => {
  it("starts and ends at the two places and bends away from the straight line", () => {
    const { line, middle } = arc(KAMP_LINTFORT, MOERS, 0.2);
    expect(point(line[0]).latitude).toBeCloseTo(KAMP_LINTFORT.latitude, 5);
    expect(point(line[line.length - 1]).longitude).toBeCloseTo(MOERS.longitude, 5);
    const straightMiddle = { latitude: (KAMP_LINTFORT.latitude + MOERS.latitude) / 2, longitude: (KAMP_LINTFORT.longitude + MOERS.longitude) / 2 };
    expect(distanceKm(straightMiddle, point(middle))).toBeGreaterThan(0.5);
  });
});

describe("boundsOf", () => {
  it("contains every point with its area", () => {
    const [[west, south], [east, north]] = boundsOf([{ ...KAMP_LINTFORT, radiusM: 700 }, MOERS])!;
    expect(south).toBeLessThanOrEqual(MOERS.latitude);
    expect(north).toBeGreaterThan(KAMP_LINTFORT.latitude + 0.006);
    expect(west).toBeLessThan(KAMP_LINTFORT.longitude - 0.009);
    expect(east).toBeGreaterThanOrEqual(MOERS.longitude);
  });

  it("keeps a minimum span around a single point and is null without points", () => {
    const [[west, south], [east, north]] = boundsOf([KAMP_LINTFORT], 3000)!;
    expect(distanceKm({ latitude: south, longitude: KAMP_LINTFORT.longitude }, { latitude: north, longitude: KAMP_LINTFORT.longitude })).toBeCloseTo(3, 1);
    expect(distanceKm({ latitude: KAMP_LINTFORT.latitude, longitude: west }, { latitude: KAMP_LINTFORT.latitude, longitude: east })).toBeCloseTo(3, 1);
    expect(boundsOf([])).toBeNull();
  });
});

describe("sameSpotOffsets", () => {
  it("leaves unique positions alone and spreads shared ones at least the spacing apart", () => {
    const offsets = sameSpotOffsets([KAMP_LINTFORT, MOERS, KAMP_LINTFORT, KAMP_LINTFORT], 30);
    expect(offsets[1]).toEqual([0, 0]);
    const shared = [offsets[0], offsets[2], offsets[3]];
    for (let a = 0; a < shared.length; a += 1) {
      for (let b = a + 1; b < shared.length; b += 1) {
        expect(Math.hypot(shared[a][0] - shared[b][0], shared[a][1] - shared[b][1])).toBeGreaterThanOrEqual(29);
      }
    }
    expect(offsets[0][1]).toBeLessThan(0); // the first one on top
  });
});
