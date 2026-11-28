// Brand mark "flake spiral" (user choice 2026-11-28, preview "Logo-Spirale 2", Fib:B): 8 flakes of recycled plastic,
// each 15 % larger and 15 % further out than the one before – a Fibonacci-type spiral, smallest flake first. Geometry
// and colours from public/brand/kreiswerts-mark(-dark).svg (brand-mark.test.ts keeps both in step); inline instead of
// <img> so every flake follows the theme switch (light-dark() reads the color-scheme on <html>, like globals.css).
import type { CSSProperties } from "react";
import { BrandWave } from "./brand-wave";

const FLAKES: [points: string, light: string, dark: string][] = [
  ["33.16,30.82 26.79,31.83 29.31,26.90", "#e0a43a", "#f0b955"],
  ["30.72,37.30 25.43,37.71 28.89,32.89", "#2f6a4e", "#6fbf8c"],
  ["19.21,41.68 20.33,36.66 25.94,38.10 23.46,42.73", "#3d6f8e", "#6fa8cc"],
  ["10.91,38.63 11.62,34.66 16.86,35.42 18.02,39.21 13.33,41.75", "#8b5a3c", "#c08a63"],
  ["7.50,34.62 4.00,27.24 10.08,25.72 14.76,31.82", "#d27a5a", "#eb9a7c"],
  ["4.83,20.51 10.93,14.75 16.40,17.61 14.00,23.76", "#5c8f6a", "#8cc39b"],
  ["27.92,16.39 17.91,17.90 16.14,10.28 26.97,5.27", "#e0a43a", "#f0b955"],
  ["40.45,21.66 31.44,21.61 30.16,12.79 35.83,8.80 44.00,13.68", "#c2532f", "#e07a55"],
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
      {/* kw-flake moves only inside .kw-wave (globals.css); --kw-i = the flake's turn in the wave */}
      {FLAKES.map(([points, light, dark], i) => (
        <polygon
          key={points}
          points={points}
          className="kw-flake"
          style={{ fill: tone === "onBrand" ? dark : `light-dark(${light}, ${dark})`, "--kw-i": i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/** Mark + wordmark "kreiswerts" (Syne 800, lowercase, as chosen) for both headers; the link around it names the page.
 *  The flakes swell one after the other once on load and once per mouse touch (user choice 2026-11-28). */
export function BrandLogo({ text }: { text: string }) {
  return (
    <BrandWave className="flex items-center gap-2.5">
      <BrandMark size={34} className="flex-none" />
      <span className="font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.02em] lowercase" translate="no">
        {text}
      </span>
    </BrandWave>
  );
}
