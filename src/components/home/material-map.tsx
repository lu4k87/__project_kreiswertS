"use client";
// Illustrated map NL / BE / DE with sample price pins.
// MOCK: static illustration – the offers API has no coordinates yet (docs/FRONTEND.md §10, "Map").
import { useState } from "react";
import type { Locale, Messages } from "@/i18n/messages";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

type Pin = { x: number; y: number; price: number; kind: "loop" | "box"; active?: boolean };

// MOCK: sample prices in € per kg; replace with offers + coordinates from the API.
const PINS: Pin[] = [
  { x: 173, y: 100, price: 0.38, kind: "loop" },
  { x: 404, y: 161, price: 0.42, kind: "box" },
  { x: 643, y: 115, price: 0.55, kind: "loop" },
  { x: 560, y: 214, price: 0.45, kind: "loop", active: true },
  { x: 336, y: 272, price: 0.31, kind: "box" },
  { x: 636, y: 329, price: 0.48, kind: "box" },
];

const CITIES: { name: string; x: number; y: number; anchor?: "end" }[] = [
  { name: "Amsterdam", x: 140, y: 64 },
  { name: "Utrecht", x: 242, y: 94 },
  { name: "Arnhem", x: 399, y: 101 },
  { name: "Rotterdam", x: 85, y: 140 },
  { name: "Eindhoven", x: 242, y: 205 },
  { name: "Antwerpen", x: 68, y: 270 },
  { name: "Liège", x: 310, y: 343 },
  { name: "Dortmund", x: 672, y: 151 },
  { name: "Essen", x: 598, y: 174 },
  { name: "Düsseldorf", x: 556, y: 240, anchor: "end" },
  { name: "Köln", x: 548, y: 304 },
];

const ROADS = [
  "M0 182 L173 100 L404 161 L560 214 L830 206",
  "M173 100 L242 94 L399 101 L643 115 L760 0",
  "M404 161 L336 272 L310 343",
  "M560 214 L643 115",
  "M560 214 L636 329 L700 380",
  "M85 140 L242 205 L336 272",
  "M643 115 L830 160",
];

const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2];

function PinMark({ pin, label }: { pin: Pin; label: string }) {
  const width = 38 + label.length * 7.4;
  const fill = pin.active ? "var(--color-brand)" : "#fff";
  const ink = pin.active ? "#fff" : "var(--color-ink)";
  return (
    <g transform={`translate(${pin.x - width / 2} ${pin.y - 14})`}>
      <rect width={width} height={28} rx={14} fill={fill} stroke={pin.active ? "none" : "#d6ded3"} />
      <svg x={9} y={7} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {pin.kind === "loop" ? (
          <path d="m2 9 3-3 3 3M13 18H7a2 2 0 0 1-2-2V6m17 9-3 3-3-3M11 6h6a2 2 0 0 1 2 2v10" />
        ) : (
          <path d="M21 8 12 3 3 8v8l9 5 9-5zM3.3 7.5 12 12l8.7-4.5M12 22V12" />
        )}
      </svg>
      <text x={27} y={18.5} fontSize={13} fontWeight={500} fill={ink}>
        {label}
      </text>
    </g>
  );
}

export function MaterialMap({ t, locale }: { t: Messages["home"]["map"]; locale: Locale }) {
  const [zoom, setZoom] = useState(0);
  const price = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  const countries = [
    { name: t.netherlands, x: 132, y: 177 },
    { name: t.germany, x: 570, y: 264 },
    { name: t.belgium, x: 120, y: 336 },
  ];

  return (
    <div className="relative h-[340px] overflow-hidden rounded-2xl bg-map md:h-auto md:aspect-[830/380] lg:aspect-auto lg:min-h-[380px]">
      <svg
        viewBox="0 0 830 380"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t.label}
        className="size-full overflow-visible transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `scale(${ZOOM_STEPS[zoom]})` }}
      >
        <g fill="var(--color-map-land)">
          <path d="M300 230 L470 205 L525 300 L450 380 L300 380 Z" />
          <path d="M590 90 L735 70 L830 150 L830 240 L700 210 Z" />
          <path d="M440 0 L560 0 L520 70 L430 60 Z" opacity={0.7} />
          <path d="M660 300 L780 270 L830 330 L830 380 L690 380 Z" opacity={0.7} />
        </g>
        <path d="M0 232 C90 246 190 262 300 300 S520 330 560 380" fill="none" stroke="#b7c8b5" strokeDasharray="4 5" />
        <path d="M455 0 C470 90 520 150 520 230 S500 330 470 380" fill="none" stroke="#b7c8b5" strokeDasharray="4 5" />
        <path
          d="M318 0 C340 60 385 110 430 150 S515 225 540 300 S600 365 625 380"
          fill="none"
          stroke="#b9cfbd"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <g fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
          {ROADS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fontSize={12} fill="var(--color-map-ink)">
          {CITIES.map((city) => (
            <g key={city.name}>
              <circle cx={city.x} cy={city.y} r={2.5} />
              <text
                x={city.anchor === "end" ? city.x - 7 : city.x + 7}
                y={city.y + 4}
                textAnchor={city.anchor === "end" ? "end" : "start"}
              >
                {city.name}
              </text>
            </g>
          ))}
        </g>
        {/* country names would be cut at the edges of the narrow (cropped) map */}
        <g fontSize={13} letterSpacing={3.5} fill="var(--color-map-ink)" className="max-md:hidden">
          {countries.map((c) => (
            <text key={c.name} x={c.x} y={c.y}>
              {c.name.toUpperCase()}
            </text>
          ))}
        </g>
        {PINS.map((pin) => (
          <PinMark key={`${pin.x}-${pin.y}`} pin={pin} label={price.format(pin.price)} />
        ))}
        <g transform="translate(660 350)" fill="var(--color-map-ink)">
          <path d="M0 0 H40" stroke="var(--color-map-ink)" strokeWidth={3} strokeLinecap="round" />
          <text x={50} y={4} fontSize={11}>
            25 km
          </text>
        </g>
      </svg>

      {/* Overlays deliberately sit on the map (badge, zoom, caption). */}
      <p className="absolute top-4 left-4 flex items-center gap-2 rounded-lg bg-surface/95 px-3 py-1.5 text-[13px] font-medium shadow-sm">
        <span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />
        {t.badge}
      </p>
      <div className="absolute top-4 right-4 flex flex-col overflow-hidden rounded-lg bg-surface/95 shadow-sm">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 1, ZOOM_STEPS.length - 1))}
          disabled={zoom === ZOOM_STEPS.length - 1}
          aria-label={t.zoomIn}
          className="grid size-9 place-items-center hover:bg-mint disabled:opacity-40"
        >
          <PlusIcon size={16} />
        </button>
        <span className="mx-2 h-px bg-line" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 1, 0))}
          disabled={zoom === 0}
          aria-label={t.zoomOut}
          className="grid size-9 place-items-center hover:bg-mint disabled:opacity-40"
        >
          <MinusIcon size={16} />
        </button>
      </div>
      <p className="absolute bottom-3 left-4 rounded bg-map/80 px-1 text-xs text-map-ink">{t.caption}</p>
    </div>
  );
}
