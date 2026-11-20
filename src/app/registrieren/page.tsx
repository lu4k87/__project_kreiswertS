"use client";
// Testseite (nur zum Testen): Registrieren per Better Auth, danach eingeloggt weiter zu /konto.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorText } from "@/lib/auth-errors";
import { TestHinweis, buttonClass, errorClass, inputClass, linkClass } from "../_test/test-hinweis";

export default function RegistrierenPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
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
      <h1 className="mb-3 text-2xl font-bold">Registrieren</h1>
      <form onSubmit={onSubmit} className="grid gap-2.5">
        <label className="grid gap-0.5">
          Name
          <input name="name" required maxLength={100} autoComplete="name" className={inputClass} />
        </label>
        <label className="grid gap-0.5">
          E-Mail
          <input name="email" type="email" required autoComplete="email" spellCheck={false} className={inputClass} />
        </label>
        <label className="grid gap-0.5">
          Passwort (mind. 8 Zeichen)
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        {error && <p role="alert" className={errorClass}>{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Konto wird angelegt …" : "Konto anlegen"}
        </button>
      </form>
      <p className="mt-3">
        Schon registriert? <a href="/login" className={linkClass}>Zum Login</a>
      </p>
    </main>
  );
}
