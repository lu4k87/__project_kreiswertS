// Example photos per material form and per legal status (decision of 2026-11-28: real photos instead of drawn
// illustrations; still no upload, F4). Every photo is an example of the form, never a picture of the batch, and
// comes from a free licence – the credits are listed on the About page. `alt=""` because the text next to the
// photo names the form.
import Image from "next/image";
import { PackageIcon } from "./icons";

export type PhotoCredit = { title: string; author: string; licence: string; licenceUrl: string; source: string };
type Photo = { src: string; width: number; height: number; credit: PhotoCredit };

const BY_SA_4 = { licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };

const PHOTOS = {
  sheet: {
    src: "/images/materials/sheet.jpg",
    width: 800,
    height: 600,
    credit: { title: "Twinwall Polycarbonate Sheet", author: "MaterialScience100", ...BY_SA_4, source: "https://commons.wikimedia.org/wiki/File:Twinwall_Polycarbonate_Sheet.jpg" },
  },
  granulate: {
    src: "/images/materials/granulate.jpg",
    width: 719,
    height: 539,
    credit: { title: "Pellet azul", author: "ISIPLAST S.A de C.V", ...BY_SA_4, source: "https://commons.wikimedia.org/wiki/File:Pellet_azul.jpg" },
  },
  regrind: {
    src: "/images/materials/regrind.jpg",
    width: 624,
    height: 468,
    credit: { title: "Clean HDPE drum flakes", author: "Soddaa", ...BY_SA_4, source: "https://commons.wikimedia.org/wiki/File:Clean-HDPE-drum-flakes.jpg" },
  },
  film: {
    src: "/images/materials/film.jpg",
    width: 800,
    height: 600,
    credit: { title: "Heat shrinkable polyethylene film", author: "Suyash Dwivedi", ...BY_SA_4, source: "https://commons.wikimedia.org/w/index.php?curid=55447120" },
  },
  component: {
    src: "/images/materials/component.jpg",
    width: 800,
    height: 600,
    credit: {
      title: "Water Outlet Assembly",
      author: "spe.automotive",
      licence: "CC BY 2.0",
      licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
      source: "https://www.flickr.com/photos/32775400@N06/8116090082",
    },
  },
  mixed: {
    src: "/images/materials/mixed.jpg",
    width: 800,
    height: 600,
    credit: { title: "Bales of PET bottles closeup", author: "Grendelkhan", ...BY_SA_4, source: "https://commons.wikimedia.org/wiki/File:Bales_of_PET_bottles_closeup.jpg" },
  },
  bales: {
    src: "/images/materials/bales.jpg",
    width: 800,
    height: 600,
    credit: { title: "Bales of PET bottles stacked", author: "Grendelkhan", ...BY_SA_4, source: "https://commons.wikimedia.org/wiki/File:Bales_of_PET_bottles_stacked.jpg" },
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/** Photo per material form (keys of the catalogue in scripts/seed/reference.mjs). "other" and unknown forms have none. */
export const FORM_PHOTOS: Record<string, PhotoKey> = { sheet: "sheet", granulate: "granulate", regrind: "regrind", film: "film", component: "component", mixed: "mixed" };

/** Photo per legal status in the guide: waste → baled bottles, by-product → production offcut, end of waste → granulate. */
export const STATUS_PHOTOS = { waste: "bales", by_product: "sheet", end_of_waste: "granulate" } as const satisfies Record<string, PhotoKey>;

/** All photos once, for the credits list. */
export const PHOTO_CREDITS: PhotoCredit[] = Object.values(PHOTOS).map((photo) => photo.credit);

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
