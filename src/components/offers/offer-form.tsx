"use client";
// Create / edit a material offer (PG-08, wireframes "create offer"): numbered sections that open and close, technical
// fields that follow category and form, a live preview next to the form on wide screens, "Save as draft" and
// "Preview offer". The browser checks with the same schema and rules as the server – the server checks again.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { incompatibleKeys, type AttributeValues } from "@/server/domain/attributes";
import { nameOf, type AttributeDefinition, type Catalogue } from "@/server/domain/catalogue";
import { applicableAttributes } from "@/server/domain/attributes";
import { deliveryMode } from "@/server/domain/delivery";
import {
  COMPARATORS,
  DELIVERY_PRICING,
  DELIVERY_TERMS,
  DOCUMENT_ACCESS,
  EVIDENCE_STATUSES,
  FREQUENCIES,
  LEGAL_STATUSES,
  LOADING_EQUIPMENT,
  MAX_VALIDITY_DAYS,
  ORIGINS,
  PACKAGING,
  PRICE_MODES,
  RECURRENCE_PERIODS,
  SAMPLE_AVAILABILITY,
  VAT_BASES,
  type DeliveryTerm,
  type PriceMode,
} from "@/server/domain/listing";
import { amountRule } from "@/server/domain/price";
import type { OfferDisplayStatus } from "@/server/domain/status";
import type { OfferInput } from "@/server/validation/offers";
import { apiErrorText, apiRequest, fieldErrorText, problemsByField } from "@/lib/api-client";
import { Badge, Notice, buttonPrimary, buttonSecondary, cardClass, grid12 } from "@/components/ui/elements";
import { Choice, Field, FieldGroup, Select, TextArea, TextInput } from "@/components/ui/form";
import { ChevronDownIcon } from "@/components/ui/icons";
import { editOfferPath, previewOfferPath } from "@/components/layout/links";
import { makeFormatters } from "./format";
import { attributesOf, checkForm, emptyAttribute, fromInput, type AttributeState, type FormState } from "./offer-form-state";
import { OfferLivePreview } from "./offer-live-preview";

const SECTIONS = ["material", "quantity", "specs", "origin", "pricing", "delivery", "evidence"] as const;
type SectionKey = (typeof SECTIONS)[number];
const sectionId = (key: SectionKey) => `section-${key}`;

/** Which section a field belongs to – a problem opens its section so the field can take the focus. */
function sectionOf(field: string): SectionKey {
  const name = field.split(".")[0];
  if (["title", "description", "categoryId", "typeId", "formId"].includes(name)) return "material";
  if (["quantity", "unitKey", "minLot", "frequency", "recurrencePeriod", "recurrenceQuantity", "availableFrom", "collectionUntil", "validityDays"].includes(name)) return "quantity";
  if (name === "attributes") return "specs";
  if (["origin", "legalStatus", "wasteCode"].includes(name)) return "origin";
  if (["priceMode", "priceAmount", "priceUnitKey", "vatBasis"].includes(name)) return "pricing";
  if (["evidenceStatus", "datasheetAccess", "sampleAvailable"].includes(name)) return "evidence";
  return "delivery";
}

type Props = {
  mode: "create" | "edit";
  offerId?: number;
  revision?: number;
  status?: OfferDisplayStatus;
  initial: OfferInput;
  catalogue: Catalogue;
  site: { name: string; parkName: string | null; city: string };
  t: PlatformMessages;
  locale: Locale;
  /** Calendar day of the server (YYYY-MM-DD): the same "today" for rendering and for the date rules. */
  today: string;
};

export function OfferForm({ mode, offerId, revision: initialRevision, status = "draft", initial, catalogue, site, t, locale, today }: Props) {
  const router = useRouter();
  const f = t.offerForm;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>(() => fromInput(initial, mode === "create"));
  const [revision, setRevision] = useState(initialRevision ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"draft" | "preview" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ material: true, quantity: true, specs: true, origin: mode === "edit", pricing: mode === "edit", delivery: mode === "edit", evidence: mode === "edit" });
  const [focusErrors, setFocusErrors] = useState(0);
  /** The section the user is in: the one chosen in the list of sections or holding the focus. */
  const [current, setCurrent] = useState<SectionKey>("material");
  /** A section chosen in the list of sections (a new object per click, so the same one can be chosen again). */
  const [jump, setJump] = useState<{ key: SectionKey } | null>(null);
  const format = useMemo(() => makeFormatters(locale, t, catalogue.units), [locale, t, catalogue.units]);
  // A published listing must stay complete; a draft only needs to be valid as far as it is filled in.
  const published = status === "active" || status === "expired";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const setDelivery = (term: DeliveryTerm, change: Partial<FormState["delivery"][DeliveryTerm]>) => set("delivery", { ...state.delivery, [term]: { ...state.delivery[term], ...change } });
  const setAttribute = (key: string, change: Partial<AttributeState>) => set("attributes", { ...state.attributes, [key]: { ...(state.attributes[key] ?? emptyAttribute), ...change } });
  const error = (field: string) => (errors[field] ? fieldErrorText(errors[field], t.errors) : undefined);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // After a failed check: move the focus to the first marked field (its section was opened in the same update).
  useEffect(() => {
    if (focusErrors === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusErrors]);

  // After a click in the list of sections: scroll once the section is open (its height is part of the page then,
  // otherwise the page could be too short to bring it to the top) and put the focus on its heading row.
  useEffect(() => {
    if (!jump) return;
    const target = document.getElementById(sectionId(jump.key));
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    target?.querySelector("summary")?.focus({ preventScroll: true });
  }, [jump]);

  const category = catalogue.categories.find((candidate) => String(candidate.id) === state.categoryId) ?? null;
  const types = catalogue.types.filter((type) => String(type.categoryId) === state.categoryId);
  const forms = catalogue.forms.filter((form) => String(form.categoryId) === state.categoryId);
  const selectedForm = forms.find((form) => String(form.id) === state.formId) ?? null;
  const definitions = attributesOf(state, catalogue);
  const units = catalogue.units.filter((unit) => category?.unitKeys.includes(unit.key));
  const priceRule = state.priceMode ? amountRule(state.priceMode as PriceMode) : "none";
  const delivers = DELIVERY_TERMS.some((term) => state.delivery[term].on && deliveryMode(term) === "delivered");

  function changeCategory(value: string) {
    const next = catalogue.categories.find((candidate) => String(candidate.id) === value);
    setState((current) => ({
      ...current,
      categoryId: value,
      typeId: "",
      formId: "",
      unitKey: next?.unitKeys.includes(current.unitKey) ? current.unitKey : "",
      priceUnitKey: next?.unitKeys.includes(current.priceUnitKey) ? current.priceUnitKey : "",
    }));
    setDirty(true);
  }

  /** Changing the form drops values that no longer apply – after asking (L1-006). */
  function changeForm(value: string) {
    const nextForm = forms.find((form) => String(form.id) === value);
    const next = applicableAttributes(catalogue.attributes, category?.id ?? null, nextForm?.key ?? null);
    const entered: AttributeValues = Object.fromEntries(
      Object.entries(state.attributes).map(([key, entry]) => [key, { valueMin: entry.min === "" ? null : 1, valueMax: entry.max === "" ? null : 1, comparator: null, valueText: entry.text }]),
    );
    const dropped = incompatibleKeys(next, entered);
    if (dropped.length > 0) {
      const names = dropped.map((key) => {
        const definition = catalogue.attributes.find((candidate) => candidate.key === key && candidate.categoryId === category?.id);
        return definition ? nameOf(definition, locale) : key;
      });
      if (!window.confirm(`${f.confirmDrop}\n\n${names.join(", ")}`)) return;
    }
    const kept = Object.fromEntries(Object.entries(state.attributes).filter(([key]) => !dropped.includes(key)));
    setState((current) => ({ ...current, formId: value, attributes: kept }));
    setDirty(true);
  }

  function toggleDelivery(term: DeliveryTerm, on: boolean) {
    // EXW and FCA hand over at the own site: suggest it as the named place.
    const suggestion = on && (term === "exw" || term === "fca") && state.delivery[term].namedPlace === "" ? `${site.name}, ${site.city}` : state.delivery[term].namedPlace;
    setDelivery(term, { on, namedPlace: suggestion });
  }

  /** List of sections: open the chosen one; the effect above then brings it into view. */
  function goTo(key: SectionKey) {
    setOpen((sections) => (sections[key] ? sections : { ...sections, [key]: true }));
    setCurrent(key);
    setJump({ key });
  }

  function showProblems(problems: { field: string; code: string }[]) {
    setErrors(problemsByField(problems));
    setOpen((current) => {
      const next = { ...current };
      for (const problem of problems) next[sectionOf(problem.field)] = true;
      return next;
    });
    setMessage({ tone: "error", text: t.errors.summary });
    setFocusErrors((count) => count + 1);
  }

  async function save(target: "draft" | "preview") {
    setMessage(null);
    const checked = checkForm(state, catalogue, published ? "publish" : "draft", today);
    if (!checked.ok) return showProblems(checked.problems);
    setErrors({});
    setBusy(target);
    const result =
      mode === "create" || offerId === undefined
        ? await apiRequest<{ id: number; revision: number }>("POST", "/api/my/offers", checked.body)
        : await apiRequest<{ id: number; revision: number }>("PUT", `/api/my/offers/${offerId}`, { ...checked.body, expectedRevision: revision });
    setBusy(null);
    if (!result.ok) {
      if (result.error.fields.length > 0) return showProblems(result.error.fields);
      return setMessage({ tone: "error", text: apiErrorText(result.error, t.errors) });
    }
    setDirty(false);
    setRevision(result.data.revision);
    if (target === "preview") return router.push(previewOfferPath(result.data.id));
    if (mode === "create") return router.replace(`${editOfferPath(result.data.id)}?saved=1`);
    setMessage({ tone: "success", text: f.saved });
    router.refresh();
  }

  const options = <T extends string>(values: readonly T[], labels: Record<T, string>, placeholder = true) => (
    <>
      {placeholder && <option value="">{f.choose}</option>}
      {values.map((value) => (
        <option key={value} value={value}>
          {labels[value]}
        </option>
      ))}
    </>
  );

  const section = (key: SectionKey, number: number, title: string, children: ReactNode) => (
    <details
      id={sectionId(key)}
      open={open[key]}
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setOpen((current) => (current[key] === isOpen ? current : { ...current, [key]: isOpen }));
      }}
      onFocusCapture={() => setCurrent(key)}
      className="group scroll-mt-6 rounded-2xl border border-line bg-surface"
    >
      <summary className="flex list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] text-balance">
          {number}. {title}
        </h2>
        <ChevronDownIcon size={20} className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="grid gap-5 border-t border-line p-5 sm:p-6">{children}</div>
    </details>
  );

  // short names for the list of sections (the heading of the third one also names the chosen material form)
  const sectionTitles: Record<SectionKey, string> = { material: f.material, quantity: f.quantitySection, specs: f.specs, origin: f.originSection, pricing: f.pricing, delivery: f.delivery, evidence: f.evidence };

  return (
    // Layout "Form:A" (user, 2026-11-28) on the shared 12-column grid: from 1280 px the list of sections (3 columns),
    // the fields (6) and the live preview (3); from 1024 px fields (8) + preview (4) with the sections as a row
    // above; below that one column.
    <div className={grid12}>
      <nav aria-labelledby="form-sections" className={`${cardClass} grid gap-3 lg:col-span-12 xl:sticky xl:top-6 xl:col-span-3 xl:px-4`}>
        <h2 id="form-sections" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] xl:px-2">
          {f.sections}
        </h2>
        <ol className="flex flex-wrap gap-1 xl:grid">
          {SECTIONS.map((key, index) => (
            <li key={key} className="min-w-0">
              <a
                href={`#${sectionId(key)}`}
                aria-current={current === key ? "step" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  goTo(key);
                }}
                className={`flex min-h-11 items-center gap-3 rounded-lg py-1.5 pr-3 pl-2 text-[15px] leading-snug font-medium hover:bg-mint ${current === key ? "bg-mint" : ""}`}
              >
                <span className={`grid size-7 flex-none place-items-center rounded-full border text-[13px] leading-none font-semibold tabular-nums ${current === key ? "border-brand bg-brand text-white" : "border-line"}`}>
                  {index + 1}
                </span>
                <span className="min-w-0 break-words hyphens-auto">{sectionTitles[key]}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <form
        ref={formRef}
        noValidate
        className="grid min-w-0 gap-4 lg:col-span-8 xl:col-span-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save("preview");
        }}
      >
        {published && <Notice>{f.activeNote}</Notice>}

        {section(
          "material",
          1,
          f.material,
          <>
            <Field id="title" label={f.title} required hint={f.titleHint} error={error("title")}>
              <TextInput id="title" name="title" value={state.title} onChange={(event) => set("title", event.target.value)} maxLength={200} required autoComplete="off" hasHint error={errors.title} />
            </Field>
            <Field id="categoryId" label={f.category} required error={error("categoryId")}>
              <Select id="categoryId" name="categoryId" value={state.categoryId} onChange={(event) => changeCategory(event.target.value)} error={errors.categoryId}>
                <option value="">{f.choose}</option>
                {catalogue.categories.map((candidate) => (
                  <option key={candidate.id} value={candidate.id} disabled={!candidate.enabled}>
                    {nameOf(candidate, locale)}
                    {candidate.enabled ? "" : ` (${f.categoryLater})`}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="typeId" label={f.type} required error={error("typeId")}>
                <Select id="typeId" name="typeId" value={state.typeId} onChange={(event) => set("typeId", event.target.value)} disabled={!category} error={errors.typeId}>
                  <option value="">{f.choose}</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {nameOf(type, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="formId" label={f.form} required error={error("formId")}>
                <Select id="formId" name="formId" value={state.formId} onChange={(event) => changeForm(event.target.value)} disabled={!category} error={errors.formId}>
                  <option value="">{f.choose}</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {nameOf(form, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field id="description" label={f.description} required hint={f.descriptionHint} error={error("description")}>
              <TextArea id="description" name="description" value={state.description} onChange={(event) => set("description", event.target.value)} maxLength={2000} rows={4} hasHint error={errors.description} autoComplete="off" />
            </Field>
          </>,
        )}

        {section(
          "quantity",
          2,
          f.quantitySection,
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="quantity" label={f.quantity} required hint={f.quantityHint} error={error("quantity")}>
                <TextInput id="quantity" name="quantity" inputMode="decimal" value={state.quantity} onChange={(event) => set("quantity", event.target.value)} autoComplete="off" hasHint error={errors.quantity} />
              </Field>
              <Field id="unitKey" label={f.unit} required error={error("unitKey")}>
                <Select id="unitKey" name="unitKey" value={state.unitKey} onChange={(event) => set("unitKey", event.target.value)} disabled={!category} error={errors.unitKey}>
                  <option value="">{f.choose}</option>
                  {units.map((unit) => (
                    <option key={unit.key} value={unit.key}>
                      {nameOf(unit, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="frequency" label={f.frequency} required error={error("frequency")}>
                <Select id="frequency" name="frequency" value={state.frequency} onChange={(event) => set("frequency", event.target.value)} error={errors.frequency}>
                  {options(FREQUENCIES, t.labels.frequency)}
                </Select>
              </Field>
              <Field id="minLot" label={`${f.minLot} (${t.common.optional})`} error={error("minLot")}>
                <TextInput id="minLot" name="minLot" inputMode="decimal" value={state.minLot} onChange={(event) => set("minLot", event.target.value)} autoComplete="off" error={errors.minLot} />
              </Field>
            </div>
            {state.frequency === "recurring" && (
              <div className="grid gap-5 rounded-xl bg-canvas p-4 sm:grid-cols-2">
                <Field id="recurrencePeriod" label={f.period} required error={error("recurrencePeriod")}>
                  <Select id="recurrencePeriod" name="recurrencePeriod" value={state.recurrencePeriod} onChange={(event) => set("recurrencePeriod", event.target.value)} error={errors.recurrencePeriod}>
                    {options(RECURRENCE_PERIODS, t.labels.period)}
                  </Select>
                </Field>
                <Field id="recurrenceQuantity" label={`${f.recurrenceQuantity} (${t.common.optional})`} error={error("recurrenceQuantity")}>
                  <TextInput id="recurrenceQuantity" name="recurrenceQuantity" inputMode="decimal" value={state.recurrenceQuantity} onChange={(event) => set("recurrenceQuantity", event.target.value)} autoComplete="off" error={errors.recurrenceQuantity} />
                </Field>
                <p className="text-[13px] leading-normal text-pretty text-muted sm:col-span-2">{f.recurrenceHint}</p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="availableFrom" label={f.availableFrom} required error={error("availableFrom")}>
                <TextInput id="availableFrom" name="availableFrom" type="date" value={state.availableFrom} onChange={(event) => set("availableFrom", event.target.value)} error={errors.availableFrom} />
              </Field>
              <Field id="collectionUntil" label={`${f.collectionUntil} (${t.common.optional})`} hint={f.collectionUntilHint} error={error("collectionUntil")}>
                <TextInput id="collectionUntil" name="collectionUntil" type="date" min={state.availableFrom || undefined} value={state.collectionUntil} onChange={(event) => set("collectionUntil", event.target.value)} hasHint error={errors.collectionUntil} />
              </Field>
              <Field id="validityDays" label={`${f.validity} (${f.validityDays})`} hint={f.validityHint} error={error("validityDays")}>
                <TextInput id="validityDays" name="validityDays" type="number" inputMode="numeric" min={1} max={MAX_VALIDITY_DAYS} value={state.validityDays} onChange={(event) => set("validityDays", event.target.value)} hasHint error={errors.validityDays} />
              </Field>
            </div>
          </>,
        )}

        {section(
          "specs",
          3,
          selectedForm ? `${f.specsFor} (${nameOf(selectedForm, locale)})` : f.specs,
          definitions.length === 0 ? (
            <p className="text-[15px] text-pretty">{f.specsChoose}</p>
          ) : (
            <>
              <p className="text-[13px] leading-normal text-pretty text-muted">{f.specsHint}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                {definitions.map((definition) => (
                  <AttributeField
                    key={definition.key}
                    definition={definition}
                    value={state.attributes[definition.key] ?? emptyAttribute}
                    onChange={(change) => setAttribute(definition.key, change)}
                    error={error(`attributes.${definition.key}`)}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            </>
          ),
        )}

        {section(
          "origin",
          4,
          f.originSection,
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="origin" label={f.origin} required error={error("origin")}>
              <Select id="origin" name="origin" value={state.origin} onChange={(event) => set("origin", event.target.value)} error={errors.origin}>
                {options(ORIGINS, t.labels.origin)}
              </Select>
            </Field>
            <Field id="legalStatus" label={f.legalStatus} required hint={f.legalHint} error={error("legalStatus")}>
              <Select id="legalStatus" name="legalStatus" value={state.legalStatus} onChange={(event) => set("legalStatus", event.target.value)} hasHint error={errors.legalStatus}>
                {options(LEGAL_STATUSES, t.labels.legalStatus)}
              </Select>
            </Field>
            <Field id="wasteCode" label={`${f.wasteCode} (${t.common.optional})`} hint={f.wasteCodeHint} error={error("wasteCode")}>
              <TextInput id="wasteCode" name="wasteCode" value={state.wasteCode} onChange={(event) => set("wasteCode", event.target.value)} maxLength={20} autoComplete="off" spellCheck={false} hasHint error={errors.wasteCode} />
            </Field>
          </div>,
        )}

        {section(
          "pricing",
          5,
          f.pricing,
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="priceMode" label={f.priceMode} required error={error("priceMode")}>
                <Select id="priceMode" name="priceMode" value={state.priceMode} onChange={(event) => set("priceMode", event.target.value)} error={errors.priceMode}>
                  {options(PRICE_MODES, t.labels.priceMode)}
                </Select>
              </Field>
              {priceRule !== "none" && (
                <Field id="vatBasis" label={f.vatBasis}>
                  <Select id="vatBasis" name="vatBasis" value={state.vatBasis} onChange={(event) => set("vatBasis", event.target.value)}>
                    {options(VAT_BASES, t.labels.vatBasis, false)}
                  </Select>
                </Field>
              )}
            </div>
            {priceRule !== "none" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="priceAmount"
                  label={`${state.priceMode === "paid_recovery" ? f.recoveryFee : f.priceAmount} (€)${priceRule === "optional" ? ` (${t.common.optional})` : ""}`}
                  required={priceRule === "required"}
                  hint={state.priceMode === "paid_recovery" ? f.payerOfferer : undefined}
                  error={error("priceAmount")}
                >
                  <TextInput id="priceAmount" name="priceAmount" inputMode="decimal" value={state.priceAmount} onChange={(event) => set("priceAmount", event.target.value)} autoComplete="off" hasHint={state.priceMode === "paid_recovery"} error={errors.priceAmount} />
                </Field>
                <Field id="priceUnitKey" label={f.priceUnit} error={error("priceUnitKey")}>
                  <Select id="priceUnitKey" name="priceUnitKey" value={state.priceUnitKey} onChange={(event) => set("priceUnitKey", event.target.value)} disabled={!category} error={errors.priceUnitKey}>
                    <option value="">{f.choose}</option>
                    {units.map((unit) => (
                      <option key={unit.key} value={unit.key}>
                        {nameOf(unit, locale)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            <p className="text-[13px] leading-normal text-muted">{f.priceHint}</p>
          </>,
        )}

        {section(
          "delivery",
          6,
          f.delivery,
          <>
            <FieldGroup legend={`${f.deliveryOptions} *`} hint={f.deliveryHint} error={error("deliveryOptions")}>
              {DELIVERY_TERMS.map((term) => {
                const entry = state.delivery[term];
                const placeField = `deliveryOptions.${term}.namedPlace`;
                return (
                  <div key={term} className="grid gap-2 border-b border-line py-2 last:border-b-0">
                    <Choice id={`delivery-${term}`} checked={entry.on} onChange={(event) => toggleDelivery(term, event.target.checked)} label={t.labels.deliveryTerm[term].name} hint={t.labels.deliveryTerm[term].text} />
                    {entry.on && term !== "custom" && (
                      <Field
                        id={`place-${term}`}
                        label={deliveryMode(term) === "delivered" ? f.namedPlaceDelivery : f.namedPlace}
                        required
                        hint={f.namedPlaceHint}
                        error={error(placeField)}
                        className="ml-8"
                      >
                        <TextInput id={`place-${term}`} value={entry.namedPlace} onChange={(event) => setDelivery(term, { namedPlace: event.target.value })} maxLength={200} autoComplete="off" hasHint error={errors[placeField]} />
                      </Field>
                    )}
                    {entry.on && term === "custom" && (
                      <Field id="custom-note" label={f.customNote} required error={error("deliveryOptions.custom.customNote")} className="ml-8">
                        <TextArea id="custom-note" value={entry.customNote} onChange={(event) => setDelivery(term, { customNote: event.target.value })} maxLength={500} rows={3} autoComplete="off" error={errors["deliveryOptions.custom.customNote"]} />
                      </Field>
                    )}
                  </div>
                );
              })}
            </FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              {delivers && (
                <>
                  <Field id="deliveryPricing" label={f.deliveryPricing} required error={error("deliveryPricing")}>
                    <Select id="deliveryPricing" name="deliveryPricing" value={state.deliveryPricing} onChange={(event) => set("deliveryPricing", event.target.value)} error={errors.deliveryPricing}>
                      {options(DELIVERY_PRICING, t.labels.deliveryPricing)}
                    </Select>
                  </Field>
                  <Field id="maxDeliveryDistanceKm" label={`${f.maxDistance} (km, ${t.common.optional})`} error={error("maxDeliveryDistanceKm")}>
                    <TextInput id="maxDeliveryDistanceKm" name="maxDeliveryDistanceKm" inputMode="numeric" value={state.maxDeliveryDistanceKm} onChange={(event) => set("maxDeliveryDistanceKm", event.target.value)} autoComplete="off" error={errors.maxDeliveryDistanceKm} />
                  </Field>
                </>
              )}
              <Field id="packaging" label={`${f.packaging} (${t.common.optional})`}>
                <Select id="packaging" name="packaging" value={state.packaging} onChange={(event) => set("packaging", event.target.value)}>
                  {options(PACKAGING, t.labels.packaging)}
                </Select>
              </Field>
              <Field id="loadingEquipment" label={`${f.loadingEquipment} (${t.common.optional})`}>
                <Select id="loadingEquipment" name="loadingEquipment" value={state.loadingEquipment} onChange={(event) => set("loadingEquipment", event.target.value)}>
                  {options(LOADING_EQUIPMENT, t.labels.loadingEquipment)}
                </Select>
              </Field>
            </div>
            <p className="text-[13px] leading-normal text-muted">
              {f.collectionLocation}: {f.collectionAuto} ({site.name}, {site.city})
            </p>
          </>,
        )}

        {section(
          "evidence",
          7,
          f.evidence,
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="evidenceStatus" label={f.evidenceStatus} required hint={f.evidenceHint} error={error("evidenceStatus")}>
                <Select id="evidenceStatus" name="evidenceStatus" value={state.evidenceStatus} onChange={(event) => set("evidenceStatus", event.target.value)} hasHint error={errors.evidenceStatus}>
                  {options(EVIDENCE_STATUSES, t.labels.evidence)}
                </Select>
              </Field>
              <Field id="sampleAvailable" label={f.sample}>
                <Select id="sampleAvailable" name="sampleAvailable" value={state.sampleAvailable} onChange={(event) => set("sampleAvailable", event.target.value)}>
                  {options(SAMPLE_AVAILABILITY, t.labels.sample, false)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-1">
              <Choice id="datasheetAvailable" checked={state.datasheetAvailable} onChange={(event) => set("datasheetAvailable", event.target.checked)} label={f.datasheet} />
              {state.datasheetAvailable && (
                <Field id="datasheetAccess" label={f.datasheetAccess} className="ml-8 max-w-sm">
                  <Select id="datasheetAccess" name="datasheetAccess" value={state.datasheetAccess} onChange={(event) => set("datasheetAccess", event.target.value)}>
                    {options(DOCUMENT_ACCESS, t.labels.documentAccess, false)}
                  </Select>
                </Field>
              )}
              <Choice id="photosAvailable" checked={state.photosAvailable} onChange={(event) => set("photosAvailable", event.target.checked)} label={f.photos} />
            </div>
            <p className="text-[13px] leading-normal text-muted">{f.noUpload}</p>
          </>,
        )}

        {message && (
          <Notice tone={message.tone} live>
            {message.text}
          </Notice>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save("draft")} disabled={busy !== null} className={buttonSecondary}>
            {busy === "draft" ? t.common.saving : published ? f.saveChanges : f.saveDraft}
          </button>
          <button type="submit" disabled={busy !== null} className={buttonPrimary}>
            {busy === "preview" ? t.common.saving : f.previewOffer}
          </button>
          {dirty && <Badge tone="attention">{f.unsaved}</Badge>}
        </div>
      </form>

      <OfferLivePreview state={state} catalogue={catalogue} site={site} t={t} locale={locale} format={format} />
    </div>
  );
}

/** One technical attribute: the control follows the data type of its definition. */
function AttributeField({
  definition,
  value,
  onChange,
  error,
  t,
  locale,
}: {
  definition: AttributeDefinition;
  value: AttributeState;
  onChange: (change: Partial<AttributeState>) => void;
  error?: string;
  t: PlatformMessages;
  locale: Locale;
}) {
  const id = `attr-${definition.key}`;
  const f = t.offerForm;
  const label = `${nameOf(definition, locale)}${definition.unit ? ` (${definition.unit.replaceAll(" ", "\u00a0")})` : "" /* "g/10 min" never breaks */}`;
  const hint = definition.critical ? f.critical : undefined;
  const invalid = error ? "x" : undefined;

  if (definition.dataType === "enum") {
    return (
      <Field id={id} label={label} hint={hint} error={error}>
        <Select id={id} value={value.text} onChange={(event) => onChange({ text: event.target.value })} hasHint={Boolean(hint)} error={invalid}>
          <option value="">{t.common.unknown}</option>
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option[locale]}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (definition.dataType === "text") {
    return (
      <Field id={id} label={label} hint={hint} error={error}>
        <TextInput id={id} value={value.text} onChange={(event) => onChange({ text: event.target.value })} maxLength={300} autoComplete="off" hasHint={Boolean(hint)} error={invalid} />
      </Field>
    );
  }
  if (definition.dataType === "range") {
    return (
      <Field id={id} label={label} hint={hint} error={error}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <TextInput id={id} inputMode="decimal" placeholder={f.rangeFrom} value={value.min} onChange={(event) => onChange({ min: event.target.value })} autoComplete="off" hasHint={Boolean(hint)} error={invalid} />
          <span aria-hidden="true">–</span>
          <TextInput id={`${id}-max`} inputMode="decimal" placeholder={f.rangeTo} aria-label={`${nameOf(definition, locale)} ${f.rangeTo}`} value={value.max} onChange={(event) => onChange({ max: event.target.value })} autoComplete="off" />
        </div>
      </Field>
    );
  }
  if (definition.dataType === "number") {
    return (
      <Field id={id} label={label} hint={hint} error={error}>
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
          <Select id={`${id}-comparator`} aria-label={`${nameOf(definition, locale)}: ${f.comparator}`} value={value.comparator} onChange={(event) => onChange({ comparator: event.target.value })}>
            <option value="">{t.labels.comparator.eq}</option>
            {COMPARATORS.map((comparator) => (
              <option key={comparator} value={comparator}>
                {t.labels.comparator[comparator]}
              </option>
            ))}
          </Select>
          <TextInput id={id} inputMode="decimal" value={value.min} onChange={(event) => onChange({ min: event.target.value })} autoComplete="off" hasHint={Boolean(hint)} error={invalid} />
        </div>
      </Field>
    );
  }
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <TextInput id={id} inputMode="numeric" value={value.min} onChange={(event) => onChange({ min: event.target.value })} autoComplete="off" hasHint={Boolean(hint)} error={invalid} />
    </Field>
  );
}
