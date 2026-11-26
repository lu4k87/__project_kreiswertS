"use client";
// Account settings → security (PG-14): change the password with the current one. The server ends all other
// sessions of the account when the password changes.
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import type { Locale, Messages } from "@/i18n/messages";
import { Notice, buttonSecondary } from "@/components/ui/elements";
import { PasswordInput, cardFieldClass } from "./fields";

export function ChangePasswordForm({ t, locale }: { t: Messages; locale: Locale }) {
  const a = t.platform.account;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage(null);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword: String(form.get("newPassword")),
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) return setMessage({ tone: "error", text: error.code === "INVALID_PASSWORD" ? a.wrongPassword : authErrorText(error, locale) });
    formElement.reset();
    setMessage({ tone: "success", text: a.passwordChanged });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="currentPassword" className="text-[15px] font-medium">
            {a.currentPassword}
          </label>
          <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" showLabel={t.login.showPassword} hideLabel={t.login.hidePassword} frameClass={cardFieldClass} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="newPassword" className="text-[15px] font-medium">
            {a.newPassword}
          </label>
          <PasswordInput id="newPassword" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="newPassword-rule" showLabel={t.login.showPassword} hideLabel={t.login.hidePassword} frameClass={cardFieldClass} />
          <p id="newPassword-rule" className="text-[13px] leading-normal text-muted">
            {t.register.passwordRule}
          </p>
        </div>
      </div>
      {message && (
        <Notice tone={message.tone} live>
          {message.text}
        </Notice>
      )}
      <button type="submit" disabled={busy} className={`${buttonSecondary} justify-self-start`}>
        {busy ? a.changing : a.changePassword}
      </button>
    </form>
  );
}
