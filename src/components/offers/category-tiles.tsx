// Material categories (wireframe "Material categories"): Plastics is the initial scope, the other categories are
// shown as "later" and cannot be chosen. The list comes from the catalogue – enabling a category is data, not code.
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type CatalogueCategory } from "@/server/domain/catalogue";
import { Badge } from "@/components/ui/elements";
import { BottleIcon, CpuIcon, FileTextIcon, IngotIcon, MountainIcon, PackageIcon, PlankIcon, RecycleIcon, ShirtIcon } from "@/components/ui/icons";

const ICONS: Record<string, ReactNode> = {
  plastics: <RecycleIcon size={22} />,
  metals: <IngotIcon size={22} />,
  wood: <PlankIcon size={22} />,
  paper: <FileTextIcon size={22} />,
  glass: <BottleIcon size={22} />,
  textiles: <ShirtIcon size={22} />,
  minerals: <MountainIcon size={22} />,
  surplus: <PackageIcon size={22} />,
  electronics: <CpuIcon size={22} />,
};

export function CategoryTiles({ categories, t, locale }: { categories: CatalogueCategory[]; t: PlatformMessages; locale: Locale }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
      {categories.map((category) => (
        <li
          key={category.id}
          className={`flex items-center gap-3 rounded-xl border p-3 ${category.enabled ? "border-ink/40 bg-surface" : "border-line bg-canvas"}`}
        >
          <span className="grid size-11 flex-none place-items-center rounded-lg bg-mint">{ICONS[category.key] ?? <PackageIcon size={22} />}</span>
          <span className="grid min-w-0 gap-1">
            <span className="text-[15px] leading-tight font-semibold text-balance">{nameOf(category, locale)}</span>
            <span>{category.enabled ? <Badge tone="solid">{t.search.initialScope}</Badge> : <Badge tone="outline">{t.search.later}</Badge>}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
