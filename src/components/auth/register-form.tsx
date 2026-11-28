"use client";
// Register form (Figma "Create account"): company details + account, Better Auth sign-up with username.
// The server checks the same rules again (src/server/validation/registration.ts via the hook in src/server/auth.ts).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import type { Locale, Messages } from "@/i18n/messages";
import { MATERIAL_INTERESTS, passwordSchema, registrationError, signUpBody } from "@/server/validation/registration";
import { ROUTES } from "@/components/layout/links";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { PasswordInput, cardFieldClass, inputClass } from "./fields";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label} <span aria-hidden="true">*</span>
      </label>
      {children}
    </div>
  );
}

export function RegisterForm({ t, locale }: { t: Messages["register"]; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const passwordOk = passwordSchema.safeParse(password).success;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = signUpBody({
      companyName: String(form.get("companyName")),
      vatId: String(form.get("vatId")),
      materialInterest: String(form.get("materialInterest")),
      username: String(form.get("username")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setError("");
    // Same rules as the server, checked first to save a round trip.
    const code = registrationError(body);
    if (code) return setError(authErrorText({ code }, locale));
    if (body.password !== form.get("repeatPassword")) return setError(t.passwordMismatch);

    setBusy(true);
    const { error } = await authClient.signUp.email(body);
    if (error) {
      setError(authErrorText(error, locale));
      setBusy(false);
      return;
    }
    // step 2: the physical site of this account (company → site → account)
    router.push(ROUTES.registerSite);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-8">
      <fieldset className="grid min-w-0 gap-5 border-t border-line pt-8">
        <legend className="float-left mb-1 w-full text-[17px] font-medium">{t.companySection}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="companyName" label={t.companyName}>
            <div className={cardFieldClass}>
              <input id="companyName" name="companyName" required maxLength={200} autoComplete="organization" className={inputClass} />
            </div>
          </Field>
          <Field id="vatId" label={t.vatId}>
            <div className={cardFieldClass}>
              <input
                id="vatId"
                name="vatId"
                required
                maxLength={20}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={inputClass}
              />
            </div>
          </Field>
        </div>
        <Field id="materialInterest" label={t.materialInterest}>
          <div className={`${cardFieldClass} relative`}>
            <select
              id="materialInterest"
              name="materialInterest"
              required
              defaultValue=""
              aria-describedby="materialHint"
              className={`${inputClass} w-full cursor-pointer appearance-none pr-12`}
            >
              <option value="" disabled>
                {t.materialPlaceholder}
              </option>
              {MATERIAL_INTERESTS.map((value) => (
                <option key={value} value={value}>
                  {t.materials[value]}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={18} className="pointer-events-none absolute right-4 flex-none text-muted" />
          </div>
          <p id="materialHint" className="text-[13px] text-muted">
            {t.materialHint}
          </p>
        </Field>
      </fieldset>

      <fieldset className="grid min-w-0 gap-5 border-t border-line pt-8">
        <legend className="float-left mb-1 w-full text-[17px] font-medium">{t.accountSection}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="username" label={t.username}>
            <div className={cardFieldClass}>
              <input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_.]+"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={inputClass}
              />
            </div>
          </Field>
          <Field id="email" label={t.email}>
            <div className={cardFieldClass}>
              <input id="email" name="email" type="email" required autoComplete="email" spellCheck={false} className={inputClass} />
            </div>
          </Field>
          <Field id="password" label={t.password}>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              aria-describedby="passwordRule"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              showLabel={t.showPassword}
              hideLabel={t.hidePassword}
              frameClass={cardFieldClass}
            />
          </Field>
          <Field id="repeatPassword" label={t.repeatPassword}>
            <PasswordInput
              id="repeatPassword"
              name="repeatPassword"
              required
              autoComplete="new-password"
              showLabel={t.showPassword}
              hideLabel={t.hidePassword}
              frameClass={cardFieldClass}
            />
          </Field>
        </div>
        <p id="passwordRule" className={`flex items-start gap-2 text-[13px] ${passwordOk ? "text-ink" : "text-muted"}`}>
          <CheckIcon size={16} strokeWidth={passwordOk ? 2.5 : 1.75} className="mt-px flex-none" />
          {t.passwordRule}
        </p>
      </fieldset>

      <div className="grid gap-5">
        <label className="flex items-start gap-3 text-[15px] text-muted">
          <input name="terms" type="checkbox" required className="mt-0.5 size-5 flex-none accent-brand" />
          <span>
            {t.termsBefore}
            <Link href={`${ROUTES.help}#terms`} target="_blank" className="text-ink underline underline-offset-2">
              {t.terms}
            </Link>
            {t.termsAnd}
            <Link href={`${ROUTES.help}#privacy`} target="_blank" className="text-ink underline underline-offset-2">
              {t.privacy}
            </Link>
            {t.termsAfter}
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          <ArrowRightIcon size={18} />
          {busy ? t.submitting : t.submit}
        </button>

        <p className="text-center text-sm text-muted">
          {t.haveAccount}{" "}
          <Link href={ROUTES.login} className="font-medium text-ink hover:underline">
            {t.login}
          </Link>
        </p>
      </div>
    </form>
  );
}
