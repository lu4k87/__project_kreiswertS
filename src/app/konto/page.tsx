// Testseite (nur zum Testen): zeigt die eigene Session; ohne Login Hinweis + Link.
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { TestHinweis, linkClass } from "../_test/test-hinweis";
import { AbmeldenButton } from "./abmelden-button";

export const dynamic = "force-dynamic";

export default async function KontoPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto max-w-md p-5">
      <TestHinweis />
      <h1 className="mb-3 text-2xl font-bold">Mein Konto</h1>
      {session ? (
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
          <AbmeldenButton />
        </>
      ) : (
        <p>
          Du bist nicht eingeloggt. <a href="/login" className={linkClass}>Zum Login</a>
        </p>
      )}
    </main>
  );
}
