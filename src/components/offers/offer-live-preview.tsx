"use client";
// Live preview next to the offer form (wireframe "accordion + live preview"): shows while typing how the offer
// will read – title, place, quantity, technical specifications, material, price and delivery. The full preview
// with the publish check is a separate step (/my-offers/[id]/preview).
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { formatAttributeValue, isUnknown, type AttributeValue } from "@/server/domain/attributes";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import { DELIVERY_TERMS, type Comparator } from "@/server/domain/listing";
import { Facts } from "@/components/ui/elements";
import { InfoIcon, MapPinIcon } from "@/components/ui/icons";
import { MaterialPhoto } from "@/components/ui/material-photo";
import type { Formatters } from "./format";
import { attributesOf, emptyAttribute, parseDecimal, type FormState } from "./offer-form-state";

type Props = {
  state: FormState;
  catalogue: Catalogue;
  site: { name: string; parkName: string | null; city: string };
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
};

/** A number for display only: text that is not a number shows as unknown here, the form marks the field on saving. */
const shown = (value: string) => {
  const parsed = parseDecimal(value);
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
};

export function OfferLivePreview({ state, catalogue, site, t, locale, format }: Props) {
  const f = t.offerForm;
  const category = catalogue.categories.find((candidate) => String(candidate.id) === state.categoryId);
  const type = catalogue.types.find((candidate) => String(candidate.id) === state.typeId);
  const form = catalogue.forms.find((candidate) => String(candidate.id) === state.formId);
  const heading = state.title.trim() || [type && nameOf(type, locale), form && nameOf(form, locale)].filter(Boolean).join(" — ");
  const price = format.price({ priceMode: state.priceMode || null, priceAmount: shown(state.priceAmount), priceUnitKey: state.priceUnitKey || null, vatBasis: state.vatBasis, payer: null });
  const terms = DELIVERY_TERMS.filter((term) => state.delivery[term].on);

  const specs = attributesOf(state, catalogue)
    .map((definition) => {
      const entry = state.attributes[definition.key] ?? emptyAttribute;
      const numeric = definition.dataType !== "text" && definition.dataType !== "enum";
      const value: AttributeValue = {
        valueMin: numeric ? (shown(entry.min) ?? shown(entry.max)) : null,
        valueMax: definition.dataType === "range" && shown(entry.min) != null ? shown(entry.max) : null,
        comparator: definition.dataType === "number" && entry.comparator ? (entry.comparator as Comparator) : null,
        valueText: numeric ? null : entry.text.trim() || null,
      };
      return { definition, value };
    })
    .filter(({ definition, value }) => !isUnknown(value) || definition.critical)
    .map(({ definition, value }) => ({ label: nameOf(definition, locale), value: isUnknown(value) ? t.common.unknown : formatAttributeValue(definition, value, locale) }));

  return (
    // From 1024 px a narrow column next to the fields that stays in view; taller than the window → it scrolls itself.
    <aside
      className="scroll-thin grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-6 lg:col-span-4 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto xl:col-span-3"
      aria-labelledby="live-preview"
    >
      <h2 id="live-preview" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
        {f.previewTitle}
      </h2>
      <MaterialPhoto form={form?.key} sizes="320px" className="h-28 w-full" />
      {heading ? (
        <>
          <div>
            <p className="text-lg leading-snug font-semibold break-words text-balance">{heading}</p>
            <p className="mt-1 flex items-start gap-2 text-[13px]">
              <MapPinIcon size={15} className="mt-px" />
              {[site.parkName, site.city].filter(Boolean).join(", ")}
            </p>
          </div>
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-3 border-y border-line py-4 lg:grid-cols-[minmax(0,1fr)]">
            <div className="min-w-0">
              <dd className="text-lg leading-tight font-semibold tabular-nums">{format.quantity(shown(state.quantity), state.unitKey || null)}</dd>
              <dt className="text-[13px] text-muted">{t.search.available}</dt>
            </div>
            <div className="min-w-0">
              <dd className="text-lg leading-tight font-semibold break-words hyphens-auto">{format.frequency(state.frequency || null, state.recurrencePeriod || null)}</dd>
              <dt className="text-[13px] text-muted">{f.frequency}</dt>
            </div>
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <dd className="text-lg leading-tight font-semibold tabular-nums">{price.main}</dd>
              <dt className="text-[13px] text-muted">{price.notes.length > 0 ? price.notes.join(" · ") : t.detail.price}</dt>
            </div>
          </dl>
          {specs.length > 0 && (
            <div>
              <h3 className="text-lg leading-tight font-semibold">{f.specs}</h3>
              <Facts rows={specs} layout="rail" />
            </div>
          )}
          <div>
            <h3 className="text-lg leading-tight font-semibold">{f.material}</h3>
            <Facts
              layout="rail"
              rows={[
                { label: t.detail.category, value: category ? nameOf(category, locale) : t.common.notStated },
                { label: t.detail.type, value: type ? nameOf(type, locale) : t.common.notStated },
                { label: t.detail.form, value: form ? nameOf(form, locale) : t.common.notStated },
                { label: f.deliveryOptions, value: terms.length > 0 ? terms.map((term) => (term === "custom" ? t.detail.byArrangement : term.toUpperCase())).join(", ") : t.common.notStated },
              ]}
            />
          </div>
        </>
      ) : (
        <p className="text-[15px] text-pretty">{f.previewEmpty}</p>
      )}
      <p className="flex items-start gap-2 rounded-xl bg-mint px-3 py-2.5 text-[13px] leading-normal">
        <InfoIcon size={16} className="mt-px" />
        {f.previewNote}
      </p>
    </aside>
  );
}
