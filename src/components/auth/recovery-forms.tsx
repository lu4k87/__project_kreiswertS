"use client";
// Password recovery (L1-002, D02): request a reset link, and set a new password with the token from that link.
// The request answers the same for every address. Prototype: no mail provider – the link is in the server log.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import type { Locale, Messages } from "@/i18n/messages";
import { Notice, buttonPrimary, linkClass } from "@/components/ui/elements";
import { ROUTES } from "@/components/layout/links";
import { PasswordInput, fieldClass, inputClass } from "./fields";

export function ForgotPasswordForm({ t }: { t: Messages }) {
  const r = t.platform.recovery;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setBusy(true);
    setError("");
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: ROUTES.resetPassword });
    setBusy(false);
    if (error?.status === 429) return setError(r.tooMany);
    // every other outcome reads the same: whether the address exists is not revealed
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8 grid gap-4">
        <Notice tone="success" live>
          {r.sent}
        </Notice>
        <Notice>{r.prototypeNote}</Notice>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          {r.email}
        </label>
        <div className={fieldClass}>
          <input id="email" name="email" type="email" required autoComplete="email" spellCheck={false} className={inputClass} />
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={buttonPrimary}>
        {busy ? r.sending : r.send}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ t, locale, token }: { t: Messages; locale: Locale; token: string }) {
  const r = t.platform.recovery;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword"));
    setError("");
    if (newPassword !== form.get("repeatPassword")) return setError(t.register.passwordMismatch);
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setBusy(false);
    if (error) return setError(error.code === "INVALID_TOKEN" ? r.invalidToken : authErrorText(error, locale));
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8 grid gap-4">
        <Notice tone="success" live>
          {r.done}
        </Notice>
        <Link href={ROUTES.login} className={buttonPrimary}>
          {t.login.submit}
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="newPassword" className="text-sm font-medium">
          {r.newPassword}
        </label>
        <PasswordInput id="newPassword" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="password-rule" showLabel={t.login.showPassword} hideLabel={t.login.hidePassword} />
        <p id="password-rule" className="text-[13px] text-muted">
          {t.register.passwordRule}
        </p>
      </div>
      <div className="grid gap-2">
        <label htmlFor="repeatPassword" className="text-sm font-medium">
          {r.repeatPassword}
        </label>
        <PasswordInput id="repeatPassword" name="repeatPassword" required autoComplete="new-password" showLabel={t.login.showPassword} hideLabel={t.login.hidePassword} />
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <Link href={ROUTES.forgotPassword} className={linkClass}>
            {r.requestNew}
          </Link>
        </Notice>
      )}
      <button type="submit" disabled={busy} className={buttonPrimary}>
        {busy ? r.submitting : r.submit}
      </button>
    </form>
  );
}
