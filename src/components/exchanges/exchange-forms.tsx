"use client";
// Forms of an exchange (L2-011): plan it (agreed negotiation), change the plan, record receipt and quality (receiving
// site only) and cancel with a reason. Every change sends the revision the page showed; the server decides.
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { QUALITY_RESULTS } from "@/server/domain/negotiation";
import { apiRequest } from "@/lib/api-client";
import { Notice, buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { Field, Select, TextArea, TextInput } from "@/components/ui/form";
import { CalendarIcon, CheckIcon } from "@/components/ui/icons";
import { exchangePath } from "@/components/layout/links";
import { tradeErrorText, tradeFieldErrors } from "@/components/negotiations/trade-errors";

const textOf = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};
const numberOf = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (text === "") return null;
  const parsed = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(parsed) ? parsed : text;
};

/** Shared frame: busy state, field errors, the sentence of a refusal, refresh or navigate on success. */
function useSubmit(t: PlatformMessages) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(method: "POST" | "PUT", path: string, body: unknown, after?: (data: { id: number }) => string | void) {
    setBusy(true);
    setError("");
    setFields({});
    const result = await apiRequest<{ id: number }>(method, path, body);
    setBusy(false);
    if (!result.ok) {
      setFields(tradeFieldErrors(result.error, t));
      return setError(result.error.fields.length > 0 ? t.errors.summary : tradeErrorText(result.error, t));
    }
    const target = after?.(result.data);
    if (target) router.push(target);
    else router.refresh();
  }
  return { busy, error, fields, submit };
}

function Frame({ children, error }: { children: ReactNode; error: string }) {
  return (
    <>
      {children}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}

/** Plan the exchange of an agreed negotiation, or change the plan of a planned one. */
export function PlanForm({ t, today, negotiationId, exchange }: { t: PlatformMessages; today: string; negotiationId?: number; exchange?: { id: number; revision: number; plannedDate: string; planNote: string | null } }) {
  const x = t.exchangeDetail;
  const { busy, error, fields, submit } = useSubmit(t);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = { plannedDate: textOf(data.get("plannedDate")), planNote: textOf(data.get("planNote")) };
    if (exchange) void submit("PUT", `/api/my/exchanges/${exchange.id}`, { ...body, expectedRevision: exchange.revision });
    else void submit("POST", `/api/my/negotiations/${negotiationId}/exchange`, body, (data) => exchangePath(data.id));
  }
  const prefix = exchange ? `plan-${exchange.id}` : `plan-new-${negotiationId}`;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Frame error={error}>
        <Field id={`${prefix}-date`} label={x.planDate} required error={fields.plannedDate}>
          <TextInput id={`${prefix}-date`} name="plannedDate" type="date" min={today} required defaultValue={exchange?.plannedDate ?? ""} error={fields.plannedDate} />
        </Field>
        <Field id={`${prefix}-note`} label={`${x.planNote} (${t.common.optional})`} error={fields.planNote}>
          <TextArea id={`${prefix}-note`} name="planNote" maxLength={1000} rows={3} defaultValue={exchange?.planNote ?? ""} error={fields.planNote} />
        </Field>
      </Frame>
      <button type="submit" disabled={busy} className={`${exchange ? buttonSecondary : buttonPrimary} justify-self-start`}>
        <CalendarIcon size={18} />
        {busy ? t.common.saving : exchange ? x.savePlan : x.planExchange}
      </button>
    </form>
  );
}

/** The receiving site records what arrived and the quality check; this completes the exchange. */
export function ReceiptForm({ t, today, exchange, units }: { t: PlatformMessages; today: string; exchange: { id: number; revision: number; unitKey: string; quantity: number }; units: { key: string; label: string }[] }) {
  const x = t.exchangeDetail;
  const { busy, error, fields, submit } = useSubmit(t);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(x.confirmComplete)) return;
    const data = new FormData(event.currentTarget);
    void submit("POST", `/api/my/exchanges/${exchange.id}/complete`, {
      expectedRevision: exchange.revision,
      receivedQuantity: numberOf(data.get("receivedQuantity")),
      receivedUnitKey: textOf(data.get("receivedUnitKey")),
      receivedOn: textOf(data.get("receivedOn")),
      qualityResult: textOf(data.get("qualityResult")),
      qualityNote: textOf(data.get("qualityNote")),
    });
  }
  const id = (name: string) => `receipt-${exchange.id}-${name}`;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{x.receiptText}</p>
      <Frame error={error}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("quantity")} label={x.receivedQuantity} required error={fields.receivedQuantity}>
            <TextInput id={id("quantity")} name="receivedQuantity" inputMode="decimal" required defaultValue={exchange.quantity} autoComplete="off" error={fields.receivedQuantity} />
          </Field>
          <Field id={id("unit")} label={x.receivedUnit} required error={fields.receivedUnitKey}>
            <Select id={id("unit")} name="receivedUnitKey" required defaultValue={exchange.unitKey} error={fields.receivedUnitKey}>
              {units.map((unit) => (
                <option key={unit.key} value={unit.key}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("on")} label={x.receivedOn} required error={fields.receivedOn}>
            <TextInput id={id("on")} name="receivedOn" type="date" max={today} required defaultValue={today} error={fields.receivedOn} />
          </Field>
          <Field id={id("quality")} label={x.qualityResult} required error={fields.qualityResult}>
            <Select id={id("quality")} name="qualityResult" required defaultValue="" error={fields.qualityResult}>
              <option value="">{t.proposalForm.choose}</option>
              {QUALITY_RESULTS.map((value) => (
                <option key={value} value={value}>
                  {t.tradeLabels.qualityResult[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("note")} label={`${x.qualityNote} (${t.common.optional})`} className="sm:col-span-2" error={fields.qualityNote}>
            <TextArea id={id("note")} name="qualityNote" maxLength={1000} rows={3} error={fields.qualityNote} />
          </Field>
        </div>
      </Frame>
      <button type="submit" disabled={busy} className={`${buttonPrimary} justify-self-start`}>
        <CheckIcon size={18} />
        {busy ? t.common.saving : x.complete}
      </button>
    </form>
  );
}

/** Either party cancels a planned exchange; a reason is required. */
export function CancelForm({ t, exchange }: { t: PlatformMessages; exchange: { id: number; revision: number } }) {
  const x = t.exchangeDetail;
  const { busy, error, fields, submit } = useSubmit(t);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(x.confirmCancel)) return;
    void submit("POST", `/api/my/exchanges/${exchange.id}/cancel`, { expectedRevision: exchange.revision, reason: String(new FormData(event.currentTarget).get("reason") ?? "") });
  }
  const id = `cancel-${exchange.id}-reason`;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Frame error={error}>
        <Field id={id} label={x.cancelReason} required error={fields.reason}>
          <TextArea id={id} name="reason" required minLength={3} maxLength={1000} rows={3} error={fields.reason} />
        </Field>
      </Frame>
      <button type="submit" disabled={busy} className={`${buttonQuiet} justify-self-start`}>
        {busy ? t.common.saving : x.cancelSend}
      </button>
    </form>
  );
}
