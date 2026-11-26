// Drawn map of the region (decision F2): industrial parks, sites and pathways placed by their coordinates, in the
// look of the start page map. No tile server and no map library – an SVG rendered on the server.
// Two drawings are rendered, one for wide and one for narrow screens, so labels keep a readable size on a phone
// instead of shrinking with the picture. Park names are listed under the map by letter; sites by number.
import Link from "next/link";
import type { ReactNode } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { fitProjection, scaleBar, spreadMarkers, type GeoPoint } from "./projection";

export type MapParkShape = GeoPoint & { id: number; name: string; city: string; radiusM: number };
export type MapMarker = GeoPoint & {
  id: number;
  /** Number shown in the marker, matching the list next to the map. */
  number: number;
  kind: "own" | "offers" | "plain";
  href: string;
  title: string;
  selected?: boolean;
};
export type MapPathway = { code: string; fromParkId: number | null; toParkId: number | null; title: string };

type Props = {
  parks: MapParkShape[];
  markers?: MapMarker[];
  pathways?: MapPathway[];
  /** Centre and radius of a wider search (straight line). */
  radius?: (GeoPoint & { km: number }) | null;
  label: string;
  t: PlatformMessages["map"];
  /** Link of a park letter (e.g. to search in that park). */
  parkHref?: (parkId: number) => string;
};

// Approximate reference points for orientation, drawn only where they fall into the picture.
const CITIES: (GeoPoint & { name: string })[] = [
  { name: "Kamp-Lintfort", latitude: 51.5, longitude: 6.533 },
  { name: "Moers", latitude: 51.451, longitude: 6.626 },
  { name: "Rheinberg", latitude: 51.546, longitude: 6.6 },
  { name: "Neukirchen-Vluyn", latitude: 51.441, longitude: 6.547 },
  { name: "Duisburg", latitude: 51.435, longitude: 6.762 },
];
const RHINE: GeoPoint[] = [
  { latitude: 51.33, longitude: 6.66 },
  { latitude: 51.405, longitude: 6.725 },
  { latitude: 51.455, longitude: 6.725 },
  { latitude: 51.52, longitude: 6.69 },
  { latitude: 51.575, longitude: 6.63 },
  { latitude: 51.64, longitude: 6.6 },
];

const letter = (index: number) => String.fromCharCode(65 + (index % 26));
const MARKER_RADIUS = 13;

function Drawing({ width, height, wide, parks, markers = [], pathways = [], radius, label, t, parkHref, className }: Props & { width: number; height: number; wide: boolean; className: string }) {
  const padding = wide ? 70 : 40;
  // The picture is fitted to parks and sites. A search radius far larger than that area is drawn as far as it
  // falls into the picture – fitting the whole circle would squeeze everything into the centre.
  const extent: GeoPoint[] = [...parks, ...markers];
  const projection = fitProjection(extent, width, height, padding);
  const inside = (point: { x: number; y: number }, margin = 0) => point.x >= margin && point.x <= width - margin && point.y >= margin && point.y <= height - margin;
  const placedMarkers = spreadMarkers(markers.map((marker) => ({ ...marker, ...projection.point(marker) })), MARKER_RADIUS * 2 + 4);
  const placedParks = parks.map((park, index) => {
    const centre = projection.point(park);
    const circle = Math.max((park.radiusM / 1000) * projection.pxPerKm, 16);
    // r = how far the park reaches upwards and sideways in the drawing: its circle, or the markers standing on it
    const reach = placedMarkers
      .map((marker) => ({ distance: Math.hypot(marker.x - centre.x, marker.y - centre.y) }))
      .filter((marker) => marker.distance < circle + MARKER_RADIUS * 2)
      .map((marker) => marker.distance + MARKER_RADIUS + 3);
    return { ...park, ...centre, letter: letter(index), circle, r: Math.max(circle, ...reach) };
  });
  const bar = scaleBar(projection.pxPerKm, wide ? 140 : 90);
  const rhine = RHINE.map((point) => projection.point(point));
  const parkById = new Map(placedParks.map((park) => [park.id, park]));
  // Pathways: a curve between two parks with the case letter on it; a case inside one park or without a receiver
  // gets only its letter, hung below the park (the park's own letter is above).
  const hanging = new Map<number, number>();
  type DrawnPathway = MapPathway & { path: string | null; badge: { x: number; y: number } };
  const drawnPathways = pathways.flatMap((pathway, index): DrawnPathway[] => {
    const from = pathway.fromParkId != null ? parkById.get(pathway.fromParkId) : undefined;
    const to = pathway.toParkId != null ? parkById.get(pathway.toParkId) : undefined;
    if (!from) return [];
    if (!to || to.id === from.id) {
      const slot = hanging.get(from.id) ?? 0;
      hanging.set(from.id, slot + 1);
      const angle = Math.PI / 2 + (slot % 2 === 0 ? -1 : 1) * Math.ceil(slot / 2) * 0.85 - 0.42;
      return [{ ...pathway, path: null, badge: { x: from.x + (from.r + 17) * Math.cos(angle), y: from.y + (from.r + 17) * Math.sin(angle) } }];
    }
    // a gentle curve, bent to one side so two pathways between the same parks do not cover each other
    const bend = 0.18 + index * 0.06;
    const mid = { x: (from.x + to.x) / 2 - (to.y - from.y) * bend, y: (from.y + to.y) / 2 + (to.x - from.x) * bend };
    const shorten = (park: { x: number; y: number; circle: number }, towards: { x: number; y: number }) => {
      const length = Math.hypot(towards.x - park.x, towards.y - park.y) || 1;
      return { x: park.x + ((towards.x - park.x) / length) * (park.circle + 4), y: park.y + ((towards.y - park.y) / length) * (park.circle + 4) };
    };
    const start = shorten(from, mid);
    const end = shorten(to, mid);
    return [{ ...pathway, path: `M${start.x} ${start.y} Q${mid.x} ${mid.y} ${end.x} ${end.y}`, badge: { x: (start.x + 2 * mid.x + end.x) / 4, y: (start.y + 2 * mid.y + end.y) / 4 } }];
  });

  // Labels are placed greedily: a park name or city name is drawn only where it touches nothing that is already
  // there (letters, markers, other park areas, earlier labels). All names are in the list under the map.
  type Box = { left: number; right: number; top: number; bottom: number };
  const hits = (first: Box, second: Box) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
  const badgeOf = (park: { x: number; y: number; r: number }): Box => ({ left: park.x - 15, right: park.x + 15, top: park.y - park.r - 29, bottom: park.y - park.r + 1 });
  const areaOf = (park: { x: number; y: number; r: number }): Box => ({ left: park.x - park.r, right: park.x + park.r, top: park.y - park.r, bottom: park.y + park.r });
  const taken: Box[] = [
    ...placedParks.map(badgeOf),
    ...placedMarkers.map((marker) => ({ left: marker.x - MARKER_RADIUS - 3, right: marker.x + MARKER_RADIUS + 3, top: marker.y - MARKER_RADIUS - 3, bottom: marker.y + MARKER_RADIUS + 3 })),
    ...drawnPathways.map((pathway) => ({ left: pathway.badge.x - 15, right: pathway.badge.x + 15, top: pathway.badge.y - 15, bottom: pathway.badge.y + 15 })),
  ];
  const parkLabels = new Map<number, { x: number; anchor: "start" | "end" }>();
  if (wide) {
    for (const park of placedParks) {
      const textWidth = park.name.length * 7.6;
      const y = park.y - park.r - 9;
      const others = placedParks.filter((other) => other.id !== park.id).map(areaOf);
      const options = [
        { x: park.x + 20, anchor: "start" as const, box: { left: park.x + 18, right: park.x + 24 + textWidth, top: y - 14, bottom: y + 6 } },
        { x: park.x - 20, anchor: "end" as const, box: { left: park.x - 24 - textWidth, right: park.x - 18, top: y - 14, bottom: y + 6 } },
      ];
      const free = options.find((option) => option.box.left > 6 && option.box.right < width - 6 && option.box.top > 4 && ![...taken, ...others].some((other) => hits(option.box, other)));
      if (free) {
        parkLabels.set(park.id, free);
        taken.push(free.box);
      }
    }
  }
  taken.push(...placedParks.map(areaOf));
  const cities = CITIES.map((city) => ({ ...city, ...projection.point(city) })).filter((city) => {
    if (!inside(city, 24)) return false;
    const end = city.x > width - 150;
    const box = { left: end ? city.x - 10 - city.name.length * 7.6 : city.x - 5, right: end ? city.x + 5 : city.x + 10 + city.name.length * 7.6, top: city.y - 13, bottom: city.y + 11 };
    if (taken.some((other) => hits(box, other))) return false;
    taken.push(box);
    return true;
  });
  const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

  const wrap = (href: string | undefined, title: string, children: ReactNode, key: string | number) =>
    href ? (
      <Link key={key} href={href} aria-label={title} className="outline-offset-4">
        {children}
      </Link>
    ) : (
      <g key={key}>{children}</g>
    );

  return (
    // data-audit-ignore: everything inside is placed by geographic coordinates, not by the page layout – collisions
    // are handled in this file (spreadMarkers, the city name check above) and tested in projection.test.ts.
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-audit-ignore className={`w-full rounded-2xl bg-map ${className}`}>
      <defs>
        <marker id={`arrow-${wide ? "w" : "n"}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-ink)" />
        </marker>
      </defs>

      {/* quiet land patches and the river for orientation */}
      <g fill="var(--color-map-land)" opacity={0.7}>
        <path d={`M0 ${height * 0.62} L${width * 0.3} ${height * 0.48} L${width * 0.52} ${height * 0.8} L${width * 0.38} ${height} L0 ${height} Z`} />
        <path d={`M${width * 0.6} 0 L${width} 0 L${width} ${height * 0.34} L${width * 0.78} ${height * 0.3} Z`} />
      </g>
      <polyline points={rhine.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#b9cfbd" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      {rhine.slice(1, -1).filter((point) => inside(point, 40)).slice(0, 1).map((point) => (
        <text key="rhine" x={point.x + 12} y={point.y + 4} fontSize={13} fontStyle="italic" fill="var(--color-map-ink)">
          {t.rhine}
        </text>
      ))}

      {radius && (
        <circle cx={projection.x(radius.longitude)} cy={projection.y(radius.latitude)} r={radius.km * projection.pxPerKm} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.6} />
      )}

      <g fontSize={13} fill="var(--color-map-ink)">
        {cities.map((city) => (
          <g key={city.name}>
            <circle cx={city.x} cy={city.y} r={2.5} />
            <text x={city.x > width - 150 ? city.x - 8 : city.x + 8} y={city.y + 4} textAnchor={city.x > width - 150 ? "end" : "start"}>
              {city.name}
            </text>
          </g>
        ))}
      </g>

      {/* park areas: approximate circles with a letter; names are in the list under the map */}
      {placedParks.map((park) =>
        wrap(
          parkHref?.(park.id),
          `${park.letter}: ${park.name}, ${park.city}`,
          <>
            <circle cx={park.x} cy={park.y} r={park.circle} fill="#fff" fillOpacity={0.55} stroke="var(--color-map-ink)" strokeWidth={1.5} strokeDasharray="3 4" />
            <g transform={`translate(${park.x} ${park.y - park.r - 14})`}>
              <rect x={-12} y={-12} width={24} height={24} rx={6} fill="var(--color-brand)" />
              <text textAnchor="middle" y={5} fontSize={14} fontWeight={600} fill="#fff">
                {park.letter}
              </text>
            </g>
            {parkLabels.has(park.id) && (
              <text
                x={parkLabels.get(park.id)!.x}
                y={park.y - park.r - 9}
                textAnchor={parkLabels.get(park.id)!.anchor}
                fontSize={13}
                fontWeight={600}
                fill="var(--color-ink)"
                stroke="var(--color-map)"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {park.name}
              </text>
            )}
          </>,
          `park-${park.id}`,
        ),
      )}

      {/* simulated pathways between park areas */}
      {drawnPathways.map((pathway) => (
        <g key={pathway.code}>
          <title>{pathway.title}</title>
          {pathway.path && <path d={pathway.path} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeDasharray="7 5" markerEnd={`url(#arrow-${wide ? "w" : "n"})`} />}
          <g transform={`translate(${pathway.badge.x} ${pathway.badge.y})`}>
            <circle r={12} fill="#fff" stroke="var(--color-ink)" strokeWidth={1.5} />
            <text textAnchor="middle" y={5} fontSize={13} fontWeight={600} fill="var(--color-ink)">
              {pathway.code}
            </text>
          </g>
        </g>
      ))}

      {/* sites: numbered markers; a marker moved aside keeps a line to its position */}
      {placedMarkers.map((marker) =>
        wrap(
          marker.href,
          `${marker.number}: ${marker.title}`,
          <>
            {marker.anchor && <line x1={marker.anchor.x} y1={marker.anchor.y} x2={marker.x} y2={marker.y} stroke="var(--color-ink)" strokeWidth={1} />}
            {marker.anchor && <circle cx={marker.anchor.x} cy={marker.anchor.y} r={2.5} fill="var(--color-ink)" />}
            {marker.selected && <circle cx={marker.x} cy={marker.y} r={MARKER_RADIUS + 5} fill="none" stroke="var(--color-ink)" strokeWidth={2} />}
            <circle
              cx={marker.x}
              cy={marker.y}
              r={MARKER_RADIUS}
              fill={marker.kind === "plain" ? "#fff" : "var(--color-brand)"}
              stroke={marker.kind === "own" ? "#fff" : "var(--color-ink)"}
              strokeWidth={marker.kind === "own" ? 3 : 1.5}
              strokeDasharray={marker.kind === "own" ? "4 3" : undefined}
            />
            <text x={marker.x} y={marker.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={600} fill={marker.kind === "plain" ? "var(--color-ink)" : "#fff"}>
              {marker.number}
            </text>
          </>,
          `marker-${marker.id}`,
        ),
      )}

      <g transform={`translate(${width - bar.px - 24} ${height - 22})`} fill="var(--color-map-ink)">
        <path d={`M0 0 H${bar.px}`} stroke="var(--color-map-ink)" strokeWidth={3} strokeLinecap="round" />
        <text x={bar.px} y={-8} textAnchor="end" fontSize={13}>
          {number.format(bar.km)} km
        </text>
      </g>
    </svg>
  );
}

export function RegionMap(props: Props) {
  return (
    <figure className="grid gap-3">
      <Drawing {...props} width={830} height={480} wide className="hidden md:block" />
      <Drawing {...props} width={340} height={420} wide={false} className="md:hidden" />
      <figcaption className="grid gap-2">
        <ul className="grid gap-x-6 gap-y-1 text-[13px] leading-normal sm:grid-cols-2">
          {props.parks.map((park, index) => (
            <li key={park.id} className="flex items-start gap-2">
              <span className="grid size-5 flex-none place-items-center rounded bg-brand text-[13px] leading-none font-semibold text-white">{letter(index)}</span>
              <span>
                {park.name}, {park.city}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] leading-normal text-muted">{props.t.approx}</p>
      </figcaption>
    </figure>
  );
}
