import { describe, expect, it } from "vitest";
import { distanceKm } from "@/server/domain/geo";
import { arc, boundsOf, circleRing, pointAlong, sliceAlong, spreadOffsets } from "./geo";

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

describe("spreadOffsets", () => {
  const placed = (points: [number, number][], offsets: [number, number][]) => points.map(([x, y], index) => [x + offsets[index][0], y + offsets[index][1]]);
  const minDistance = (points: number[][]) => {
    let min = Infinity;
    for (let a = 0; a < points.length; a += 1) for (let b = a + 1; b < points.length; b += 1) min = Math.min(min, Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]));
    return min;
  };

  it("leaves lone markers alone and spreads markers on the same spot at least the spacing apart", () => {
    const points: [number, number][] = [[100, 100], [400, 300], [100, 100], [100, 100]];
    const offsets = spreadOffsets(points, 30);
    expect(offsets[1]).toEqual([0, 0]);
    expect(minDistance(placed([points[0], points[2], points[3]], [offsets[0], offsets[2], offsets[3]]))).toBeGreaterThanOrEqual(29);
    expect(offsets[0][1]).toBeLessThan(0); // the first one on top
  });

  // Bug 2026-11-27: on /map marker 1 sat under marker 2 in the Genend park – their rounded positions differed, so
  // the old same-position check left both where they were, 20 px apart on screen.
  it("also spreads markers that are close but not on the same spot, including chains", () => {
    const points: [number, number][] = [[200, 200], [212, 216], [230, 230], [600, 200]];
    const offsets = spreadOffsets(points, 34);
    expect(offsets[3]).toEqual([0, 0]);
    expect(minDistance(placed(points.slice(0, 3), offsets.slice(0, 3)))).toBeGreaterThanOrEqual(33);
  });

  // Found by the CDP probe on /map (zoomed out): spreading markers 2 and 4 pushed 2 to 28 px from marker 3.
  it("merges a spread group with a marker it would come too close to", () => {
    const points: [number, number][] = [[300, 300], [300, 310], [300, 255]];
    const offsets = spreadOffsets(points, 34);
    expect(minDistance(placed(points, offsets))).toBeGreaterThanOrEqual(33);
  });

  it("keeps larger groups apart too (4 to 8 markers on one spot)", () => {
    for (let count = 4; count <= 8; count += 1) {
      const points = Array.from({ length: count }, (): [number, number] => [500, 500]);
      expect(minDistance(placed(points, spreadOffsets(points, 34)))).toBeGreaterThanOrEqual(33);
    }
  });

  it("changes nothing when all markers are far enough apart", () => {
    expect(spreadOffsets([[0, 0], [40, 0], [0, 40]], 34)).toEqual([[0, 0], [0, 0], [0, 0]]);
  });
});

describe("pointAlong", () => {
  const line: [number, number][] = [[6.5, 51.5], [6.6, 51.5], [6.6, 51.6]];
  it("starts at the first point, ends at the last and clamps outside 0…1", () => {
    expect(pointAlong(line, 0)).toEqual(line[0]);
    expect(pointAlong(line, -1)).toEqual(line[0]);
    expect(pointAlong(line, 1)).toEqual(line[2]);
    expect(pointAlong(line, 2)).toEqual(line[2]);
  });
  it("moves at an even speed along the length, not per point", () => {
    // east leg is 0.1° × cos(51.5°) ≈ 0.062 wide, north leg 0.1 high → the corner lies at ≈ 38 % of the length
    const corner = 0.0622 / (0.0622 + 0.1);
    const [longitude, latitude] = pointAlong(line, corner);
    expect(longitude).toBeCloseTo(6.6, 3);
    expect(latitude).toBeCloseTo(51.5, 3);
    expect(pointAlong(line, 0.9)[1]).toBeGreaterThan(51.5);
  });
  it("follows an arc from start to end", () => {
    const { line: curve } = arc(KAMP_LINTFORT, MOERS);
    expect(pointAlong(curve, 0)).toEqual(curve[0]);
    expect(pointAlong(curve, 1)).toEqual(curve[curve.length - 1]);
  });
});

describe("sliceAlong", () => {
  const line: [number, number][] = [
    [6.5, 51.5],
    [6.55, 51.5],
    [6.6, 51.5],
  ];

  it("cuts a part of the line and keeps the corners in between", () => {
    const part = sliceAlong(line, 0.25, 0.75);
    expect(part).toHaveLength(3);
    expect(part[0][0]).toBeCloseTo(6.525, 6);
    expect(part[1]).toEqual(line[1]);
    expect(part[2][0]).toBeCloseTo(6.575, 6);
  });

  it("clamps to the line and accepts the ends in either order", () => {
    expect(sliceAlong(line, -1, 2)).toEqual(line);
    expect(sliceAlong(line, 0.75, 0.25)[0][0]).toBeCloseTo(6.525, 6);
  });
});
