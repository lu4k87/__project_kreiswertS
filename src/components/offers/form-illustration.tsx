// Illustration per material form (decision F4: no file upload – listings show a drawn picture of the form, labelled
// as an illustration). Pure SVG in the map colours; `aria-hidden` because the text next to it names the form.
import type { ReactNode } from "react";

const land = "var(--color-map-land)";
const ink = "var(--color-map-ink)";
const paper = "var(--color-surface)"; // white in the light scheme, the page background in the dark one

const SHAPES: Record<string, ReactNode> = {
  sheet: (
    <g stroke={ink} strokeWidth={2} strokeLinejoin="round" fill={paper}>
      <path d="M36 92 L100 112 L164 92 L100 72 Z" fill={land} />
      <path d="M36 78 L100 98 L164 78 L100 58 Z" />
      <path d="M36 64 L100 84 L164 64 L100 44 Z" fill={land} />
      <path d="M36 50 L100 70 L164 50 L100 30 Z" />
    </g>
  ),
  granulate: (
    <g fill={paper} stroke={ink} strokeWidth={2}>
      {[[60, 96], [84, 100], [108, 98], [132, 100], [150, 94], [72, 80], [96, 82], [120, 82], [142, 78], [84, 64], [108, 64], [128, 62], [98, 48], [116, 46]].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={10} ry={7} fill={i % 3 === 0 ? land : paper} />
      ))}
    </g>
  ),
  regrind: (
    <g fill={paper} stroke={ink} strokeWidth={2} strokeLinejoin="round">
      {["52,100 66,88 80,98 70,110", "78,104 96,92 108,106 92,114", "112,100 126,88 142,96 130,112", "140,104 152,92 162,104 150,112", "64,82 80,70 92,84 76,92", "96,80 108,66 124,76 112,90", "126,80 140,68 152,80 140,90", "82,62 96,50 108,60 96,72", "110,60 122,46 136,58 124,68", "98,42 108,32 118,42 108,50"].map((points, i) => (
        <polygon key={i} points={points} fill={i % 2 === 0 ? land : paper} />
      ))}
    </g>
  ),
  film: (
    <g stroke={ink} strokeWidth={2} fill={paper} strokeLinejoin="round">
      <path d="M58 44 H130 a14 26 0 0 1 0 52 H58 a14 26 0 0 1 0 -52 Z" fill={land} />
      <ellipse cx={58} cy={70} rx={14} ry={26} />
      <ellipse cx={58} cy={70} rx={5} ry={9} fill={land} />
      <path d="M130 96 C148 100 156 108 170 106" fill="none" />
    </g>
  ),
  component: (
    <g stroke={ink} strokeWidth={2} fill={paper} strokeLinejoin="round">
      <path d="M52 62 L100 44 L148 62 L148 96 L100 114 L52 96 Z" fill={land} />
      <path d="M52 62 L100 80 L148 62" fill="none" />
      <path d="M100 80 V114" fill="none" />
      <circle cx={100} cy={61} r={8} />
    </g>
  ),
  mixed: (
    <g stroke={ink} strokeWidth={2} strokeLinejoin="round">
      <rect x={48} y={78} width={34} height={28} rx={3} fill={land} />
      <circle cx={104} cy={94} r={14} fill={paper} />
      <polygon points="126,108 144,76 162,108" fill={land} />
      <rect x={70} y={46} width={28} height={22} rx={3} fill={paper} transform="rotate(-12 84 57)" />
      <ellipse cx={128} cy={56} rx={16} ry={10} fill={paper} />
    </g>
  ),
};

/** `form`: key of the material form (sheet, granulate, regrind, film, component, mixed); anything else → neutral box. */
export function FormIllustration({ form, className = "" }: { form: string | null | undefined; className?: string }) {
  return (
    <svg viewBox="0 0 200 144" role="presentation" aria-hidden="true" focusable="false" className={`block rounded-xl bg-map ${className}`}>
      {SHAPES[form ?? ""] ?? (
        <g stroke={ink} strokeWidth={2} fill={paper} strokeLinejoin="round">
          <path d="M56 58 L100 40 L144 58 L144 98 L100 116 L56 98 Z" fill={land} />
          <path d="M56 58 L100 76 L144 58 M100 76 V116" fill="none" />
        </g>
      )}
    </svg>
  );
}
