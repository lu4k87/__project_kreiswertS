"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonClass } from "../_test/test-notice";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    const { error } = await authClient.signOut();
    if (error) setFailed(true); // e.g. server unreachable → the session is still valid, the user must see that
    else router.refresh();
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={onClick} disabled={busy} className={buttonClass}>
        {busy ? "Abmelden …" : "Abmelden"}
      </button>
      {failed && (
        <p role="alert" className="mt-3">
          Logging out failed – you are still logged in. Please try again.
        </p>
      )}
    </>
  );
}
