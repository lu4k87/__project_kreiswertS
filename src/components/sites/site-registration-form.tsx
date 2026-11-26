"use client";
// Registration, step 2 (PG-04 "Physical site information"): the site this account belongs to. The server takes the
// company from the account and the owner from the session; the new site starts as pending.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { CAPABILITIES, INDUSTRIES } from "@/server/domain/listing";
import { apiErrorText, apiRequest, fieldErrorText, problemsByField } from "@/lib/api-client";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { Choice, Field, FieldGroup, Select, TextInput } from "@/components/ui/form";
import { ArrowRightIcon } from "@/components/ui/icons";
import { ROUTES } from "@/components/layout/links";

type Props = { parks: { id: number; name: string; city: string }[]; t: PlatformMessages };

export function SiteRegistrationForm({ parks, t }: Props) {
  const router = useRouter();
  const r = t.registerSite;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const error = (field: string) => (errors[field] ? fieldErrorText(errors[field] === "INVALID" && field !== "postalCode" && field !== "contactPhone" ? "REQUIRED" : errors[field], t.errors) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    setBusy(true);
    setMessage("");
    setErrors({});
    const result = await apiRequest<{ siteId: number }>("POST", "/api/registration/site", {
      industry: value("industry"),
      siteName: value("siteName"),
      streetAddress: value("streetAddress"),
      postalCode: value("postalCode"),
      city: value("city"),
      parkId: value("parkId") === "" ? null : Number(value("parkId")),
      contactName: value("contactName"),
      contactPhone: value("contactPhone"),
      capabilities: form.getAll("capabilities").map(String),
    });
    if (!result.ok) {
      setBusy(false);
      // the site exists already (e.g. the form was sent twice) → go on to the dashboard
      if (result.error.reason === "SITE_EXISTS") return router.replace(ROUTES.dashboard);
      setErrors(problemsByField(result.error.fields));
      return setMessage(apiErrorText(result.error, t.errors));
    }
    router.replace(ROUTES.dashboard);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8">
      <fieldset className="grid min-w-0 gap-5">
        <legend className="float-left mb-1 w-full text-lg leading-tight font-semibold">{r.siteSection}</legend>
        <div className="clear-both grid gap-5 sm:grid-cols-2">
          <Field id="siteName" label={r.siteName} required hint={r.siteNameHint} error={error("siteName")}>
            <TextInput id="siteName" name="siteName" required maxLength={200} autoComplete="off" hasHint error={errors.siteName} />
          </Field>
          <Field id="industry" label={r.industry} required error={error("industry")}>
            <Select id="industry" name="industry" required defaultValue="" error={errors.industry}>
              <option value="" disabled>
                {t.offerForm.choose}
              </option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {t.labels.industry[industry]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="streetAddress" label={r.street} required error={error("streetAddress")}>
          <TextInput id="streetAddress" name="streetAddress" required maxLength={255} autoComplete="street-address" error={errors.streetAddress} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Field id="postalCode" label={r.postalCode} required error={error("postalCode")}>
            <TextInput id="postalCode" name="postalCode" required maxLength={10} inputMode="numeric" autoComplete="postal-code" error={errors.postalCode} />
          </Field>
          <Field id="city" label={r.city} required error={error("city")}>
            <TextInput id="city" name="city" required maxLength={100} autoComplete="address-level2" error={errors.city} />
          </Field>
        </div>
        <Field id="parkId" label={r.park} hint={r.parkHint}>
          <Select id="parkId" name="parkId" defaultValue="" hasHint>
            <option value="">{r.parkNone}</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}, {park.city}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-[13px] leading-normal text-pretty text-muted">{r.addressNote}</p>
      </fieldset>

      <fieldset className="grid min-w-0 gap-5 border-t border-line pt-8">
        <legend className="float-left mb-1 w-full text-lg leading-tight font-semibold">{r.contactSection}</legend>
        <div className="clear-both grid gap-5 sm:grid-cols-2">
          <Field id="contactName" label={r.contactName} required error={error("contactName")}>
            <TextInput id="contactName" name="contactName" required maxLength={150} autoComplete="name" error={errors.contactName} />
          </Field>
          <Field id="contactPhone" label={`${r.contactPhone} (${t.common.optional})`} error={error("contactPhone")}>
            <TextInput id="contactPhone" name="contactPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" error={errors.contactPhone} />
          </Field>
        </div>
        <FieldGroup legend={`${r.capabilities} (${t.common.optional})`} hint={r.capabilitiesHint}>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <Choice key={capability} id={`capability-${capability}`} name="capabilities" value={capability} label={t.labels.capability[capability]} />
            ))}
          </div>
        </FieldGroup>
      </fieldset>

      <div className="grid gap-4">
        <Notice>{r.verificationNote}</Notice>
        {message && <Notice tone="error">{message}</Notice>}
        <button type="submit" disabled={busy} className={buttonPrimary}>
          <ArrowRightIcon size={18} />
          {busy ? r.submitting : r.submit}
        </button>
      </div>
    </form>
  );
}
