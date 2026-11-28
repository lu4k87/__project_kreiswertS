// Filters of the offer search (L1-013, L1-014), shared by the list (/offers) and the map (/map): a plain GET form,
// so the URL carries the whole state and "Search wider area" is just the same URL with another scope.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import { FREQUENCIES, ORIGINS, RADIUS_STEPS_KM } from "@/server/domain/listing";
import type { OfferSearchQuery } from "@/server/validation/offers";
import { buttonPrimary, linkClass } from "@/components/ui/elements";
import { Choice, Field, Select, TextInput } from "@/components/ui/form";
import { SearchIcon } from "@/components/ui/icons";

/** Query string of a search, without empty values and defaults – used for "widen", "list / map" and paging links. */
export function searchParamsOf(query: OfferSearchQuery, overrides: Partial<Record<keyof OfferSearchQuery | "site" | "group", string | number | undefined>> = {}): string {
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
  /** "panel": a narrow column next to the content (map). "bar": full width above the results (offer list) – the
   *  search area in the first row, the seven filters in the second. */
  layout?: "panel" | "bar";
};

export function SearchFilters({ action, query, catalogue, parks, t, locale, hasOwnPark, layout = "panel" }: Props) {
  const s = t.search;
  const bar = layout === "bar";
  const enabled = catalogue.categories.filter((category) => category.enabled);
  const ids = new Set(enabled.map((category) => category.id));
  const types = catalogue.types.filter((type) => ids.has(type.categoryId));
  const forms = catalogue.forms.filter((form) => ids.has(form.categoryId));
  // A named group of fields. In the bar its name stands in a fixed column on the left from 1024 px.
  const group = (id: string, legend: string, children: ReactNode, divider = false) => (
    <div role="group" aria-labelledby={id} className={`grid gap-x-6 gap-y-3 ${bar ? "lg:grid-cols-[9rem_minmax(0,1fr)]" : ""} ${divider ? "border-t border-line pt-5" : ""}`}>
      <p id={id} className={`text-lg leading-tight font-semibold ${bar ? "lg:pt-1.5" : ""}`}>
        {legend}
      </p>
      <div className="grid min-w-0 gap-3">{children}</div>
    </div>
  );
  return (
    <form method="get" action={action} className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label={s.filters}>
      {group(
        "filter-scope",
        s.scope,
        <>
          <div className={`grid gap-x-6 gap-y-2 sm:grid-cols-2 ${bar ? "" : "lg:grid-cols-1"}`}>
            <Choice id="scope-park" type="radio" name="scope" value="park" defaultChecked={query.scope === "park"} label={s.scopePark} />
            <Choice id="scope-radius" type="radio" name="scope" value="radius" defaultChecked={query.scope === "radius"} label={s.scopeRadius} />
          </div>
          <div className={`grid gap-x-6 gap-y-4 sm:grid-cols-2 ${bar ? "" : "lg:grid-cols-1"}`}>
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
        </>,
      )}

      {group(
        "filter-more",
        s.filters,
        // Bar: all seven in one row from 1280 px (eight tracks, the sorting takes two so its value is not cut off);
        // `items-end` keeps the fields on one line when a label needs two lines.
        <div className={`grid gap-4 sm:grid-cols-2 ${bar ? "items-end md:grid-cols-4 md:gap-x-3 xl:grid-cols-8" : "lg:grid-cols-1"}`}>
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
          <Field id="sort" label={s.sort} className={bar ? "xl:col-span-2" : ""}>
            <Select id="sort" name="sort" defaultValue={query.sort ?? ""}>
              <option value="">{query.scope === "radius" ? s.sortDistance : s.sortNewest}</option>
              {query.scope === "radius" ? <option value="newest">{s.sortNewest}</option> : <option value="distance">{s.sortDistance}</option>}
              <option value="quantity">{s.sortQuantity}</option>
              <option value="deadline">{s.sortDeadline}</option>
            </Select>
          </Field>
        </div>,
        true,
      )}

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
