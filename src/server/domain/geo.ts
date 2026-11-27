// Straight-line distance between two sites (L1-014, D10). Labelled as such in the UI – it is not a road distance.
// Pure → also used by the map in the browser.

export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Haversine distance in km, one decimal. null when either point is unknown – a distance is never invented. */
export function distanceKm(a: Coordinates | null, b: Coordinates | null): number | null {
  if (!a || !b) return null;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

/** Coordinates of a row, or null when the pair is incomplete. */
export function coordinatesOf(row: { latitude: number | null; longitude: number | null }): Coordinates | null {
  return row.latitude == null || row.longitude == null ? null : { latitude: row.latitude, longitude: row.longitude };
}
