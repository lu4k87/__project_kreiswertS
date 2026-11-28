// Example photos per material form, material category, legal status and side of an exchange (decision of 2026-11-28: real photos instead of drawn
// illustrations; still no upload, F4). Every photo is an example of the form, never a picture of the batch, and
// comes from a free licence – the credits are listed on the About page. `alt=""` because the text next to the
// photo names the form.
import Image from "next/image";
import { PackageIcon } from "./icons";

export type PhotoCredit = { title: string; author: string; licence: string; licenceUrl: string; source: string };
type Photo = { src: string; width: number; height: number; credit: PhotoCredit };

const BY_SA_4 = { licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
const BY_SA_3 = { licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/" };
const BY_2 = { licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/" };
const CC0 = { licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
const COMMONS = "https://commons.wikimedia.org/wiki/File:";

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
  // material categories (About page, material scope)
  metals: { src: "/images/materials/metals.jpg", width: 704, height: 528, credit: { title: "Dillingen Aluminium Schrott", author: "Lokilech", ...BY_SA_3, source: `${COMMONS}DillingenAluminiumSchrott.jpg` } },
  wood: { src: "/images/materials/wood.jpg", width: 800, height: 600, credit: { title: "Wooden pallets stacked 4", author: "W.carter", ...CC0, source: `${COMMONS}Wooden-pallets_stacked_4.jpg` } },
  paper: { src: "/images/materials/paper.jpg", width: 800, height: 600, credit: { title: "Baal door Balenpers", author: "Romy2702", ...BY_SA_3, source: `${COMMONS}Baal_door_Balenpers.jpg` } },
  glass: {
    src: "/images/materials/glass.jpg",
    width: 800,
    height: 600,
    credit: { title: "Glass cullet various", author: "Alter Fritz", ...BY_SA_3, source: `${COMMONS}Glas_aus_Aufbereitungsanlage_bunt_-_glass_cullet_various_(Alter_Fritz).JPG` },
  },
  textiles: {
    src: "/images/materials/textiles.jpg",
    width: 768,
    height: 576,
    credit: { title: "De Schoolmeester scheurbank met sorteerkist", author: "Rasbak", ...BY_SA_3, source: `${COMMONS}De_Schoolmeester_scheurbank_met_sorteerkist.jpg` },
  },
  minerals: {
    src: "/images/materials/minerals.jpg",
    width: 800,
    height: 600,
    credit: { title: "Sheehan recycled 10-20mm aggregate", author: "Peter Craven", ...BY_2, source: `${COMMONS}Sheehan_recycled_10-20mm_aggregate_(7590397672).jpg` },
  },
  surplus: {
    src: "/images/materials/surplus.jpg",
    width: 800,
    height: 600,
    credit: {
      title: "Rectangular plastic shipping crates in an Italian recycling plant",
      author: "Nino Barbieri",
      licence: "CC BY 2.5",
      licenceUrl: "https://creativecommons.org/licenses/by/2.5/",
      source: `${COMMONS}Rectangular_plastic_shipping_crates_in_an_Italian_recycling_plant.jpg`,
    },
  },
  electronics: {
    src: "/images/materials/electronics.jpg",
    width: 797,
    height: 598,
    credit: { title: "Recycled Electronics – Circuit Boards", author: "Tony Webster", ...BY_2, source: `${COMMONS}Recycled_Electronics_-_Circuit_Boards_(48659415958).jpg` },
  },
  // the two sides in the guide (duties)
  producer: { src: "/images/materials/producer.jpg", width: 800, height: 600, credit: { title: "Arburg – swiss plastic 2026", author: "Bricetofly", ...CC0, source: `${COMMONS}Arburg-swiss_plastic_2026.jpg` } },
  recycler: {
    src: "/images/materials/recycler.jpg",
    width: 672,
    height: 504,
    credit: { title: "Waste recycling plant, Industrial Park, Karcag", author: "Globetrotter19", ...BY_SA_3, source: `${COMMONS}Waste_recycling_plant,_Industrial_Park,_2018_Karcag.jpg` },
  },
} satisfies Record<string, Photo>;

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
