"use client";
// Switch a material category on or off (PG-16 "Category activation / deactivation"). Disabling asks first.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiErrorText, apiRequest } from "@/lib/api-client";
import { buttonQuiet } from "@/components/ui/elements";

export function CategoryToggle({ categoryId, enabled, name, t }: { categoryId: number; enabled: boolean; name: string; t: PlatformMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (enabled && !window.confirm(t.admin.confirmDisable)) return;
    setBusy(true);
    setError("");
    const result = await apiRequest("POST", `/api/admin/categories/${categoryId}`, { enabled: !enabled });
    setBusy(false);
    if (!result.ok) return setError(apiErrorText(result.error, t.errors));
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={toggle} disabled={busy} aria-label={`${enabled ? t.admin.disable : t.admin.enable}: ${name}`} className={buttonQuiet}>
        {busy ? t.admin.working : enabled ? t.admin.disable : t.admin.enable}
      </button>
      {error && (
        <span role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </span>
      )}
    </>
  );
}
