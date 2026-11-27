// Look of the site markers, shared by the map (browser) and the legends next to it (server).
// Kinds differ by shape and fill, never by colour alone: circle = offers, square = requests, filled square = both.
// Colours on top (user, 2026-11-27): offers green, requests amber, both blue; white text keeps ≥ 4.5:1.
// A white ring and a soft drop shadow lift every marker off the colourful base map (which stays light in both themes,
// hence fixed white and ink instead of the page tokens).

export type MarkerKind = "own" | "offers" | "requests" | "both" | "plain";

const MARKER_CLASS: Record<MarkerKind, string> = {
  offers: "rounded-full bg-map-offer text-white",
  requests: "rounded-md border-2 border-map-request bg-map-request-soft text-ink",
  both: "rounded-md bg-map-both text-white",
  own: "rounded-full border-2 border-dashed border-white bg-brand text-white",
  plain: "rounded-full border-2 border-[#1d3127] bg-white text-[#1d3127]",
};

/** Classes of a marker's visual (size 32 px); `highlighted` = part of the highlighted collection group. Hover and
 * focus come from the surrounding button (`group`, see markerButton in live-map.tsx); in a legend they never fire. */
export function markerClass(kind: MarkerKind, highlighted = false): string {
  return [
    "grid size-8 flex-none place-items-center text-[13px] leading-none font-bold",
    "transition-[scale] duration-150 ease-out group-hover:scale-110 motion-reduce:transition-none",
    "group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#1d3127]",
    MARKER_CLASS[kind],
    highlighted ? "scale-110 shadow-[0_0_0_3px_#fff,0_0_0_6px_#1d3127,0_3px_8px_rgb(0_0_0/0.35)]" : "shadow-[0_0_0_2px_#fff,0_3px_8px_rgb(0_0_0/0.35)]",
  ].join(" ");
}
