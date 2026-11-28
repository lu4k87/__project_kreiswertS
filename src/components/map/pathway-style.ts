// Look and motion of the pathway lines. Glass look (user choice 2026-11-28, preview "Karte: transparenter,
// professioneller Look", Karte:A): pale at the sender, full at the receiver, so the direction reads without arrows.
// One colour per material (user, 2026-11-28: "other materials, other colour; make the animation more professional"):
// the lines draw themselves one after the other with a light at the tip and a ripple on arrival; afterwards a comet
// with a tapering tail in the material's colour leaves the sender, glides into the receiver and sends a ripple there.
// Pure (no browser) → pathway-style.test.ts.
import type { ExpressionSpecification } from "maplibre-gl";
import { pointAlong, sliceAlong, type Position } from "./geo";

/** Line of a pathway whose material is not known (the former single pathway colour, --color-map-flow). */
export const PATHWAY_FALLBACK = "#c2410c";

/**
 * Colour per material type. A family shares one colour (all polyethylenes). Every colour carries white text and reads
 * as text on white (≥ 4.5:1, tested); none comes close to the park green or the radius blue of the map.
 */
const MATERIAL_COLOURS: Record<string, string> = {
  hdpe: "#0e7490", // cyan-700: polyethylene family
  ldpe: "#0e7490",
  lldpe: "#0e7490",
  pp: "#b45309", // amber-700
  pet: "#4338ca", // indigo-700
  pc: "#7c3aed", // violet-600
  pmma: "#a21caf", // fuchsia-700
  pvc: "#be185d", // pink-700
  abs: "#854d0e", // yellow-800
  ps: "#0369a1", // sky-700
  other: "#57534e", // stone-600
  mixed: "#475569", // slate-600: no single material
  unknown: "#475569",
  aluminium: "#52525b", // zinc-600
  steel: "#334155", // slate-700
  copper: "#9a3412", // orange-800
};

export function materialColour(key: string | null | undefined): string {
  return (key && MATERIAL_COLOURS[key]) || PATHWAY_FALLBACK;
}

/** White wash over the line, strong at the sender and gone at the receiver (`line-gradient`, needs `lineMetrics`). */
export const PATHWAY_WASH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  "rgba(255, 255, 255, 0.62)",
  0.55,
  "rgba(255, 255, 255, 0.16)",
  1,
  "rgba(255, 255, 255, 0)",
];

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** Entrance: park areas fade in first, then one line after the other draws itself, each ending in a ripple. */
export const REVEAL = { parksMs: 700, leadMs: 250, drawMs: 1300, staggerMs: 300, rippleMs: 900 } as const;
/** Trip of a comet; the pause lets the ripple at the receiver settle before the next one leaves. */
export const FLOW = { restMs: 500, tripMs: 4800, pauseMs: 1700, tail: 0.3, segments: 8 } as const;

/** k = the layer that draws it; c = colour; o = opacity; w = line width or ring radius in px. */
export type FlowProps = { k: "trail" | "head" | "ripple"; c: string; o: number; w: number };
export type FlowFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.LineString, FlowProps>;

const point = (position: Position, props: FlowProps): FlowFeature => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: position } });
const segment = (line: Position[], props: FlowProps): FlowFeature => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: line } });

/** Start and end (ms after the entrance began) of the drawing of line `index`. */
export function revealWindow(index: number): { start: number; end: number } {
  const start = REVEAL.leadMs + index * REVEAL.staggerMs;
  return { start, end: start + REVEAL.drawMs };
}

/** Length of the whole entrance for `count` lines, last ripple included. */
export const revealTotal = (count: number) => (count === 0 ? REVEAL.parksMs : Math.max(REVEAL.parksMs, revealWindow(count - 1).end + REVEAL.rippleMs));

/** Drawn share (0…1, eased) of line `index` at `elapsed` ms into the entrance. */
export function revealProgress(index: number, elapsed: number): number {
  return easeInOutCubic(clamp01((elapsed - revealWindow(index).start) / REVEAL.drawMs));
}

/** Expanding, fading ring at the receiver; `progress` 0…1, nothing outside. */
export function ripple(at: Position, progress: number, colour: string): FlowFeature[] {
  if (progress <= 0 || progress >= 1) return [];
  return [point(at, { k: "ripple", c: colour, o: 0.9 * (1 - progress) ** 1.4, w: 5 + 17 * easeOutCubic(progress) })];
}

/** Light at the tip of a line that is being drawn. */
export function tipLight(line: Position[], progress: number, colour: string): FlowFeature[] {
  if (progress <= 0 || progress >= 1) return [];
  return [point(pointAlong(line, progress), { k: "head", c: colour, o: 1, w: 1 })];
}

/**
 * Comet with its light at `head` (0…1 along the line): a tail of FLOW.segments pieces, thinner and fainter away from
 * the light; `fade` 0…1 scales it all (in at the sender, out at the receiver).
 */
export function comet(line: Position[], head: number, colour: string, fade: number): FlowFeature[] {
  if (fade <= 0) return [];
  const features: FlowFeature[] = [];
  const parts = FLOW.segments;
  for (let index = 0; index < parts; index++) {
    const to = head - (FLOW.tail * index) / parts;
    if (to <= 0) break;
    const near = 1 - index / parts;
    features.push(segment(sliceAlong(line, head - (FLOW.tail * (index + 1)) / parts, to), { k: "trail", c: colour, o: fade * 0.95 * near ** 1.6, w: 1.2 + 4.3 * near }));
  }
  features.push(point(pointAlong(line, head), { k: "head", c: colour, o: fade, w: 1 }));
  return features;
}

/** What moves on line `index` at `elapsed` ms after the entrance: the comet on its trip, then the arrival ripple. */
export function flowAt(line: Position[], index: number, elapsed: number, colour: string): FlowFeature[] {
  const cycle = FLOW.tripMs + FLOW.pauseMs;
  // the lines take turns: each starts a different share of a cycle later, never all at once, never in mid-trip
  const offset = FLOW.restMs + ((index * 0.37) % 1) * cycle;
  if (elapsed < offset) return [];
  const time = (elapsed - offset) % cycle;
  if (time < FLOW.tripMs) {
    const trip = time / FLOW.tripMs;
    return comet(line, easeInOutCubic(trip), colour, Math.min(1, trip / 0.08, (1 - trip) / 0.05));
  }
  return ripple(line[line.length - 1], (time - FLOW.tripMs) / REVEAL.rippleMs, colour);
}
