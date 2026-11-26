// Filters of the offer search (L1-013, L1-014), shared by the list (/offers) and the map (/map): a plain GET form,
// so the URL carries the whole state and "Search wider area" is just the same URL with another scope.
import Link from "next/link";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import { FREQUENCIES, ORIGINS, RADIUS_STEPS_KM } from "@/server/domain/listing";
import type { OfferSearchQuery } from "@/server/validation/offers";
import { buttonPrimary, linkClass } from "@/components/ui/elements";
import { Choice, Field, Select, TextInput } from "@/components/ui/form";
import { SearchIcon } from "@/components/ui/icons";

/** Query string of a search, without empty values and defaults – used for "widen", "list / map" and paging links. */
export function searchParamsOf(query: OfferSearchQuery, overrides: Partial<Record<keyof OfferSearchQuery | "site", string | number | undefined>> = {}): string {
  const merged: Record<string, string | number | undefined> = { ...query, ...overrides };
  if (merged.scope === "park") delete merged.radiusKm;
  if (merged.limit === 50) delete merged.limit;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}

type Props = {
  action: string;
  query: OfferSearchQuery;
  catalogue: Catalogue;
  parks: { id: number; name: string; city: string }[];
  t: PlatformMessages;
  locale: Locale;
  /** The viewer's own park, if known: then "own park" needs no park choice. */
  hasOwnPark: boolean;
};

export function SearchFilters({ action, query, catalogue, parks, t, locale, hasOwnPark }: Props) {
  const s = t.search;
  const enabled = catalogue.categories.filter((category) => category.enabled);
  const ids = new Set(enabled.map((category) => category.id));
  const types = catalogue.types.filter((type) => ids.has(type.categoryId));
  const forms = catalogue.forms.filter((form) => ids.has(form.categoryId));
  return (
    <form method="get" action={action} className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label={s.filters}>
      <fieldset className="grid gap-3">
        <legend className="float-left w-full text-lg leading-tight font-semibold">{s.scope}</legend>
        <div className="clear-both grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-1">
          <Choice id="scope-park" type="radio" name="scope" value="park" defaultChecked={query.scope === "park"} label={s.scopePark} />
          <Choice id="scope-radius" type="radio" name="scope" value="radius" defaultChecked={query.scope === "radius"} label={s.scopeRadius} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Field id="parkId" label={s.park}>
            <Select id="parkId" name="parkId" defaultValue={query.parkId ?? ""}>
              <option value="">{hasOwnPark ? s.scopePark : s.parkChoose}</option>
              {parks.map((park) => (
                <option key={park.id} value={park.id}>
                  {park.name}, {park.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="radiusKm" label={`${s.radius} (${t.common.straightLine})`}>
            <Select id="radiusKm" name="radiusKm" defaultValue={query.radiusKm}>
              {RADIUS_STEPS_KM.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 border-t border-line pt-5">
        <legend className="float-left w-full text-lg leading-tight font-semibold">{s.filters}</legend>
        <div className="clear-both grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Field id="typeId" label={s.type}>
            <Select id="typeId" name="typeId" defaultValue={query.typeId ?? ""}>
              <option value="">{t.common.all}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {nameOf(type, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="formId" label={s.form}>
            <Select id="formId" name="formId" defaultValue={query.formId ?? ""}>
              <option value="">{t.common.all}</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {nameOf(form, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="origin" label={s.origin}>
            <Select id="origin" name="origin" defaultValue={query.origin ?? ""}>
              <option value="">{t.common.all}</option>
              {ORIGINS.map((origin) => (
                <option key={origin} value={origin}>
                  {t.labels.origin[origin]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="frequency" label={s.frequency}>
            <Select id="frequency" name="frequency" defaultValue={query.frequency ?? ""}>
              <option value="">{t.common.all}</option>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t.labels.frequency[frequency]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="delivery" label={s.delivery}>
            <Select id="delivery" name="delivery" defaultValue={query.delivery ?? ""}>
              <option value="">{t.common.all}</option>
              <option value="collection">{s.deliveryCollection}</option>
              <option value="delivered">{s.deliveryDelivered}</option>
            </Select>
          </Field>
          <Field id="minQuantityKg" label={s.minQuantity}>
            <TextInput id="minQuantityKg" name="minQuantityKg" type="number" inputMode="decimal" min={0} step="any" defaultValue={query.minQuantityKg ?? ""} autoComplete="off" />
          </Field>
          <Field id="sort" label={s.sort}>
            <Select id="sort" name="sort" defaultValue={query.sort ?? ""}>
              <option value="">{query.scope === "radius" ? s.sortDistance : s.sortNewest}</option>
              {query.scope === "radius" ? <option value="newest">{s.sortNewest}</option> : <option value="distance">{s.sortDistance}</option>}
              <option value="quantity">{s.sortQuantity}</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="submit" className={buttonPrimary}>
          <SearchIcon size={18} />
          {s.apply}
        </button>
        <Link href={action} className={`${linkClass} text-[15px]`}>
          {t.common.resetFilters}
        </Link>
      </div>
    </form>
  );
}
