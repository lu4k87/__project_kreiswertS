"use client";
// Decision on one registered site (PG-15, L1-003): verify, decline (with a note) or set back to pending; the
// reviewer can enter the coordinates looked up for the address. The server records reviewer, time and history.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import type { VerificationStatus } from "@/server/domain/status";
import { parseDecimal } from "@/components/offers/offer-form-state";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { Field, TextArea, TextInput } from "@/components/ui/form";

type Props = { siteId: number; status: VerificationStatus; note: string | null; latitude: number | null; longitude: number | null; t: PlatformMessages };

export function VerificationForm({ siteId, status, note: initialNote, latitude, longitude, t }: Props) {
  const router = useRouter();
  const a = t.admin;
  const [note, setNote] = useState(initialNote ?? "");
  const [lat, setLat] = useState(latitude == null ? "" : String(latitude));
  const [lon, setLon] = useState(longitude == null ? "" : String(longitude));
  const [busy, setBusy] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState("");

  async function decide(next: VerificationStatus) {
    const parsedLat = parseDecimal(lat);
    const parsedLon = parseDecimal(lon);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) return setError(t.errors.fields.INVALID_NUMBER);
    setBusy(next);
    setError("");
    const result = await apiRequest("POST", `/api/admin/sites/${siteId}/verification`, { status: next, note, latitude: parsedLat, longitude: parsedLon });
    setBusy(null);
    if (!result.ok) return setError(apiErrorText(result.error, t.errors));
    router.refresh();
  }

  const actions: { status: VerificationStatus; label: string; className: string }[] = [
    ...(status !== "verified" ? [{ status: "verified" as const, label: a.verify, className: buttonPrimary }] : []),
    ...(status !== "declined" ? [{ status: "declined" as const, label: a.decline, className: buttonSecondary }] : []),
    ...(status !== "pending" ? [{ status: "pending" as const, label: a.reset, className: buttonQuiet }] : []),
  ];

  return (
    <div className="grid gap-4 rounded-xl bg-canvas p-4">
      <Field id={`note-${siteId}`} label={a.note} hint={a.noteHint}>
        <TextArea id={`note-${siteId}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} hasHint autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`lat-${siteId}`} label={`${a.latitude} (${t.common.optional})`}>
          <TextInput id={`lat-${siteId}`} inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} autoComplete="off" />
        </Field>
        <Field id={`lon-${siteId}`} label={`${a.longitude} (${t.common.optional})`}>
          <TextInput id={`lon-${siteId}`} inputMode="decimal" value={lon} onChange={(event) => setLon(event.target.value)} autoComplete="off" />
        </Field>
      </div>
      <p className="text-[13px] leading-normal text-muted">{a.coordinatesHint}</p>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button key={action.status} type="button" onClick={() => decide(action.status)} disabled={busy !== null} className={action.className}>
            {busy === action.status ? a.working : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
