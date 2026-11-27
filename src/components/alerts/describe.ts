// One line that says what a saved search looks for, e.g. "Wider area 10 km · Plastics · PE · Film" (function no. 19).
// Used as the suggested name when saving and as the summary under Notifications.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import type { Frequency, Origin } from "@/server/domain/listing";
import type { SavedSearchFilters } from "@/server/domain/saved-search";

type Park = { id: number; name: string };

export function describeFilters(filters: SavedSearchFilters, catalogue: Catalogue, parks: Park[], t: PlatformMessages, locale: Locale): string {
  const s = t.search;
  const find = <T extends { id: number }>(items: T[], id: number | undefined) => (id === undefined ? undefined : items.find((item) => item.id === id));
  const park = find(parks, filters.parkId);
  const area = filters.scope === "radius" ? `${s.scopeRadius} ${filters.radiusKm} km` : (park?.name ?? s.scopePark);
  const category = find(catalogue.categories, filters.categoryId);
  const type = find(catalogue.types, filters.typeId);
  const form = find(catalogue.forms, filters.formId);
  return [
    area,
    category && nameOf(category, locale),
    type && nameOf(type, locale),
    form && nameOf(form, locale),
    filters.origin && t.labels.origin[filters.origin as Origin],
    filters.frequency && t.labels.frequency[filters.frequency as Frequency],
    filters.delivery && (filters.delivery === "collection" ? s.deliveryCollection : s.deliveryDelivered),
    filters.minQuantityKg !== undefined && `≥ ${filters.minQuantityKg} kg`,
  ]
    .filter(Boolean)
    .join(" · ");
}
