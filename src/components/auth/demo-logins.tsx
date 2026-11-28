"use client";
// Demo logins on the login page of the static demo (user choice 2026-11-28, variant Login:A): one row per login,
// a click logs in. The passwords are public on purpose (demo/config.mjs); the page renders this only when
// DEMO_STATIC is set.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import type { Locale } from "@/i18n/messages";
import { demoMessages } from "@/i18n/demo";
import { DEMO, DEMO_LOGINS, demoMark, type DemoLogin } from "@/lib/demo";
import { Badge } from "@/components/ui/elements";
import { ShieldCheckIcon } from "@/components/ui/icons";

const TONE = { verified: "neutral", pending: "attention", admin: "outline" } as const;

/** `next`: path inside the app to open after login (already checked by the page). */
export function DemoLogins({ locale, next }: { locale: Locale; next: string }) {
  const t = demoMessages[locale].logins;
  const router = useRouter();
  const [busy, setBusy] = useState<DemoLogin["login"] | null>(null);
  const [error, setError] = useState("");

  async function logIn(entry: DemoLogin) {
    setBusy(entry.login);
    setError("");
    const { error } = await authClient.signIn.username({
      username: entry.login,
      password: entry.state === "admin" ? DEMO.adminPassword : DEMO.sitePassword,
      rememberMe: true,
    });
    if (error) {
      setError(authErrorText(error, locale)); // e.g. more than 3 logins in 10 s
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  const row = (entry: DemoLogin) => {
    const name = entry.name ?? t.admin;
    return (
      <li key={entry.login}>
        <button
          type="button"
          onClick={() => logIn(entry)}
          disabled={busy !== null}
          className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left hover:bg-canvas disabled:opacity-60"
        >
          <span aria-hidden="true" className="row-span-2 grid size-10 place-items-center rounded-lg bg-mint text-base leading-none font-semibold">
            {entry.state === "admin" ? <ShieldCheckIcon size={20} /> : demoMark(name)}
          </span>
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-[15px]">
              <span className="font-semibold">{name}</span> · <span translate="no">{entry.login}</span>
            </span>
            <Badge tone={TONE[entry.state]}>{busy === entry.login ? t.loggingIn : t.states[entry.state]}</Badge>
          </span>
          <span className="text-sm">{t.uses[entry.login]}</span>
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="demo-logins" className="mt-6 grid gap-3">
      <div className="grid gap-1">
        <h2 id="demo-logins" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">
          {t.heading}
        </h2>
        <p className="text-sm">{t.hint}</p>
      </div>
      <ul className="grid gap-2">{DEMO_LOGINS.filter((entry) => entry.main).map(row)}</ul>
      <details className="group grid gap-2">
        <summary className="w-fit list-none rounded text-sm font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{t.more}</span>
          <span className="hidden group-open:inline">{t.fewer}</span>
        </summary>
        <ul className="mt-3 grid gap-2">{DEMO_LOGINS.filter((entry) => !entry.main).map(row)}</ul>
      </details>
      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="mt-3 flex items-center gap-3.5 text-sm font-medium before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t.or}
      </p>
    </section>
  );
}
