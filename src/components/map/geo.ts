// Geometry for the interactive map (MapLibre): park areas and search radius as circles, pathways as gentle arcs,
// the initial view and markers that share one rounded position. Pure → tested on its own (geo.test.ts).

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

/**
 * Screen offsets in pixels for markers on exactly the same position (site positions are rounded to ~100 m, so two
 * sites can share one): they are placed on a small circle around it, the first one on top. Unique positions get [0, 0].
 */
export function sameSpotOffsets(points: GeoPoint[], spacingPx = 30): [number, number][] {
  const byKey = new Map<string, number[]>();
  points.forEach((point, index) => {
    const key = `${point.latitude},${point.longitude}`;
    byKey.set(key, [...(byKey.get(key) ?? []), index]);
  });
  const offsets: [number, number][] = points.map(() => [0, 0]);
  for (const members of byKey.values()) {
    if (members.length < 2) continue;
    // circumference ≥ members × spacing, so neighbours stay at least `spacingPx` apart
    const radius = Math.max((members.length * spacingPx) / (2 * Math.PI), spacingPx * 0.6);
    members.forEach((index, slot) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * slot) / members.length;
      offsets[index] = [Math.round(radius * Math.cos(angle)), Math.round(radius * Math.sin(angle))];
    });
  }
  return offsets;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;
