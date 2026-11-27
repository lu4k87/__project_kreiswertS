"use client";
// Inputs of the economic feasibility (L2-007): on a match the common basis (quantity, price, freight) is the viewer's
// assumption, in a negotiation it comes from the proposal and only the own figures are entered. Everything is saved
// for the viewer's site only; the server calculates and checks again.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { COST_BASES, type CostBasis, type Party } from "@/server/domain/feasibility";
import { COST_STATUSES, FREIGHT_PAYERS, PAYMENT_DIRECTIONS, type CostStatus, type FreightPayer, type PaymentDirection } from "@/server/domain/negotiation";
import type { AssessmentSubject } from "@/server/domain/assessment";
import type { MatchFeasibilityInput, PrivateFeasibilityInput } from "@/server/validation/assessments";
import { apiRequest } from "@/lib/api-client";
import { Notice, buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { Choice, Field, Select, TextInput } from "@/components/ui/form";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { numberOf } from "@/components/negotiations/proposal-form";
import { assessmentErrorText, assessmentFieldErrors } from "./assessment-errors";

type Props = {
  subject: AssessmentSubject;
  /** Saved revision; null = nothing saved yet. */
  revision: number | null;
  party: Party;
  /** Match: common basis + own figures; negotiation: own figures only. */
  initial: MatchFeasibilityInput | PrivateFeasibilityInput;
  units: { key: string; label: string }[];
  /** Unit of the quantity, for the per-unit labels. */
  unitLabel: string;
  t: PlatformMessages;
};

type CostRow = { key: number; label: string; basis: CostBasis; amount: string; status: CostStatus };

const text = (value: number | null | undefined) => (value == null ? "" : String(value));
const isMatch = (initial: Props["initial"]): initial is MatchFeasibilityInput => "quantity" in initial;

export function FeasibilityForm({ subject, revision, party, initial, units, unitLabel, t }: Props) {
  const router = useRouter();
  const f = t.feasibility;
  const l = t.tradeLabels;
  const match = isMatch(initial) ? initial : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<PaymentDirection>(match?.paymentDirection ?? "requester_pays");
  const [included, setIncluded] = useState(match?.priceIncludesFreight ?? false);
  const [freightGiven, setFreightGiven] = useState(match?.freight != null);
  const [freightPayer, setFreightPayer] = useState<FreightPayer>(match?.freight?.payer ?? "shared");
  const [costs, setCosts] = useState<CostRow[]>(() => initial.costs.map((cost, index) => ({ key: index, ...cost, amount: text(cost.amount) })));
  const [nextKey, setNextKey] = useState(initial.costs.length);
  const id = (name: string) => `feasibility-${name}`;

  function updateCost(key: number, change: Partial<CostRow>) {
    setCosts((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const own = {
      yieldPercent: party === "requester" ? numberOf(data.get("yieldPercent")) : null,
      costs: costs.map((row) => ({ label: row.label.trim(), basis: row.basis, amount: numberOf(row.amount), status: row.status })),
      baseline: data.get("baselineRate") === "" ? null : { rate: numberOf(data.get("baselineRate")), status: data.get("baselineStatus") },
    };
    const noPayment = payment === "no_payment";
    const inputs = match
      ? {
          ...own,
          quantity: numberOf(data.get("quantity")),
          unitKey: data.get("unitKey"),
          paymentDirection: payment,
          priceAmount: noPayment ? null : numberOf(data.get("priceAmount")),
          priceUnitKey: noPayment ? null : data.get("priceUnitKey") || null,
          priceStatus: data.get("priceStatus"),
          priceIncludesFreight: included,
          freight:
            !included && freightGiven
              ? {
                  amount: numberOf(data.get("freightAmount")),
                  status: data.get("freightStatus"),
                  payer: freightPayer,
                  offererSharePercent: freightPayer === "shared" ? numberOf(data.get("offererSharePercent")) : null,
                }
              : null,
        }
      : own;
    setBusy(true);
    setError("");
    setFields({});
    const result = await apiRequest<{ id: number }>("PUT", "/api/my/assessments", {
      type: subject.kind === "match" ? "feasibility" : "negotiation_feasibility",
      subject,
      expectedRevision: revision,
      inputs,
    });
    setBusy(false);
    if (!result.ok) {
      setFields(assessmentFieldErrors(result.error, t));
      return setError(assessmentErrorText(result.error, t));
    }
    router.refresh();
  }

  const statusList = (labels: Record<CostStatus, string>) =>
    COST_STATUSES.map((value) => (
      <option key={value} value={value}>
        {labels[value]}
      </option>
    ));
  // price and own costs: neutral wording; the freight keeps "quoted by a carrier" as in the proposal form
  const statusOptions = statusList(t.assessmentLabels.costStatus);
  const freightStatusOptions = statusList(l.costStatus);
  const group = "grid gap-4 sm:grid-cols-2";
  const legend = "mb-3 text-lg leading-tight font-semibold";

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate aria-label={f.title}>
      {match && (
        <fieldset className="min-w-0">
          <legend className={legend}>{f.commonBasis}</legend>
          <div className={group}>
            <Field id={id("quantity")} label={f.quantity} required error={fields.quantity}>
              <TextInput id={id("quantity")} name="quantity" inputMode="decimal" required defaultValue={text(match.quantity)} autoComplete="off" error={fields.quantity} />
            </Field>
            <Field id={id("unit")} label={f.unit} required error={fields.unitKey}>
              <Select id={id("unit")} name="unitKey" defaultValue={match.unitKey} error={fields.unitKey}>
                {units.map((unit) => (
                  <option key={unit.key} value={unit.key}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={id("payment")} label={f.paymentDirection} className="sm:col-span-2" error={fields.paymentDirection}>
              <Select id={id("payment")} value={payment} onChange={(event) => setPayment(event.target.value as PaymentDirection)} error={fields.paymentDirection}>
                {PAYMENT_DIRECTIONS.map((value) => (
                  <option key={value} value={value}>
                    {l.paymentDirection[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {payment !== "no_payment" && (
              <>
                <Field id={id("price")} label={f.price} error={fields.priceAmount}>
                  <TextInput id={id("price")} name="priceAmount" inputMode="decimal" defaultValue={text(match.priceAmount)} autoComplete="off" error={fields.priceAmount} />
                </Field>
                <Field id={id("price-unit")} label={f.priceUnit} error={fields.priceUnitKey}>
                  <Select id={id("price-unit")} name="priceUnitKey" defaultValue={match.priceUnitKey ?? units[0]?.key ?? ""} error={fields.priceUnitKey}>
                    {units.map((unit) => (
                      <option key={unit.key} value={unit.key}>
                        {unit.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Field id={id("price-status")} label={f.priceStatus} error={fields.priceStatus}>
              <Select id={id("price-status")} name="priceStatus" defaultValue={match.priceStatus}>
                {statusOptions}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Choice id={id("included")} label={f.priceIncludesFreight} checked={included} onChange={(event) => setIncluded(event.target.checked)} />
            </div>
            {!included && (
              <Field id={id("freight-mode")} label={f.extraFreight} className="sm:col-span-2" error={fields.freight}>
                <Select id={id("freight-mode")} value={freightGiven ? "given" : "none"} onChange={(event) => setFreightGiven(event.target.value === "given")} error={fields.freight}>
                  <option value="none">{f.freightNone}</option>
                  <option value="given">{f.freightGiven}</option>
                </Select>
              </Field>
            )}
            {!included && freightGiven && (
              <>
                <Field id={id("freight-amount")} label={f.freightAmount} error={fields["freight.amount"]}>
                  <TextInput id={id("freight-amount")} name="freightAmount" inputMode="decimal" defaultValue={text(match.freight?.amount)} autoComplete="off" error={fields["freight.amount"]} />
                </Field>
                <Field id={id("freight-status")} label={f.freightStatus}>
                  <Select id={id("freight-status")} name="freightStatus" defaultValue={match.freight?.status ?? "estimated"}>
                    {freightStatusOptions}
                  </Select>
                </Field>
                <Field id={id("freight-payer")} label={f.freightPayer}>
                  <Select id={id("freight-payer")} value={freightPayer} onChange={(event) => setFreightPayer(event.target.value as FreightPayer)}>
                    {FREIGHT_PAYERS.map((value) => (
                      <option key={value} value={value}>
                        {l.freightPayer[value]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {freightPayer === "shared" && (
                  <Field id={id("share")} label={f.offererShare} error={fields["freight.offererSharePercent"]}>
                    <TextInput id={id("share")} name="offererSharePercent" inputMode="numeric" defaultValue={text(match.freight?.offererSharePercent ?? 50)} autoComplete="off" error={fields["freight.offererSharePercent"]} />
                  </Field>
                )}
              </>
            )}
          </div>
        </fieldset>
      )}

      <fieldset className="min-w-0">
        <legend className={legend}>{f.ownFigures}</legend>
        <div className="grid gap-4">
          {party === "requester" && (
            <Field id={id("yield")} label={f.yieldPercent} hint={f.yieldHint} error={fields.yieldPercent}>
              <TextInput id={id("yield")} name="yieldPercent" inputMode="decimal" defaultValue={text(initial.yieldPercent)} autoComplete="off" hasHint error={fields.yieldPercent} />
            </Field>
          )}
          <div className="grid gap-3">
            <p className="text-[15px] font-medium">{f.costs}</p>
            <p className="text-[13px] leading-normal text-pretty text-muted">{f.costsHint.replace("{unit}", unitLabel)}</p>
            {costs.map((row, index) => (
              <div key={row.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
                <Field id={id(`cost-${row.key}-label`)} label={f.costLabel} error={fields[`costs.${index}.label`]}>
                  <TextInput id={id(`cost-${row.key}-label`)} value={row.label} onChange={(event) => updateCost(row.key, { label: event.target.value })} maxLength={80} autoComplete="off" error={fields[`costs.${index}.label`]} />
                </Field>
                <Field id={id(`cost-${row.key}-amount`)} label={f.costAmount} error={fields[`costs.${index}.amount`]}>
                  <TextInput id={id(`cost-${row.key}-amount`)} value={row.amount} onChange={(event) => updateCost(row.key, { amount: event.target.value })} inputMode="decimal" autoComplete="off" error={fields[`costs.${index}.amount`]} />
                </Field>
                <Field id={id(`cost-${row.key}-basis`)} label={f.costBasis}>
                  <Select id={id(`cost-${row.key}-basis`)} value={row.basis} onChange={(event) => updateCost(row.key, { basis: event.target.value as CostBasis })}>
                    {COST_BASES.map((value) => (
                      <option key={value} value={value}>
                        {t.assessmentLabels.costBasis[value]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={id(`cost-${row.key}-status`)} label={f.costStatus}>
                  <Select id={id(`cost-${row.key}-status`)} value={row.status} onChange={(event) => updateCost(row.key, { status: event.target.value as CostStatus })}>
                    {statusOptions}
                  </Select>
                </Field>
                <button type="button" className={`${buttonQuiet} justify-self-start sm:col-span-2`} onClick={() => setCosts((rows) => rows.filter((candidate) => candidate.key !== row.key))}>
                  <TrashIcon size={16} />
                  {f.removeCost}
                </button>
              </div>
            ))}
            {costs.length < 8 && (
              <button
                type="button"
                className={`${buttonSecondary} justify-self-start`}
                onClick={() => {
                  setCosts((rows) => [...rows, { key: nextKey, label: "", basis: "fixed", amount: "", status: "estimated" }]);
                  setNextKey((key) => key + 1);
                }}
              >
                <PlusIcon size={18} />
                {f.addCost}
              </button>
            )}
          </div>
          <div className={group}>
            <Field id={id("baseline")} label={(party === "offerer" ? f.baselineOfferer : f.baselineRequester).replace("{unit}", unitLabel)} hint={f.baselineHint} error={fields["baseline.rate"]}>
              <TextInput id={id("baseline")} name="baselineRate" inputMode="decimal" defaultValue={text(initial.baseline?.rate)} autoComplete="off" hasHint error={fields["baseline.rate"]} />
            </Field>
            <Field id={id("baseline-status")} label={f.baselineStatus}>
              <Select id={id("baseline-status")} name="baselineStatus" defaultValue={initial.baseline?.status ?? "estimated"}>
                {statusOptions}
              </Select>
            </Field>
          </div>
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}
      <p>
        <button type="submit" className={buttonPrimary} disabled={busy}>
          <CheckIcon size={18} />
          {busy ? f.saving : f.save}
        </button>
      </p>
    </form>
  );
}
