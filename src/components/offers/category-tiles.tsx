// Material categories (wireframe "Material categories"): Plastics is the initial scope, the other categories are
// shown as "later" and cannot be chosen. The list comes from the catalogue – enabling a category is data, not code.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type CatalogueCategory } from "@/server/domain/catalogue";
import { Badge } from "@/components/ui/elements";
import { PackageIcon } from "@/components/ui/icons";
import { CATEGORY_PHOTOS, StockPhoto } from "@/components/ui/material-photo";

type Props = { categories: CatalogueCategory[]; t: PlatformMessages; locale: Locale; /** "chips": one slim row of names without the icon tiles (offer search). */ variant?: "tiles" | "chips" };

export function CategoryTiles({ categories, t, locale, variant = "tiles" }: Props) {
  const badge = (category: CatalogueCategory) => (category.enabled ? <Badge tone="solid">{t.search.initialScope}</Badge> : <Badge tone="outline">{t.search.later}</Badge>);
  if (variant === "chips") {
    return (
      <ul className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <li key={category.id} className={`flex min-w-0 items-center gap-2.5 rounded-full border py-1.5 pr-2 pl-4 ${category.enabled ? "border-ink/40 bg-surface" : "border-line bg-canvas"}`}>
            <span className="min-w-0 text-[15px] leading-tight font-semibold break-words">{nameOf(category, locale)}</span>
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
