// Geometry for the interactive map (MapLibre): park areas and search radius as circles, pathways as gentle arcs,
// the initial view and markers that would cover each other on screen. Pure → tested on its own (geo.test.ts).

export type GeoPoint = { latitude: number; longitude: number };
/** GeoJSON order: [longitude, latitude]. */
export type Position = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Closed ring of `steps` points at `radiusM` around `centre` (great-circle destination, exact enough for a region). */
export function circleRing(centre: GeoPoint, radiusM: number, steps = 64): Position[] {
  const lat = toRadians(centre.latitude);
  const lon = toRadians(centre.longitude);
  const angular = radiusM / EARTH_RADIUS_M;
  const ring: Position[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const bearing = (2 * Math.PI * (step % steps)) / steps;
    const pointLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
    const pointLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat));
    ring.push([round(toDegrees(pointLon)), round(toDegrees(pointLat))]);
  }
  return ring;
}

/**
 * A quadratic curve from `from` to `to`, bent sideways by `bend` × the distance, so two pathways between the same
 * parks do not cover each other. Returns the points and the middle of the curve (for the label).
 */
export function arc(from: GeoPoint, to: GeoPoint, bend = 0.2, steps = 32): { line: Position[]; middle: Position } {
  // work in a local plane with equal scale in both directions
  const scale = Math.cos(toRadians((from.latitude + to.latitude) / 2));
  const a = { x: from.longitude * scale, y: from.latitude };
  const b = { x: to.longitude * scale, y: to.latitude };
  const control = { x: (a.x + b.x) / 2 - (b.y - a.y) * bend, y: (a.y + b.y) / 2 + (b.x - a.x) * bend };
  const at = (t: number): Position => {
    const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x;
    const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y;
    return [round(x / scale), round(y)];
  };
  return { line: Array.from({ length: steps + 1 }, (_, index) => at(index / steps)), middle: at(0.5) };
}

/**
 * The point at `fraction` (0…1, clamped) of a line, measured along its length, so a dot moves at an even speed.
 * Longitude is scaled by cos(latitude) like in arc(); at a few kilometres the plane is exact enough.
 */
export function pointAlong(line: Position[], fraction: number): Position {
  if (line.length < 2) return line[0];
  const scale = Math.cos(toRadians(line[0][1]));
  const lengths = line.slice(1).map((next, index) => Math.hypot((next[0] - line[index][0]) * scale, next[1] - line[index][1]));
  let rest = Math.min(Math.max(fraction, 0), 1) * lengths.reduce((sum, length) => sum + length, 0);
  for (let index = 0; index < lengths.length; index++) {
    if (rest <= lengths[index] || index === lengths.length - 1) {
      const share = lengths[index] > 0 ? Math.min(rest / lengths[index], 1) : 0;
      const [a, b] = [line[index], line[index + 1]];
      return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
    }
    rest -= lengths[index];
  }
  return line[line.length - 1];
}

/**
 * South-west and north-east corner around all points, widened by each point's `radiusM` (park areas) and by at
 * least `minSpanM`, so a single site does not zoom into one building. Null without points.
 */
export function boundsOf(points: (GeoPoint & { radiusM?: number })[], minSpanM = 3000): [Position, Position] | null {
  if (points.length === 0) return null;
  const metresPerDegreeLat = (Math.PI * EARTH_RADIUS_M) / 180;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const point of points) {
    const metresPerDegreeLon = metresPerDegreeLat * Math.cos(toRadians(point.latitude));
    const dLat = (point.radiusM ?? 0) / metresPerDegreeLat;
    const dLon = (point.radiusM ?? 0) / metresPerDegreeLon;
    south = Math.min(south, point.latitude - dLat);
    north = Math.max(north, point.latitude + dLat);
    west = Math.min(west, point.longitude - dLon);
    east = Math.max(east, point.longitude + dLon);
  }
  const centre = { latitude: (south + north) / 2, longitude: (west + east) / 2 };
  const halfLat = Math.max((north - south) / 2, minSpanM / 2 / metresPerDegreeLat);
  const halfLon = Math.max((east - west) / 2, minSpanM / 2 / (metresPerDegreeLat * Math.cos(toRadians(centre.latitude))));
  return [
    [round(centre.longitude - halfLon), round(centre.latitude - halfLat)],
    [round(centre.longitude + halfLon), round(centre.latitude + halfLat)],
  ];
}

/** A position on screen in pixels: [x, y] (MapLibre `map.project`). */
export type ScreenPoint = [number, number];

/**
 * Screen offsets in pixels that keep markers at least `spacingPx` apart: markers closer than that on screen (also
 * chains of them) form a group, which is placed on a small circle around its centre, the first one on top. A group
 * that lands too close to another marker after spreading is merged with it and spread again. Lone markers get
 * [0, 0]. Recomputed after every zoom, because the distance on screen changes with the zoom.
 */
export function spreadOffsets(points: ScreenPoint[], spacingPx = 34): [number, number][] {
  // union-find: a few dozen markers → comparing all pairs is cheap
  const parent = points.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const tooClose = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < spacingPx - 0.5;
  for (let a = 0; a < points.length; a += 1) for (let b = a + 1; b < points.length; b += 1) if (tooClose(points[a], points[b])) parent[find(b)] = find(a);

  let placed = points;
  // groups only ever merge, so this ends after at most one round per marker
  for (let round = 0; round < points.length; round += 1) {
    placed = placeGroups(points, find, spacingPx);
    let merged = false;
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        if (find(a) !== find(b) && tooClose(placed[a], placed[b])) {
          parent[find(b)] = find(a);
          merged = true;
        }
      }
    }
    if (!merged) break;
  }
  return points.map((point, index) => [Math.round(placed[index][0] - point[0]), Math.round(placed[index][1] - point[1])]);
}

/** Each group of two or more on a circle around its centre; neighbours on the circle are `spacingPx` apart. */
function placeGroups(points: ScreenPoint[], groupOf: (index: number) => number, spacingPx: number): ScreenPoint[] {
  const groups = new Map<number, number[]>();
  points.forEach((_, index) => groups.set(groupOf(index), [...(groups.get(groupOf(index)) ?? []), index]));
  const placed = [...points];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const centre = [0, 1].map((axis) => members.reduce((sum, index) => sum + points[index][axis], 0) / members.length);
    // chord between neighbours = 2 r sin(π / n) = spacing
    const radius = Math.max(spacingPx / (2 * Math.sin(Math.PI / members.length)), spacingPx * 0.6);
    members.forEach((index, slot) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * slot) / members.length;
      placed[index] = [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
    });
  }
  return placed;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;
