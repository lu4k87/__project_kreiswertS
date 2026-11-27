// Look of the site markers, shared by the map (browser) and the legends next to it (server).
// Kinds differ by shape and fill, never by colour alone: circle = offers, square = requests, filled square = both.

export type MarkerKind = "own" | "offers" | "requests" | "both" | "plain";

const MARKER_CLASS: Record<MarkerKind, string> = {
  offers: "rounded-full bg-brand text-white",
  requests: "rounded-md border-2 border-brand bg-mint text-ink",
  both: "rounded-md bg-brand text-white",
  own: "rounded-full border-2 border-dashed border-white bg-brand text-white outline-1 outline-ink",
  plain: "rounded-full border border-ink bg-surface text-ink",
};

/** Classes of a marker (size 32 px); `highlighted` = part of the highlighted collection group. */
export function markerClass(kind: MarkerKind, highlighted = false): string {
  return [
    "grid size-8 flex-none cursor-pointer place-items-center text-[13px] leading-none font-semibold shadow-md",
    "transition-transform duration-150 ease-out hover:scale-110 motion-reduce:transition-none",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
    MARKER_CLASS[kind],
    highlighted ? "scale-110 shadow-[0_0_0_4px_#fff,0_0_0_7px_#1d3127]" : "",
  ].join(" ");
}
