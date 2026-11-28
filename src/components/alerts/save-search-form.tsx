"use client";
// "Save search" under the filter bar of /offers (function no. 19): stores the current filters for the own site.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { Notice, buttonSecondary, linkClass } from "@/components/ui/elements";
import { Field, TextInput } from "@/components/ui/form";
import { ROUTES } from "@/components/layout/links";

type Props = { query: string; defaultName: string; t: PlatformMessages };

export function SaveSearchForm({ query, defaultName, t }: Props) {
  const a = t.alerts;
  const [name, setName] = useState(defaultName.slice(0, 80));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await apiRequest<{ id: number }>("POST", "/api/my/saved-searches", { name, query });
    setBusy(false);
    if (result.ok) return setSaved(true);
    const tooMany = result.error.fields.some((field) => field.code === "TOO_MANY");
    setError(tooMany ? a.tooMany : result.error.fields.length > 0 ? t.errors.fields.INVALID : apiErrorText(result.error, t.errors));
  }

  return (
    // From 1024 px one row: text, name, button. The error gets its own line below, so the button stays on the line
    // of the field.
    <form onSubmit={save} className="grid gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem_auto] lg:items-end" aria-labelledby="save-search-title">
      <div className="grid gap-1">
        <h2 id="save-search-title" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
          {a.saveTitle}
        </h2>
        <p className="text-[15px] leading-relaxed text-pretty">{a.saveText}</p>
      </div>
      {saved ? (
        <div className="lg:col-span-2">
          <Notice tone="success" live>
            {a.saved}{" "}
            <Link href={ROUTES.notifications} className={linkClass}>
              {a.openNotifications}
            </Link>
          </Notice>
        </div>
      ) : (
        <>
          <Field id="saved-search-name" label={a.nameLabel}>
            <TextInput id="saved-search-name" name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} minLength={2} required autoComplete="off" error={error || undefined} />
          </Field>
          <div>
            <button type="submit" className={`${buttonSecondary} whitespace-nowrap`} disabled={busy}>
              {busy ? a.saving : a.save}
            </button>
          </div>
          {/* the id the field points to with aria-describedby while it is invalid */}
          {error && (
            <p id="saved-search-name-error" className="text-[13px] leading-normal font-medium text-danger lg:col-span-full">
              {error}
            </p>
          )}
        </>
      )}
    </form>
  );
}
