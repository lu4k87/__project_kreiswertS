"use client";
// Login form: Better Auth username or email + password, "remember me", password visibility toggle.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import type { Locale, Messages } from "@/i18n/messages";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { PLACEHOLDER_HREF, ROUTES } from "@/components/layout/links";
import { PasswordInput, fieldClass, inputClass } from "./fields";

export function LoginForm({ t, locale }: { t: Messages["login"]; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    const rememberMe = form.get("remember") === "on"; // off → session ends with the browser
    // "@" → email login, otherwise username login (usernames cannot contain "@").
    const { error } = identifier.includes("@")
      ? await authClient.signIn.email({ email: identifier, password, rememberMe })
      : await authClient.signIn.username({ username: identifier, password, rememberMe });
    if (error) {
      setError(authErrorText(error, locale));
      setBusy(false);
      return;
    }
    router.push(ROUTES.account);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="identifier" className="text-sm font-medium">
          {t.identifier}
        </label>
        <div className={fieldClass}>
          <input
            id="identifier"
            name="identifier"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          {t.password}
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          showLabel={t.showPassword}
          hideLabel={t.hidePassword}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2.5 text-muted">
          <input name="remember" type="checkbox" defaultChecked className="size-4 accent-brand" />
          {t.remember}
        </label>
        <a href={PLACEHOLDER_HREF} className="font-medium hover:underline">
          {t.forgot}
        </a>
      </div>

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

      <div className="mt-2 grid border-t border-line text-center text-sm">
        <p className="border-b border-line py-6 text-muted">
          {t.notRegistered}{" "}
          <Link href={ROUTES.register} className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
            {t.register}
            <ArrowUpRightIcon size={14} />
          </Link>
        </p>
        <p className="py-6 text-muted">
          {t.justLooking}{" "}
          <Link href={PLACEHOLDER_HREF} className="font-medium text-ink hover:underline">
            {t.guest}
          </Link>
        </p>
      </div>
    </form>
  );
}
