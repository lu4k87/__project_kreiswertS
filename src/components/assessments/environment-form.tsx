"use client";
// Inputs of the environmental assessment (L2-008): quantity and use, the existing route (baseline) and the proposed
// one, each factor chosen from the list of factors whose unit and boundary fit the step. Saved for the viewer's site
// only; the release for the own circularity overview is a separate step.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { slotAccepts, type Slot } from "@/server/domain/environment";
import type { FactorView } from "@/server/dal/assessments";
import type { EnvironmentalInput } from "@/server/validation/assessments";
import { apiRequest } from "@/lib/api-client";
import { Notice, buttonPrimary, buttonSecondary } from "@/components/ui/elements";
import { Choice, Field, Select, TextArea, TextInput } from "@/components/ui/form";
import { CheckIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { numberOf } from "@/components/negotiations/proposal-form";
import { assessmentErrorText, assessmentFieldErrors } from "./assessment-errors";

type Props = {
  subject: { kind: "match"; requestId: number; offerId: number };
  revision: number | null;
  initial: EnvironmentalInput;
  factors: FactorView[];
  units: { key: string; label: string }[];
  t: PlatformMessages;
  locale: Locale;
};

const text = (value: number | null | undefined) => (value == null ? "" : String(value));
const idOf = (value: FormDataEntryValue | null) => (value == null || value === "" ? null : Number(value));

export function EnvironmentForm({ subject, revision, initial, factors, units, t, locale }: Props) {
  const router = useRouter();
  const e = t.environment;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState(initial.existing != null);
  const id = (name: string) => `environment-${name}`;

  const options = (slot: Slot) =>
    factors
      .filter((factor) => slotAccepts(slot, factor))
      .map((factor) => (
        <option key={factor.id} value={factor.id}>
          {locale === "de" ? factor.nameDe : factor.nameEn} ({factor.value} {t.assessmentLabels.factorUnit[factor.unit]}, {factor.version}, {factor.example ? t.factorSource.exampleTag : t.factorSource.sourcedTag})
        </option>
      ));
  const factorSelect = (slot: Slot, name: string, label: string, value: number | null | undefined, field = slot) => (
    <Field id={id(name)} label={label} error={fields[field]}>
      <Select id={id(name)} name={name} defaultValue={value == null ? "" : String(value)} error={fields[field]}>
        <option value="">{e.choose}</option>
        {options(slot)}
      </Select>
    </Field>
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const processing = String(data.get("processingFactorId") ?? "");
    const inputs = {
      quantity: numberOf(data.get("quantity")),
      unitKey: data.get("unitKey"),
      yieldPercent: numberOf(data.get("yieldPercent")),
      substitutionPercent: numberOf(data.get("substitutionPercent")),
      existing: existing ? { treatmentFactorId: idOf(data.get("treatmentFactorId")), distanceKm: numberOf(data.get("existingDistanceKm")) } : null,
      processingFactorId: processing === "" ? null : processing === "none" ? "none" : Number(processing),
      proposedDistanceKm: numberOf(data.get("proposedDistanceKm")),
      residueTreatmentFactorId: idOf(data.get("residueTreatmentFactorId")),
      virginProductionFactorId: idOf(data.get("virginProductionFactorId")),
      transportFactorId: idOf(data.get("transportFactorId")),
      assumptions: String(data.get("assumptions") ?? "").trim() || null,
    };
    setBusy(true);
    setError("");
    setFields({});
    const result = await apiRequest<{ id: number }>("PUT", "/api/my/assessments", { type: "environmental", subject, expectedRevision: revision, inputs });
    setBusy(false);
    if (!result.ok) {
      setFields(assessmentFieldErrors(result.error, t));
      return setError(assessmentErrorText(result.error, t));
    }
    router.refresh();
  }

  const group = "grid gap-4 sm:grid-cols-2";
  const legend = "mb-3 text-lg leading-tight font-semibold";
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate aria-label={e.title}>
      <fieldset className="min-w-0">
        <legend className={legend}>{e.quantityGroup}</legend>
        <div className={group}>
          <Field id={id("quantity")} label={e.quantity} required error={fields.quantity}>
            <TextInput id={id("quantity")} name="quantity" inputMode="decimal" defaultValue={text(initial.quantity)} autoComplete="off" error={fields.quantity} />
          </Field>
          <Field id={id("unit")} label={e.unit} required error={fields.unitKey}>
            <Select id={id("unit")} name="unitKey" defaultValue={initial.unitKey} error={fields.unitKey}>
              {units.map((unit) => (
                <option key={unit.key} value={unit.key}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("yield")} label={e.yieldPercent} error={fields.yieldPercent}>
            <TextInput id={id("yield")} name="yieldPercent" inputMode="decimal" defaultValue={text(initial.yieldPercent)} autoComplete="off" error={fields.yieldPercent} />
          </Field>
          <Field id={id("substitution")} label={e.substitutionPercent} hint={e.substitutionHint} error={fields.substitutionPercent}>
            <TextInput id={id("substitution")} name="substitutionPercent" inputMode="decimal" defaultValue={text(initial.substitutionPercent)} autoComplete="off" hasHint error={fields.substitutionPercent} />
          </Field>
          <div className="sm:col-span-2">{factorSelect("virginProduction", "virginProductionFactorId", e.virginProduction, initial.virginProductionFactorId)}</div>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>{e.existingGroup}</legend>
        <div className="grid gap-4">
          <Choice id={id("existing")} label={e.describeExisting} hint={e.existingHint} checked={existing} onChange={(event) => setExisting(event.target.checked)} />
          {existing && (
            <div className={group}>
              {factorSelect("existingTreatment", "treatmentFactorId", e.treatment, initial.existing?.treatmentFactorId)}
              <Field id={id("existing-distance")} label={e.existingDistance} error={fields["existing.distanceKm"]}>
                <TextInput id={id("existing-distance")} name="existingDistanceKm" inputMode="decimal" defaultValue={text(initial.existing?.distanceKm)} autoComplete="off" error={fields["existing.distanceKm"]} />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>{e.proposedGroup}</legend>
        <div className={group}>
          <Field id={id("processing")} label={e.processing} error={fields.processing}>
            <Select id={id("processing")} name="processingFactorId" defaultValue={initial.processingFactorId == null ? "" : String(initial.processingFactorId)} error={fields.processing}>
              <option value="">{e.processingUnknown}</option>
              <option value="none">{e.processingNone}</option>
              {options("processing")}
            </Select>
          </Field>
          <Field id={id("proposed-distance")} label={e.proposedDistance} hint={e.proposedDistanceHint} error={fields.proposedDistanceKm}>
            <TextInput id={id("proposed-distance")} name="proposedDistanceKm" inputMode="decimal" defaultValue={text(initial.proposedDistanceKm)} autoComplete="off" hasHint error={fields.proposedDistanceKm} />
          </Field>
          {factorSelect("residueTreatment", "residueTreatmentFactorId", e.residueTreatment, initial.residueTreatmentFactorId)}
          {factorSelect("transport", "transportFactorId", e.transport, initial.transportFactorId)}
          <Field id={id("assumptions")} label={e.assumptions} hint={e.assumptionsHint} className="sm:col-span-2" error={fields.assumptions}>
            <TextArea id={id("assumptions")} name="assumptions" maxLength={2000} defaultValue={initial.assumptions ?? ""} hasHint error={fields.assumptions} />
          </Field>
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}
      <p>
        <button type="submit" className={buttonPrimary} disabled={busy}>
          <CheckIcon size={18} />
          {busy ? t.feasibility.saving : e.save}
        </button>
      </p>
    </form>
  );
}

/** Release a saved, comparative result for the own circularity overview (PG-27). */
export function ApproveButton({ assessmentId, revision, t }: { assessmentId: number; revision: number; t: PlatformMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function approve() {
    setBusy(true);
    setError("");
    const result = await apiRequest("POST", `/api/my/assessments/${assessmentId}/approve`, { expectedRevision: revision });
    setBusy(false);
    if (!result.ok) {
      const code = result.error.fields[0]?.code;
      return setError((code && t.assessmentLabels.errors[code]) || assessmentErrorText(result.error, t));
    }
    router.refresh();
  }
  return (
    <div className="grid gap-3">
      <p className="prose-justify text-[15px] leading-relaxed">{t.environment.approveText}</p>
      <button type="button" className={`${buttonSecondary} justify-self-start`} onClick={approve} disabled={busy}>
        <ShieldCheckIcon size={18} />
        {t.environment.approve}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
