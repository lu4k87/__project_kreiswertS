"use client";
// One server action from a button or form: busy state, the sentence of a refusal, refresh or navigate on success.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { apiRequest } from "@/lib/api-client";
import { contractErrorText } from "./contract-errors";

export function useAction(t: PlatformMessages) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function run(name: string, path: string, body: unknown, after?: (data: { id: number }) => string | void) {
    setBusy(name);
    setError("");
    const result = await apiRequest<{ id: number }>("POST", path, body);
    setBusy(null);
    if (!result.ok) return setError(contractErrorText(result.error, t));
    const target = after?.(result.data);
    if (target) router.push(target);
    else router.refresh();
  }
  return { busy, error, run };
}

/** A key generated once per mounted form: a double click or a retried request is the same operation. */
export function useIdempotencyKey(): string {
  const [key] = useState(() => crypto.randomUUID());
  return key;
}
