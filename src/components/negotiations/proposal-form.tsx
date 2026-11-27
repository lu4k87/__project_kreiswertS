"use client";
// Proposal form (L2-006): the first proposal for an offer, or a counterproposal prefilled with the current terms.
// The server checks everything again and decides who negotiates with whom; a refusal is shown at the field.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { DELIVERY_TERMS, VAT_BASES } from "@/server/domain/listing";
import {
  COST_STATUSES,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  FREIGHT_PAYERS,
  MAX_PROPOSAL_VALIDITY_DAYS,
  PAYMENT_DIRECTIONS,
  TRANSPORT_ORGANISERS,
  type FreightPayer,
  type PaymentDirection,
} from "@/server/domain/negotiation";
import type { TermsInput } from "@/server/validation/negotiations";
import { apiRequest } from "@/lib/api-client";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { Field, Select, TextArea, TextInput } from "@/components/ui/form";
import { SendIcon } from "@/components/ui/icons";
import { negotiationPath } from "@/components/layout/links";
import { tradeErrorText, tradeFieldErrors } from "./trade-errors";

export type ProposalTarget = { kind: "start"; offerId: number; requestId: number | null } | { kind: "counter"; negotiationId: number; expectedRevision: number };

type Props = {
  target: ProposalTarget;
  defaults: Partial<TermsInput>;
  units: { key: string; label: string }[];
  t: PlatformMessages;
  /** Ids stay unique when the page shows the form twice (never at the moment, but cheap to keep). */
  idPrefix?: string;
};

/** "1.234,5" or "1234.5" → number; empty → null; anything else stays a string so the server answers INVALID. */
export function numberOf(value: FormDataEntryValue | null): number | string | null {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (text === "") return null;
  const normalised = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : text;
}

const textOf = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};

export function ProposalForm({ target, defaults, units, t, idPrefix = "proposal" }: Props) {
  const router = useRouter();
  const f = t.proposalForm;
  const l = t.tradeLabels;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<PaymentDirection>(defaults.paymentDirection ?? "requester_pays");
  const [freightPayer, setFreightPayer] = useState<FreightPayer | "">(defaults.freightPayer ?? "");
  const id = (name: string) => `${idPrefix}-${name}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const noPayment = payment === "no_payment";
    const terms = {
      quantity: numberOf(data.get("quantity")),
      unitKey: textOf(data.get("unitKey")),
      paymentDirection: payment,
      priceAmount: noPayment ? null : numberOf(data.get("priceAmount")),
      priceUnitKey: noPayment ? null : textOf(data.get("priceUnitKey")),
      vatBasis: textOf(data.get("vatBasis")) ?? "net",
      deliveryTerm: textOf(data.get("deliveryTerm")),
      namedPlace: textOf(data.get("namedPlace")),
      transportOrganiser: textOf(data.get("transportOrganiser")),
      freightAmount: numberOf(data.get("freightAmount")),
      freightCostStatus: textOf(data.get("freightCostStatus")),
      freightPayer: freightPayer === "" ? null : freightPayer,
      offererSharePercent: freightPayer === "shared" ? numberOf(data.get("offererSharePercent")) : null,
      deliveryFrom: textOf(data.get("deliveryFrom")),
      deliveryUntil: textOf(data.get("deliveryUntil")),
      technicalConditions: textOf(data.get("technicalConditions")),
    };
    const common = { terms, note: textOf(data.get("note")), validityDays: numberOf(data.get("validityDays")) ?? DEFAULT_PROPOSAL_VALIDITY_DAYS };
    setBusy(true);
    setError("");
    setFields({});
    const result =
      target.kind === "start"
        ? await apiRequest<{ id: number }>("POST", "/api/my/negotiations", { offerId: target.offerId, requestId: target.requestId, ...common })
        : await apiRequest<{ id: number }>("POST", `/api/my/negotiations/${target.negotiationId}/revisions`, { expectedRevision: target.expectedRevision, ...common });
    if (!result.ok) {
      setBusy(false);
      setFields(tradeFieldErrors(result.error, t));
      return setError(result.error.fields.length > 0 ? t.errors.summary : tradeErrorText(result.error, t));
    }
    if (target.kind === "start") router.push(negotiationPath(result.data.id));
    else router.refresh();
  }

  const unitOptions = (
    <>
      <option value="">{f.choose}</option>
      {units.map((unit) => (
        <option key={unit.key} value={unit.key}>
          {unit.label}
        </option>
      ))}
    </>
  );
  const group = "grid gap-4 sm:grid-cols-2";
  const legend = "mb-3 text-lg leading-tight font-semibold";

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <fieldset className="min-w-0">
        <legend className={legend}>{f.quantityGroup}</legend>
        <div className={group}>
          <Field id={id("quantity")} label={f.quantity} required error={fields.quantity}>
            <TextInput id={id("quantity")} name="quantity" inputMode="decimal" required defaultValue={defaults.quantity ?? ""} autoComplete="off" error={fields.quantity} />
          </Field>
          <Field id={id("unit")} label={f.unit} required error={fields.unitKey}>
            <Select id={id("unit")} name="unitKey" required defaultValue={defaults.unitKey ?? ""} error={fields.unitKey}>
              {unitOptions}
            </Select>
          </Field>
          <Field id={id("payment")} label={f.paymentDirection} required className="sm:col-span-2" error={fields.paymentDirection}>
            <Select id={id("payment")} name="paymentDirection" value={payment} onChange={(event) => setPayment(event.target.value as PaymentDirection)} error={fields.paymentDirection}>
              {PAYMENT_DIRECTIONS.map((value) => (
                <option key={value} value={value}>
                  {l.paymentDirection[value]}
                </option>
              ))}
            </Select>
          </Field>
          {payment !== "no_payment" && (
            <>
              <Field id={id("price")} label={f.price} required error={fields.priceAmount}>
                <TextInput id={id("price")} name="priceAmount" inputMode="decimal" required defaultValue={defaults.priceAmount ?? ""} autoComplete="off" error={fields.priceAmount} />
              </Field>
              <Field id={id("price-unit")} label={f.priceUnit} required error={fields.priceUnitKey}>
                <Select id={id("price-unit")} name="priceUnitKey" required defaultValue={defaults.priceUnitKey ?? ""} error={fields.priceUnitKey}>
                  {unitOptions}
                </Select>
              </Field>
              <Field id={id("vat")} label={f.vatBasis} error={fields.vatBasis}>
                <Select id={id("vat")} name="vatBasis" defaultValue={defaults.vatBasis ?? "net"} error={fields.vatBasis}>
                  {VAT_BASES.map((value) => (
                    <option key={value} value={value}>
                      {t.labels.vatBasis[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>{f.deliveryGroup}</legend>
        <div className={group}>
          <Field id={id("term")} label={f.deliveryTerm} required error={fields.deliveryTerm}>
            <Select id={id("term")} name="deliveryTerm" required defaultValue={defaults.deliveryTerm ?? "exw"} error={fields.deliveryTerm}>
              {DELIVERY_TERMS.map((value) => (
                <option key={value} value={value}>
                  {t.labels.deliveryTerm[value].name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("transport")} label={f.transportOrganiser} required error={fields.transportOrganiser}>
            <Select id={id("transport")} name="transportOrganiser" required defaultValue={defaults.transportOrganiser ?? "requester"} error={fields.transportOrganiser}>
              {TRANSPORT_ORGANISERS.map((value) => (
                <option key={value} value={value}>
                  {l.transportOrganiser[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("place")} label={f.namedPlace} required hint={f.namedPlaceHint} className="sm:col-span-2" error={fields.namedPlace}>
            <TextInput id={id("place")} name="namedPlace" required maxLength={200} defaultValue={defaults.namedPlace ?? ""} autoComplete="off" hasHint error={fields.namedPlace} />
          </Field>
          <Field id={id("freight")} label={`${f.freightAmount} (${t.common.optional})`} hint={f.freightHint} error={fields.freightAmount}>
            <TextInput id={id("freight")} name="freightAmount" inputMode="decimal" defaultValue={defaults.freightAmount ?? ""} autoComplete="off" hasHint error={fields.freightAmount} />
          </Field>
          <Field id={id("cost-status")} label={f.freightCostStatus} error={fields.freightCostStatus}>
            <Select id={id("cost-status")} name="freightCostStatus" defaultValue={defaults.freightCostStatus ?? ""} error={fields.freightCostStatus}>
              <option value="">{f.choose}</option>
              {COST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {l.costStatus[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("freight-payer")} label={f.freightPayer} error={fields.freightPayer}>
            <Select id={id("freight-payer")} name="freightPayer" value={freightPayer} onChange={(event) => setFreightPayer(event.target.value as FreightPayer | "")} error={fields.freightPayer}>
              <option value="">{f.choose}</option>
              {FREIGHT_PAYERS.map((value) => (
                <option key={value} value={value}>
                  {l.freightPayer[value]}
                </option>
              ))}
            </Select>
          </Field>
          {freightPayer === "shared" && (
            <Field id={id("share")} label={f.offererShare} required error={fields.offererSharePercent}>
              <TextInput id={id("share")} name="offererSharePercent" type="number" min={0} max={100} step={1} required defaultValue={defaults.offererSharePercent ?? 50} error={fields.offererSharePercent} />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>{f.conditionsGroup}</legend>
        <div className={group}>
          <Field id={id("from")} label={`${f.deliveryFrom} (${t.common.optional})`} error={fields.deliveryFrom}>
            <TextInput id={id("from")} name="deliveryFrom" type="date" defaultValue={defaults.deliveryFrom ?? ""} error={fields.deliveryFrom} />
          </Field>
          <Field id={id("until")} label={`${f.deliveryUntil} (${t.common.optional})`} error={fields.deliveryUntil}>
            <TextInput id={id("until")} name="deliveryUntil" type="date" defaultValue={defaults.deliveryUntil ?? ""} error={fields.deliveryUntil} />
          </Field>
          <Field id={id("technical")} label={`${f.technicalConditions} (${t.common.optional})`} hint={f.technicalHint} className="sm:col-span-2" error={fields.technicalConditions}>
            <TextArea id={id("technical")} name="technicalConditions" maxLength={2000} rows={3} defaultValue={defaults.technicalConditions ?? ""} hasHint error={fields.technicalConditions} />
          </Field>
          <Field id={id("note")} label={`${f.note} (${t.common.optional})`} className="sm:col-span-2" error={fields.note}>
            <TextArea id={id("note")} name="note" maxLength={1000} rows={3} error={fields.note} />
          </Field>
          <Field id={id("validity")} label={f.validityDays} required hint={f.validityHint} error={fields.validityDays}>
            <TextInput id={id("validity")} name="validityDays" type="number" min={1} max={MAX_PROPOSAL_VALIDITY_DAYS} step={1} required defaultValue={DEFAULT_PROPOSAL_VALIDITY_DAYS} hasHint error={fields.validityDays} />
          </Field>
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={`${buttonPrimary} justify-self-start`}>
        <SendIcon size={18} />
        {busy ? f.sending : target.kind === "start" ? f.send : f.sendCounter}
      </button>
    </form>
  );
}
