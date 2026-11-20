"use client";
// Testseite (nur zum Testen): Login per Better Auth, danach weiter zu /konto.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import { TestHinweis, buttonClass, errorClass, inputClass, linkClass } from "../_test/test-hinweis";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(authErrorText(error));
      setBusy(false);
      return;
    }
    router.push("/konto");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md p-5">
      <TestHinweis />
      <h1 className="mb-3 text-2xl font-bold">Login</h1>
      <form onSubmit={onSubmit} className="grid gap-2.5">
        <label className="grid gap-0.5">
          E-Mail
          <input name="email" type="email" required autoComplete="email" spellCheck={false} className={inputClass} />
        </label>
        <label className="grid gap-0.5">
          Passwort
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        {error && <p role="alert" className={errorClass}>{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Einloggen …" : "Einloggen"}
        </button>
      </form>
      <p className="mt-3">
        Noch kein Konto? <a href="/registrieren" className={linkClass}>Registrieren</a>
      </p>
    </main>
  );
}
