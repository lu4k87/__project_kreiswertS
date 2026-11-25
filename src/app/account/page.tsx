// Testseite (nur zum Testen): zeigt die eigene Session; ohne Login Hinweis + Link.
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isDatabaseError } from "@/server/db/errors";
import { TestNotice, linkClass } from "../_test/test-notice";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

/** Session, null ohne Login, "unavailable" wenn die Datenbank nicht erreichbar ist (statt Absturzseite). */
async function loadSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    if (!isDatabaseError(error)) throw error;
    console.error("Konto: Datenbank nicht erreichbar"); // ohne Fehlerobjekt (enthält das Session-Token), Better Auth loggt ihn bereits
    return "unavailable" as const;
  }
}

export default async function AccountPage() {
  const session = await loadSession();

  return (
    <main className="mx-auto max-w-md p-5">
      <TestNotice />
      <h1 className="mb-3 text-2xl font-bold">Mein Konto</h1>
      {session === "unavailable" ? (
        <p role="alert">Die Datenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.</p>
      ) : session ? (
        <>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold">Name</dt>
            <dd>{session.user.name}</dd>
            <dt className="font-semibold">E-Mail</dt>
            <dd className="break-all">{session.user.email}</dd>
            <dt className="font-semibold">Rolle</dt>
            <dd>Mitglied</dd>
            <dt className="font-semibold">Betrieb</dt>
            <dd>{session.user.siteId == null ? "noch keiner verknüpft" : `Nr. ${session.user.siteId}`}</dd>
          </dl>
          <SignOutButton />
        </>
      ) : (
        <p>
          Du bist nicht eingeloggt. <a href="/login" className={linkClass}>Zum Login</a>
        </p>
      )}
    </main>
  );
}
