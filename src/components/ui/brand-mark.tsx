// Brand mark "flake ring" (user choice 2026-11-27, logo preview round 2, Bild:C): 13 flakes of recycled plastic in a
// ring. Geometry and colours from public/brand/kreiswerts-mark(-dark).svg; inline instead of <img> so every flake
// follows the theme switch (light-dark() reads the color-scheme on <html>, like the tokens in globals.css).
const FLAKES: [points: string, light: string, dark: string][] = [
  ["44.09,24.37 36.57,25.86 39.33,19.89", "#c2532f", "#e07a55"],
  ["41.40,32.00 33.90,34.93 36.79,26.40", "#e0a43a", "#f0b955"],
  ["31.59,39.15 31.57,32.50 37.04,34.26", "#2f6a4e", "#6fbf8c"],
  ["23.23,42.90 23.63,36.67 30.64,37.35 28.52,43.37", "#3d6f8e", "#6fa8cc"],
  ["14.82,41.16 13.69,36.36 19.95,34.67 23.08,38.37 19.05,43.49", "#8b5a3c", "#c08a63"],
  ["8.83,34.88 14.63,29.53 16.06,39.09", "#d27a5a", "#eb9a7c"],
  ["8.93,33.01 4.13,27.79 8.78,24.96 14.23,28.82", "#5c8f6a", "#8cc39b"],
  ["4.61,25.12 6.31,17.95 11.70,17.40 12.91,23.07", "#c2532f", "#e07a55"],
  ["15.98,15.06 8.04,16.51 12.49,9.80", "#e0a43a", "#f0b955"],
  ["17.95,15.06 13.59,10.05 16.18,5.79 23.25,9.60", "#2f6a4e", "#6fbf8c"],
  ["27.86,10.77 22.20,11.34 21.42,7.01 27.64,4.50", "#3d6f8e", "#6fa8cc"],
  ["37.42,12.89 27.75,12.63 32.05,6.61", "#8b5a3c", "#c08a63"],
  ["38.93,20.05 34.31,18.70 34.95,13.98 38.45,12.76 41.93,16.47", "#d27a5a", "#eb9a7c"],
];

type MarkProps = {
  size?: number;
  title?: string;
  className?: string;
  /** "onBrand": on the dark green brand surface the light-scheme flakes lack contrast → always the dark-scheme colours. */
  tone?: "auto" | "onBrand";
};

/** Decorative by default (the link or text next to it names the brand); pass `title` to make it a labelled image. */
export function BrandMark({ size = 36, title, className, tone = "auto" }: MarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {FLAKES.map(([points, light, dark]) => (
        <polygon key={points} points={points} style={{ fill: tone === "onBrand" ? dark : `light-dark(${light}, ${dark})` }} />
      ))}
    </svg>
  );
}

/** Mark + wordmark "kreiswerts" (Syne 800, lowercase, as chosen) for both headers; the link around it names the page. */
export function BrandLogo({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={34} className="flex-none" />
      <span className="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.02em] lowercase" translate="no">
        {text}
      </span>
    </span>
  );
}
