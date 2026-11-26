"use client";
// Account settings → profile, contact and visibility of the own site (PG-14). Company, address and park are not
// part of the form: they are what the administrator verified.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { CAPABILITIES } from "@/server/domain/listing";
import type { MySite } from "@/server/dal/sites";
import { apiErrorText, apiRequest, fieldErrorText, problemsByField } from "@/lib/api-client";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { Choice, Field, FieldGroup, TextArea, TextInput } from "@/components/ui/form";

export function ProfileForm({ site, t, disabled }: { site: MySite; t: PlatformMessages; disabled: boolean }) {
  const router = useRouter();
  const a = t.account;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const error = (field: string) => (errors[field] ? fieldErrorText(errors[field], t.errors) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    setErrors({});
    const result = await apiRequest("PUT", "/api/my/site", {
      description: String(form.get("description") ?? ""),
      contactName: String(form.get("contactName") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? "").trim(),
      contactPhone: String(form.get("contactPhone") ?? ""),
      capabilities: form.getAll("capabilities").map(String),
      contactVisible: form.get("contactVisible") === "on",
      publicListed: form.get("publicListed") === "on",
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(problemsByField(result.error.fields));
      return setMessage({ tone: "error", text: apiErrorText(result.error, t.errors) });
    }
    setMessage({ tone: "success", text: a.saved });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <fieldset disabled={disabled} className="grid min-w-0 gap-5">
        <Field id="description" label={`${a.description} (${t.common.optional})`} hint={a.descriptionHint} error={error("description")}>
          <TextArea id="description" name="description" defaultValue={site.description ?? ""} maxLength={1500} rows={4} hasHint error={errors.description} autoComplete="off" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="contactName" label={a.contactName} required error={error("contactName")}>
            <TextInput id="contactName" name="contactName" defaultValue={site.contactName} maxLength={150} required autoComplete="name" error={errors.contactName} />
          </Field>
          <Field id="contactEmail" label={a.contactEmail} required error={error("contactEmail")}>
            <TextInput id="contactEmail" name="contactEmail" type="email" defaultValue={site.contactEmail} maxLength={254} required autoComplete="email" spellCheck={false} error={errors.contactEmail} />
          </Field>
          <Field id="contactPhone" label={`${a.contactPhone} (${t.common.optional})`} error={error("contactPhone")}>
            <TextInput id="contactPhone" name="contactPhone" type="tel" inputMode="tel" defaultValue={site.contactPhone ?? ""} maxLength={30} autoComplete="tel" error={errors.contactPhone} />
          </Field>
        </div>
        <FieldGroup legend={a.capabilities} hint={t.registerSite.capabilitiesHint}>
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <Choice key={capability} id={`capability-${capability}`} name="capabilities" value={capability} defaultChecked={site.capabilities.includes(capability)} label={t.labels.capability[capability]} />
            ))}
          </div>
        </FieldGroup>
        <FieldGroup legend={a.privacy}>
          <Choice id="contactVisible" name="contactVisible" defaultChecked={site.contactVisible} label={a.contactVisible} hint={a.contactVisibleHint} />
          <Choice id="publicListed" name="publicListed" defaultChecked={site.publicListed} label={a.publicListed} hint={a.publicListedHint} />
        </FieldGroup>
      </fieldset>
      {message && (
        <Notice tone={message.tone} live>
          {message.text}
        </Notice>
      )}
      {!disabled && (
        <button type="submit" disabled={busy} className={`${buttonPrimary} justify-self-start`}>
          {busy ? t.common.saving : a.save}
        </button>
      )}
    </form>
  );
}
