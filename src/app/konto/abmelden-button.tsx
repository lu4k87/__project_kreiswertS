"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonClass } from "../_test/test-hinweis";

export function AbmeldenButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    await authClient.signOut();
    router.refresh();
    setBusy(false);
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={buttonClass}>
      {busy ? "Abmelden …" : "Abmelden"}
    </button>
  );
}
