// Material categories (wireframe "Material categories"): Plastics is the initial scope, the other categories are
// shown as "later" and cannot be chosen. The list comes from the catalogue – enabling a category is data, not code.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type CatalogueCategory } from "@/server/domain/catalogue";
import { Badge } from "@/components/ui/elements";
import { PackageIcon } from "@/components/ui/icons";
import { CATEGORY_PHOTOS, StockPhoto } from "@/components/ui/material-photo";

type Props = { categories: CatalogueCategory[]; t: PlatformMessages; locale: Locale; /** "chips": the compact form for the offer search above the filters. */ variant?: "tiles" | "chips" };

export function CategoryTiles({ categories, t, locale, variant = "tiles" }: Props) {
  const badge = (category: CatalogueCategory) => (category.enabled ? <Badge tone="solid">{t.search.initialScope}</Badge> : <Badge tone="outline">{t.search.later}</Badge>);
  if (variant === "chips") {
    // Decision of 2026-11-28 (preview Filter:A + Filter:B): from 640 px one row of picture tiles, below it the slim
    // chips with a round picture, so the filter stays short on a phone. Same list, the classes switch the form.
    return (
      <ul className="flex flex-wrap gap-2 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] sm:gap-2.5 xl:grid-cols-9">
        {categories.map((category) => (
          <li
            key={category.id}
            className={`flex min-w-0 items-center gap-2.5 rounded-full border py-1 pr-2 pl-1 sm:grid sm:content-start sm:justify-items-center sm:gap-2 sm:rounded-xl sm:p-2 sm:pb-2.5 sm:text-center ${
              category.enabled ? "border-ink/40 bg-surface" : "border-line bg-canvas"
            }`}
          >
            {CATEGORY_PHOTOS[category.key] ? (
              <StockPhoto
                photo={CATEGORY_PHOTOS[category.key]}
                sizes="(min-width: 640px) 160px, 28px"
                className={`size-7 flex-none rounded-full sm:h-20 sm:w-full sm:rounded-lg ${category.enabled ? "" : "saturate-[.6]"}`}
              />
            ) : (
              <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-mint sm:h-20 sm:w-full sm:rounded-lg">
                <PackageIcon size={18} />
              </span>
            )}
            <span className="min-w-0 text-[15px] leading-tight font-semibold break-words hyphens-auto text-balance">{nameOf(category, locale)}</span>
            {badge(category)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
      {categories.map((category) => (
        <li
          key={category.id}
          className={`flex items-center gap-3 rounded-xl border p-2.5 sm:grid sm:content-start sm:gap-2.5 ${category.enabled ? "border-ink/40 bg-surface" : "border-line bg-canvas"}`}
        >
          {/* Example photo centred above the name (decision of 2026-11-28), left of it below 640 px so the one-column list stays short; a category without a photo keeps an icon tile. */}
          {CATEGORY_PHOTOS[category.key] ? (
            <StockPhoto photo={CATEGORY_PHOTOS[category.key]} sizes="(min-width: 640px) 240px, 88px" className="h-16 w-[5.5rem] flex-none sm:h-24 sm:w-full" />
          ) : (
            <span aria-hidden="true" className="grid h-16 w-[5.5rem] flex-none place-items-center rounded-xl bg-mint sm:h-24 sm:w-full">
              <PackageIcon size={28} />
            </span>
          )}
          <span className="grid min-w-0 justify-items-start gap-1 sm:justify-items-center sm:pb-1 sm:text-center">
            <span className="text-[15px] leading-tight font-semibold text-balance">{nameOf(category, locale)}</span>
            <span>{badge(category)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
