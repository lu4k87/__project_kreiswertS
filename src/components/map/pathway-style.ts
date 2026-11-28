// Colour of a pathway line in the glass look (user choice 2026-11-28, preview "Karte: transparenter, professioneller
// Look", Karte:A): faint at the sender, full at the receiver, so the direction reads without arrows. Kept apart from
// live-map.tsx (browser only) so the expression can be tested.
import type { ExpressionSpecification } from "maplibre-gl";

/** rgb of --color-map-flow (#c2410c). */
const RGB = "194, 65, 12";
const CLEAR = "rgba(255, 255, 255, 0)";
/** Opacity of the pathway colour at each point of the line (0 = sender, 1 = receiver). */
const ALPHA: [at: number, alpha: number][] = [
  [0, 0.35],
  [0.6, 0.8],
  [1, 1],
];

const colour = (alpha: number) => `rgba(${RGB}, ${Number(alpha.toFixed(3))})`;

/** Opacity at `at` (0…1), linear between the stops of ALPHA. */
export function pathwayAlpha(at: number): number {
  const next = ALPHA.findIndex(([stop]) => stop >= at);
  if (next <= 0) return ALPHA[0][1];
  const [[a, x], [b, y]] = [ALPHA[next - 1], ALPHA[next]];
  return x + ((y - x) * (at - a)) / (b - a);
}

/** `line-gradient` of a pathway drawn up to `progress` (0…1) of its length; needs `lineMetrics` on the source. */
export function pathwayGradient(progress: number): ExpressionSpecification {
  const end = Math.min(Math.max(progress, 0.001), 1);
  const stops: (number | string)[] = ALPHA.filter(([at]) => at < end).flatMap(([at, alpha]) => [at, colour(alpha)]);
  stops.push(end, colour(pathwayAlpha(end)));
  if (end < 1) stops.push(end + 0.0001, CLEAR); // the part not drawn yet
  return ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification;
}
