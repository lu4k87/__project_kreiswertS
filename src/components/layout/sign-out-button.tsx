"use client";
// Log out: ends the session and returns to the start page. A failure stays visible – the session is still valid then.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogOutIcon } from "@/components/ui/icons";
import { ROUTES } from "./links";

type Props = { label: string; busyLabel: string; failedLabel: string; className?: string };

export function SignOutButton({ label, busyLabel, failedLabel, className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    const { error } = await authClient.signOut();
    if (error) {
      setFailed(true); // e.g. server unreachable → the session is still valid, the user must see that
      setBusy(false);
      return;
    }
    router.push(ROUTES.home);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={onClick} disabled={busy} className={className}>
        <LogOutIcon size={16} />
        {busy ? busyLabel : label}
      </button>
      {failed && (
        <p role="alert" className="w-full text-[13px] font-medium text-danger">
          {failedLabel}
        </p>
      )}
    </>
  );
}
