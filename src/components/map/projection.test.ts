import { describe, expect, it } from "vitest";
import { distanceKm } from "@/server/domain/geo";
import { fitProjection, scaleBar, spreadMarkers } from "./projection";

const nordKamperbruch = { latitude: 51.5125, longitude: 6.566 };
const genend = { latitude: 51.468, longitude: 6.599 };
const niederrhein = { latitude: 51.419, longitude: 6.683 };
const parks = [nordKamperbruch, genend, niederrhein];

describe("fitProjection (F2: positions by real coordinates)", () => {
  const projection = fitProjection(parks, 830, 480, 60);

  it("keeps every point inside the padded drawing area", () => {
    for (const park of parks) {
      const { x, y } = projection.point(park);
      expect(x).toBeGreaterThanOrEqual(59.9);
      expect(x).toBeLessThanOrEqual(770.1);
      expect(y).toBeGreaterThanOrEqual(59.9);
      expect(y).toBeLessThanOrEqual(420.1);
    }
  });

  it("puts north at the top and east on the right", () => {
    expect(projection.point(nordKamperbruch).y).toBeLessThan(projection.point(genend).y);
    expect(projection.point(niederrhein).x).toBeGreaterThan(projection.point(genend).x);
  });

  it("is true to scale: drawn distances match the straight-line distance", () => {
    const a = projection.point(nordKamperbruch);
    const b = projection.point(niederrhein);
    const drawnKm = Math.hypot(a.x - b.x, a.y - b.y) / projection.pxPerKm;
    expect(drawnKm).toBeCloseTo(distanceKm(nordKamperbruch, niederrhein)!, 0);
  });

  it("does not zoom into a single point", () => {
    const single = fitProjection([genend], 830, 480, 60);
    expect(single.pxPerKm).toBeCloseTo(60, 5); // (480 − 120) px for the minimum span of 6 km
    expect(single.point(genend)).toEqual({ x: 415, y: 240 });
  });

  it("copes with no points at all", () => {
    expect(Number.isFinite(fitProjection([], 340, 440, 30).pxPerKm)).toBe(true);
  });
});

describe("spreadMarkers", () => {
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it("leaves markers alone that do not touch", () => {
    const placed = spreadMarkers([{ id: 1, x: 100, y: 100 }, { id: 2, x: 200, y: 100 }], 26);
    expect(placed).toEqual([{ id: 1, x: 100, y: 100, anchor: null }, { id: 2, x: 200, y: 100, anchor: null }]);
  });

  it("moves overlapping markers apart and remembers where they belong", () => {
    const placed = spreadMarkers([{ id: 1, x: 100, y: 100 }, { id: 2, x: 104, y: 102 }, { id: 3, x: 98, y: 97 }, { id: 4, x: 400, y: 300 }], 26);
    for (let a = 0; a < 3; a += 1) for (let b = a + 1; b < 3; b += 1) expect(distance(placed[a], placed[b])).toBeGreaterThanOrEqual(25.9);
    expect(placed[0].anchor).toEqual({ x: 100, y: 100 });
    expect(placed[3]).toEqual({ id: 4, x: 400, y: 300, anchor: null });
  });

  it("two markers at the very same position end up a full marker apart", () => {
    const placed = spreadMarkers([{ x: 50, y: 50 }, { x: 50, y: 50 }], 26);
    expect(distance(placed[0], placed[1])).toBeGreaterThanOrEqual(26);
  });
});

describe("scaleBar", () => {
  it("picks a round length that fits", () => {
    expect(scaleBar(30, 120)).toEqual({ km: 2, px: 60 });
    expect(scaleBar(60, 120)).toEqual({ km: 2, px: 120 });
    expect(scaleBar(600, 120)).toEqual({ km: 0.2, px: 120 });
  });
});
