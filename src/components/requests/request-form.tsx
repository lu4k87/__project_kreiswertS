"use client";
// Create / edit a material request (PG-18): numbered sections in the order of the page tree – material, quantity
// and timing, technical requirements, origin and evidence, commercial and delivery requirements. Technical fields
// follow category and accepted forms. The browser checks with the same schema and rules as the server.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { nameOf, type AttributeDefinition, type Catalogue } from "@/server/domain/catalogue";
import { DELIVERY_TERMS, FREQUENCIES, MAX_VALIDITY_DAYS, ORIGINS, RECURRENCE_PERIODS } from "@/server/domain/listing";
import type { OfferDisplayStatus } from "@/server/domain/status";
import type { RequestInput } from "@/server/validation/requests";
import { apiErrorText, apiRequest, fieldErrorText, problemsByField } from "@/lib/api-client";
import { Badge, Notice, buttonPrimary, buttonSecondary, cardClass } from "@/components/ui/elements";
import { Choice, Field, FieldGroup, Select, TextArea, TextInput } from "@/components/ui/form";
import { editRequestPath, requestPath } from "@/components/layout/links";
import { checkRequestForm, criteriaOf, emptyCriterion, fromInput, type CriterionState, type RequestFormState } from "./request-form-state";

type Props = {
  mode: "create" | "edit";
  requestId?: number;
  revision?: number;
  status?: OfferDisplayStatus;
  initial: RequestInput;
  catalogue: Catalogue;
  t: PlatformMessages;
  locale: Locale;
  /** Calendar day of the server (YYYY-MM-DD). */
  today: string;
};

/** Toggle one value in a ticked list. */
const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((entry) => entry !== value));

export function RequestForm({ mode, requestId, revision: initialRevision, status = "draft", initial, catalogue, t, locale, today }: Props) {
  const router = useRouter();
  const f = t.requestForm;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<RequestFormState>(() => fromInput(initial, mode === "create"));
  const [revision, setRevision] = useState(initialRevision ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"draft" | "view" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [focusErrors, setFocusErrors] = useState(0);
  const published = status === "active" || status === "expired";

  const set = <K extends keyof RequestFormState>(key: K, value: RequestFormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const setCriterion = (key: string, change: Partial<CriterionState>) =>
    setState((current) => {
      const entry = { ...(current.criteria[key] ?? emptyCriterion), ...change };
      // typing a value into an unused criterion makes it a requirement – the user can still switch it to a preference
      if (entry.kind === "" && !("kind" in change) && (entry.min || entry.max || entry.text)) entry.kind = "required";
      setDirty(true);
      return { ...current, criteria: { ...current.criteria, [key]: entry } };
    });
  const error = (field: string) => (errors[field] ? fieldErrorText(errors[field], t.errors) : undefined);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (focusErrors === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusErrors]);

  const category = catalogue.categories.find((candidate) => String(candidate.id) === state.categoryId) ?? null;
  const types = catalogue.types.filter((type) => String(type.categoryId) === state.categoryId);
  const forms = catalogue.forms.filter((form) => String(form.categoryId) === state.categoryId);
  const units = catalogue.units.filter((unit) => category?.unitKeys.includes(unit.key));
  const definitions = criteriaOf(state, catalogue);

  function changeCategory(value: string) {
    const next = catalogue.categories.find((candidate) => String(candidate.id) === value);
    setState((current) => ({
      ...current,
      categoryId: value,
      typeIds: [],
      formIds: [],
      criteria: {},
      unitKey: next?.unitKeys.includes(current.unitKey) ? current.unitKey : "",
      maxPriceUnitKey: next?.unitKeys.includes(current.maxPriceUnitKey) ? current.maxPriceUnitKey : "",
    }));
    setDirty(true);
  }

  function showProblems(problems: { field: string; code: string }[]) {
    setErrors(problemsByField(problems));
    setMessage({ tone: "error", text: t.errors.summary });
    setFocusErrors((count) => count + 1);
  }

  async function save(target: "draft" | "view") {
    setMessage(null);
    const checked = checkRequestForm(state, catalogue, published ? "publish" : "draft", today);
    if (!checked.ok) return showProblems(checked.problems);
    setErrors({});
    setBusy(target);
    const result =
      mode === "create" || requestId === undefined
        ? await apiRequest<{ id: number; revision: number }>("POST", "/api/my/requests", checked.body)
        : await apiRequest<{ id: number; revision: number }>("PUT", `/api/my/requests/${requestId}`, { ...checked.body, expectedRevision: revision });
    setBusy(null);
    if (!result.ok) {
      if (result.error.fields.length > 0) return showProblems(result.error.fields);
      return setMessage({ tone: "error", text: apiErrorText(result.error, t.errors) });
    }
    setDirty(false);
    setRevision(result.data.revision);
    if (target === "view") return router.push(requestPath(result.data.id));
    if (mode === "create") return router.replace(`${editRequestPath(result.data.id)}?saved=1`);
    setMessage({ tone: "success", text: f.saved });
    router.refresh();
  }

  const options = <T extends string>(values: readonly T[], labels: Record<T, string>, placeholder = true) => (
    <>
      {placeholder && <option value="">{t.offerForm.choose}</option>}
      {values.map((value) => (
        <option key={value} value={value}>
          {labels[value]}
        </option>
      ))}
    </>
  );

  const section = (number: number, title: string, children: ReactNode) => (
    <section className={cardClass} aria-labelledby={`request-section-${number}`}>
      <h2 id={`request-section-${number}`} className="mb-5 text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] text-balance">
        {number}. {title}
      </h2>
      <div className="grid gap-5">{children}</div>
    </section>
  );

  return (
    <form
      ref={formRef}
      noValidate
      className="grid min-w-0 gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save("view");
      }}
    >
      {published && <Notice>{f.activeNote}</Notice>}

      {section(
        1,
        f.material,
        <>
          <Field id="title" label={f.title} required hint={f.titleHint} error={error("title")}>
            <TextInput id="title" name="title" value={state.title} onChange={(event) => set("title", event.target.value)} maxLength={200} autoComplete="off" hasHint error={errors.title} />
          </Field>
          <Field id="categoryId" label={f.category} required error={error("categoryId")}>
            <Select id="categoryId" name="categoryId" value={state.categoryId} onChange={(event) => changeCategory(event.target.value)} error={errors.categoryId}>
              <option value="">{t.offerForm.choose}</option>
              {catalogue.categories.map((candidate) => (
                <option key={candidate.id} value={candidate.id} disabled={!candidate.enabled}>
                  {nameOf(candidate, locale)}
                  {candidate.enabled ? "" : ` (${t.offerForm.categoryLater})`}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <FieldGroup legend={`${f.types} *`} hint={f.typesHint} error={error("typeIds")}>
              <div className="grid grid-cols-2 gap-x-4">
                {types.map((type) => (
                  <Choice
                    key={type.id}
                    id={`type-${type.id}`}
                    checked={state.typeIds.includes(String(type.id))}
                    onChange={(event) => set("typeIds", toggle(state.typeIds, String(type.id), event.target.checked))}
                    label={nameOf(type, locale)}
                  />
                ))}
              </div>
            </FieldGroup>
            <FieldGroup legend={`${f.forms} *`} hint={f.formsHint} error={error("formIds")}>
              {forms.map((form) => (
                <Choice
                  key={form.id}
                  id={`form-${form.id}`}
                  checked={state.formIds.includes(String(form.id))}
                  onChange={(event) => set("formIds", toggle(state.formIds, String(form.id), event.target.checked))}
                  label={nameOf(form, locale)}
                />
              ))}
            </FieldGroup>
          </div>
          <Field id="description" label={f.description} required hint={f.descriptionHint} error={error("description")}>
            <TextArea id="description" name="description" value={state.description} onChange={(event) => set("description", event.target.value)} maxLength={2000} rows={4} hasHint error={errors.description} autoComplete="off" />
          </Field>
        </>,
      )}

      {section(
        2,
        f.quantitySection,
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="quantity" label={f.quantity} required error={error("quantity")}>
              <TextInput id="quantity" name="quantity" inputMode="decimal" value={state.quantity} onChange={(event) => set("quantity", event.target.value)} autoComplete="off" error={errors.quantity} />
            </Field>
            <Field id="unitKey" label={f.unit} required error={error("unitKey")}>
              <Select id="unitKey" name="unitKey" value={state.unitKey} onChange={(event) => set("unitKey", event.target.value)} disabled={!category} error={errors.unitKey}>
                <option value="">{t.offerForm.choose}</option>
                {units.map((unit) => (
                  <option key={unit.key} value={unit.key}>
                    {nameOf(unit, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="minLot" label={`${f.minLot} (${t.common.optional})`} hint={f.minLotHint} error={error("minLot")}>
              <TextInput id="minLot" name="minLot" inputMode="decimal" value={state.minLot} onChange={(event) => set("minLot", event.target.value)} autoComplete="off" hasHint error={errors.minLot} />
            </Field>
            <Field id="frequency" label={f.frequency} required error={error("frequency")}>
              <Select id="frequency" name="frequency" value={state.frequency} onChange={(event) => set("frequency", event.target.value)} error={errors.frequency}>
                {options(FREQUENCIES, t.labels.frequency)}
              </Select>
            </Field>
            {state.frequency === "recurring" && (
              <Field id="recurrencePeriod" label={f.period} required error={error("recurrencePeriod")}>
                <Select id="recurrencePeriod" name="recurrencePeriod" value={state.recurrencePeriod} onChange={(event) => set("recurrencePeriod", event.target.value)} error={errors.recurrencePeriod}>
                  {options(RECURRENCE_PERIODS, t.labels.period)}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="neededFrom" label={`${f.neededFrom} (${t.common.optional})`} error={error("neededFrom")}>
              <TextInput id="neededFrom" name="neededFrom" type="date" value={state.neededFrom} onChange={(event) => set("neededFrom", event.target.value)} error={errors.neededFrom} />
            </Field>
            <Field id="neededUntil" label={`${f.neededUntil} (${t.common.optional})`} error={error("neededUntil")}>
              <TextInput id="neededUntil" name="neededUntil" type="date" min={state.neededFrom || undefined} value={state.neededUntil} onChange={(event) => set("neededUntil", event.target.value)} error={errors.neededUntil} />
            </Field>
            <Field id="validityDays" label={`${f.validity} (${f.validityDays})`} hint={f.validityHint} error={error("validityDays")}>
              <TextInput id="validityDays" name="validityDays" type="number" inputMode="numeric" min={1} max={MAX_VALIDITY_DAYS} value={state.validityDays} onChange={(event) => set("validityDays", event.target.value)} hasHint error={errors.validityDays} />
            </Field>
          </div>
        </>,
      )}

      {section(
        3,
        f.specs,
        definitions.length === 0 ? (
          <p className="text-[15px] text-pretty">{f.specsChoose}</p>
        ) : (
          <>
            <p className="max-w-[68ch] text-[13px] leading-normal text-pretty text-muted">{f.specsHint}</p>
            <ul className="grid gap-3">
              {definitions.map((definition) => (
                <CriterionRow
                  key={definition.key}
                  definition={definition}
                  value={state.criteria[definition.key] ?? emptyCriterion}
                  onChange={(change) => setCriterion(definition.key, change)}
                  error={error(`criteria.${definition.key}`)}
                  t={t}
                  locale={locale}
                />
              ))}
            </ul>
          </>
        ),
      )}

      {section(
        4,
        f.originSection,
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldGroup legend={f.origins} hint={f.originsHint}>
            {ORIGINS.filter((origin) => origin !== "unknown").map((origin) => (
              <Choice key={origin} id={`origin-${origin}`} checked={state.origins.includes(origin)} onChange={(event) => set("origins", toggle(state.origins, origin, event.target.checked))} label={t.labels.origin[origin]} />
            ))}
          </FieldGroup>
          <div className="grid content-start gap-4">
            <Field id="evidenceStatus" label={f.minEvidence} hint={f.minEvidenceHint}>
              <Select id="evidenceStatus" name="evidenceStatus" value={state.evidenceStatus} onChange={(event) => set("evidenceStatus", event.target.value)} hasHint>
                <option value="">{t.requestDetail.anyEvidence}</option>
                {(["self_declared", "documented", "tested"] as const).map((value) => (
                  <option key={value} value={value}>
                    {t.labels.evidence[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Choice id="sampleRequired" checked={state.sampleRequired} onChange={(event) => set("sampleRequired", event.target.checked)} label={f.sampleRequired} />
          </div>
        </div>,
      )}

      {section(
        5,
        f.commercial,
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="maxPriceAmount" label={`${f.maxPrice} (${t.common.optional})`} hint={f.maxPriceHint} error={error("maxPriceAmount")}>
              <TextInput id="maxPriceAmount" name="maxPriceAmount" inputMode="decimal" value={state.maxPriceAmount} onChange={(event) => set("maxPriceAmount", event.target.value)} autoComplete="off" hasHint error={errors.maxPriceAmount} />
            </Field>
            <Field id="maxPriceUnitKey" label={f.maxPriceUnit} error={error("maxPriceUnitKey")}>
              <Select id="maxPriceUnitKey" name="maxPriceUnitKey" value={state.maxPriceUnitKey} onChange={(event) => set("maxPriceUnitKey", event.target.value)} disabled={!category} error={errors.maxPriceUnitKey}>
                <option value="">{t.offerForm.choose}</option>
                {units.map((unit) => (
                  <option key={unit.key} value={unit.key}>
                    {nameOf(unit, locale)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <FieldGroup legend={f.deliveryTerms} hint={f.deliveryHint}>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {DELIVERY_TERMS.map((term) => (
                <Choice
                  key={term}
                  id={`delivery-${term}`}
                  checked={state.deliveryTerms.includes(term)}
                  onChange={(event) => set("deliveryTerms", toggle(state.deliveryTerms, term, event.target.checked))}
                  label={t.labels.deliveryTerm[term].name}
                  hint={t.labels.deliveryTerm[term].text}
                />
              ))}
            </div>
          </FieldGroup>
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
          {busy === "view" ? t.common.saving : f.saveAndView}
        </button>
        {dirty && <Badge tone="attention">{f.unsaved}</Badge>}
      </div>
    </form>
  );
}

/** One technical criterion: use (requirement / preference / not used) and the accepted range or value. */
function CriterionRow({
  definition,
  value,
  onChange,
  error,
  t,
  locale,
}: {
  definition: AttributeDefinition;
  value: CriterionState;
  onChange: (change: Partial<CriterionState>) => void;
  error?: string;
  t: PlatformMessages;
  locale: Locale;
}) {
  const f = t.requestForm;
  const id = `crit-${definition.key}`;
  const name = nameOf(definition, locale);
  const label = `${name}${definition.unit ? ` (${definition.unit.replaceAll(" ", "\u00a0")})` : "" /* "g/10 min" never breaks */}`;
  const invalid = error ? "x" : undefined;
  const numeric = definition.dataType === "number" || definition.dataType === "range" || definition.dataType === "integer";

  return (
    <li className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <Field id={`${id}-kind`} label={label}>
        <Select id={`${id}-kind`} value={value.kind} onChange={(event) => onChange({ kind: event.target.value as CriterionState["kind"] })} aria-label={`${name}: ${f.criterionKind}`}>
          <option value="">{f.notUsed}</option>
          <option value="required">{t.l2labels.criterionKind.required}</option>
          <option value="preferred">{t.l2labels.criterionKind.preferred}</option>
        </Select>
      </Field>
      <Field id={id} label={numeric ? `${f.rangeFrom} – ${f.rangeTo}` : f.textValue} error={error}>
        {numeric ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <TextInput id={id} inputMode="decimal" placeholder={f.rangeFrom} value={value.min} onChange={(event) => onChange({ min: event.target.value })} autoComplete="off" error={invalid} />
            <span aria-hidden="true">–</span>
            <TextInput id={`${id}-max`} inputMode="decimal" placeholder={f.rangeTo} aria-label={`${name} ${f.rangeTo}`} value={value.max} onChange={(event) => onChange({ max: event.target.value })} autoComplete="off" />
          </div>
        ) : definition.dataType === "enum" ? (
          <Select id={id} value={value.text} onChange={(event) => onChange({ text: event.target.value })} error={invalid}>
            <option value="">{f.anyValue}</option>
            {definition.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option[locale]}
              </option>
            ))}
          </Select>
        ) : (
          <TextInput id={id} value={value.text} onChange={(event) => onChange({ text: event.target.value })} maxLength={300} autoComplete="off" error={invalid} />
        )}
      </Field>
    </li>
  );
}
