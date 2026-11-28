// Example pictures per material form, material category, legal status, side of an exchange and kind of company.
// Decision of 2026-11-28: own 3D renders (Blender, scripts/images/render.py) instead of stock photos, so no licence
// conditions apply; still no upload (F4). Every picture is an example of the form, never a picture of the batch.
// `alt=""` because the text next to the picture names the form.
import Image from "next/image";
import type { ReactNode } from "react";
import { PackageIcon } from "./icons";

const KEYS = [
  "sheet", "granulate", "regrind", "film", "component", "mixed", "bales",
  "metals", "wood", "paper", "glass", "textiles", "minerals", "surplus", "electronics",
  "producer", "recycler", "logistics", "construction", "packaging",
] as const;

const PHOTOS = Object.fromEntries(KEYS.map((key) => [key, { src: `/images/renders/${key}.jpg`, width: 800, height: 600 }])) as Record<
  (typeof KEYS)[number],
  { src: string; width: number; height: number }
>;

export type PhotoKey = keyof typeof PHOTOS;

/** Photo per material form (keys of the catalogue in scripts/seed/reference.mjs). "other" and unknown forms have none. */
export const FORM_PHOTOS: Record<string, PhotoKey> = { sheet: "sheet", granulate: "granulate", regrind: "regrind", film: "film", component: "component", mixed: "mixed" };

/** Photo per legal status in the guide: waste → baled bottles, by-product → production offcut, end of waste → granulate. */
export const STATUS_PHOTOS = { waste: "bales", by_product: "sheet", end_of_waste: "granulate" } as const satisfies Record<string, PhotoKey>;

/** Photo per material category (keys of the catalogue); plastics shows its granulate. */
export const CATEGORY_PHOTOS: Record<string, PhotoKey> = {
  plastics: "granulate",
  metals: "metals",
  wood: "wood",
  paper: "paper",
  glass: "glass",
  textiles: "textiles",
  minerals: "minerals",
  surplus: "surplus",
  electronics: "electronics",
};

/** Picture per kind of company (company directory); "other" has none. */
export const INDUSTRY_PHOTOS: Record<string, PhotoKey> = { manufacturing: "producer", recycling: "recycler", packaging: "packaging", construction: "construction", logistics: "logistics" };

export function photoFor(key: PhotoKey) {
  return PHOTOS[key];
}

/** `sizes` = rendered width, so the browser loads a fitting file. */
export function StockPhoto({ photo, sizes, className = "" }: { photo: PhotoKey; sizes: string; className?: string }) {
  const { src, width, height } = PHOTOS[photo];
  return <Image src={src} alt="" width={width} height={height} sizes={sizes} className={`block rounded-xl bg-map object-cover ${className}`} />;
}

/** Example photo of a material form; forms without a photo get a neutral tile with an icon. */
export function MaterialPhoto({ form, sizes, className = "" }: { form: string | null | undefined; sizes: string; className?: string }) {
  const photo = FORM_PHOTOS[form ?? ""];
  if (photo) return <StockPhoto photo={photo} sizes={sizes} className={className} />;
  return (
    <span aria-hidden="true" className={`grid place-items-center rounded-xl bg-mint ${className}`}>
      <PackageIcon size={28} />
    </span>
  );
}

/** Several form pictures side by side in one frame (a request accepting more than one form); `children` overlays
 *  the frame, e.g. the "wanted" band. Forms without a picture are left out; none left → neutral tile. */
export function FormPhotos({ forms, sizes, className = "", children }: { forms: (string | null | undefined)[]; sizes: string; className?: string; children?: ReactNode }) {
  const photos = [...new Set(forms.map((form) => FORM_PHOTOS[form ?? ""]).filter(Boolean))].slice(0, 3);
  return (
    <span aria-hidden="true" className={`relative grid overflow-hidden rounded-xl bg-mint ${className}`} style={{ gridTemplateColumns: `repeat(${Math.max(photos.length, 1)}, minmax(0, 1fr))` }}>
      {photos.length === 0 && <PackageIcon size={28} className="flex-none place-self-center" />}
      {photos.map((photo) => (
        <Image key={photo} src={PHOTOS[photo].src} alt="" width={PHOTOS[photo].width} height={PHOTOS[photo].height} sizes={sizes} className="block size-full object-cover" />
      ))}
      {children}
    </span>
  );
}
