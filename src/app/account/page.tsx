// Test page (for testing only): shows your own session; without login a notice + link.
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isDatabaseError } from "@/server/db/errors";
import { TestNotice, linkClass } from "../_test/test-notice";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

/** Session, null without login, "unavailable" when the database is down (instead of an error page). */
async function loadSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    if (!isDatabaseError(error)) throw error;
    console.error("Account: database unreachable"); // without the error object (it contains the session token), Better Auth already logs it
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
        <p role="alert">The database is currently unreachable. Please try again later.</p>
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
            <dd>{session.user.siteId == null ? "none linked yet" : `No. ${session.user.siteId}`}</dd>
          </dl>
          <SignOutButton />
        </>
      ) : (
        <p>
          You are not logged in. <a href="/login" className={linkClass}>Go to login</a>
        </p>
      )}
    </main>
  );
}
