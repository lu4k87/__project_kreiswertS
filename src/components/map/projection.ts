// Geometry of the drawn map (decision F2: own map, no tile server): fits real coordinates into a drawing area and
// keeps markers that would lie on top of each other apart. Pure → tested on its own (projection.test.ts).

export type GeoPoint = { latitude: number; longitude: number };

const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;

export type Projection = {
  width: number;
  height: number;
  pxPerKm: number;
  x: (longitude: number) => number;
  y: (latitude: number) => number;
  point: (point: GeoPoint) => { x: number; y: number };
};

/**
 * Projection that shows all `points` inside `width` × `height` with `padding` pixels of margin, north up and with the
 * same scale in both directions (an equirectangular projection around the centre – exact enough for a region).
 * `minSpanKm` keeps the map from zooming into a single building when all points are close together.
 */
export function fitProjection(points: GeoPoint[], width: number, height: number, padding: number, minSpanKm = 6): Projection {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const centre = {
    latitude: points.length ? (Math.min(...latitudes) + Math.max(...latitudes)) / 2 : 0,
    longitude: points.length ? (Math.min(...longitudes) + Math.max(...longitudes)) / 2 : 0,
  };
  const kmPerDegreeLongitude = KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos((centre.latitude * Math.PI) / 180);
  const spanX = points.length ? (Math.max(...longitudes) - Math.min(...longitudes)) * kmPerDegreeLongitude : 0;
  const spanY = points.length ? (Math.max(...latitudes) - Math.min(...latitudes)) * KM_PER_DEGREE_LATITUDE : 0;
  const pxPerKm = Math.min((width - 2 * padding) / Math.max(spanX, minSpanKm), (height - 2 * padding) / Math.max(spanY, minSpanKm));
  const x = (longitude: number) => width / 2 + (longitude - centre.longitude) * kmPerDegreeLongitude * pxPerKm;
  const y = (latitude: number) => height / 2 - (latitude - centre.latitude) * KM_PER_DEGREE_LATITUDE * pxPerKm;
  return { width, height, pxPerKm, x, y, point: (point) => ({ x: x(point.longitude), y: y(point.latitude) }) };
}

export type Placed<T> = T & { x: number; y: number; /** true position when the marker was moved aside */ anchor: { x: number; y: number } | null };

/**
 * Markers closer than `minDistance` are arranged on a small circle around their common centre, each keeping a line
 * to its true position. Positions are only moved for drawing – the data is untouched.
 */
export function spreadMarkers<T extends { x: number; y: number }>(markers: T[], minDistance: number): Placed<T>[] {
  const group = markers.map((_, index) => index);
  const find = (index: number): number => (group[index] === index ? index : (group[index] = find(group[index])));
  for (let a = 0; a < markers.length; a += 1) {
    for (let b = a + 1; b < markers.length; b += 1) {
      if (Math.hypot(markers[a].x - markers[b].x, markers[a].y - markers[b].y) < minDistance) group[find(a)] = find(b);
    }
  }
  return markers.map((marker, index) => {
    const members = markers.map((_, other) => other).filter((other) => find(other) === find(index));
    if (members.length === 1) return { ...marker, anchor: null };
    const centre = {
      x: members.reduce((sum, member) => sum + markers[member].x, 0) / members.length,
      y: members.reduce((sum, member) => sum + markers[member].y, 0) / members.length,
    };
    // circumference ≥ members × minDistance, so neighbours on the circle are at least minDistance apart
    const radius = Math.max((members.length * minDistance) / (2 * Math.PI), minDistance * 0.6);
    const angle = -Math.PI / 2 + (2 * Math.PI * members.indexOf(index)) / members.length;
    return { ...marker, x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle), anchor: { x: marker.x, y: marker.y } };
  });
}

/** A round length for the scale bar (1, 2, 5, 10 … km) that is at most `maxPx` wide. */
export function scaleBar(pxPerKm: number, maxPx: number): { km: number; px: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const km = [...steps].reverse().find((step) => step * pxPerKm <= maxPx) ?? steps[0];
  return { km, px: km * pxPerKm };
}
