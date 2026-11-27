// Filters of the request search (L2-002): a plain GET form like the offer search, so the URL carries the whole
// state and "Search wider area" is the same URL with another scope. Type and form find requests that accept them.
import Link from "next/link";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import { FREQUENCIES, RADIUS_STEPS_KM } from "@/server/domain/listing";
import type { RequestSearchQuery } from "@/server/validation/requests";
import { buttonPrimary, linkClass } from "@/components/ui/elements";
import { Choice, Field, Select } from "@/components/ui/form";
import { SearchIcon } from "@/components/ui/icons";

/** Query string of a request search without empty values and defaults. */
export function requestParamsOf(query: RequestSearchQuery, overrides: Partial<Record<keyof RequestSearchQuery, string | number | undefined>> = {}): string {
  const merged: Record<string, string | number | undefined> = { ...query, ...overrides };
  if (merged.scope === "park") delete merged.radiusKm;
  if (merged.limit === 50) delete merged.limit;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}

type Props = {
  action: string;
  query: RequestSearchQuery;
  catalogue: Catalogue;
  parks: { id: number; name: string; city: string }[];
  t: PlatformMessages;
  locale: Locale;
  hasOwnPark: boolean;
};

export function RequestFilters({ action, query, catalogue, parks, t, locale, hasOwnPark }: Props) {
  const s = t.search;
  const r = t.requestSearch;
  const ids = new Set(catalogue.categories.filter((category) => category.enabled).map((category) => category.id));
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
          <Field id="typeId" label={r.acceptsType}>
            <Select id="typeId" name="typeId" defaultValue={query.typeId ?? ""}>
              <option value="">{t.common.all}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {nameOf(type, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="formId" label={r.acceptsForm}>
            <Select id="formId" name="formId" defaultValue={query.formId ?? ""}>
              <option value="">{t.common.all}</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {nameOf(form, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="frequency" label={t.requestDetail.frequency}>
            <Select id="frequency" name="frequency" defaultValue={query.frequency ?? ""}>
              <option value="">{r.anyFrequency}</option>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t.labels.frequency[frequency]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="submit" className={buttonPrimary}>
          <SearchIcon size={18} />
          {r.apply}
        </button>
        <Link href={action} className={`${linkClass} text-[15px]`}>
          {t.common.resetFilters}
        </Link>
      </div>
    </form>
  );
}
