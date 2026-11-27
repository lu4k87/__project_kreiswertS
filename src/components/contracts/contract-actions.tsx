"use client";
// Contract actions: create it from the agreed terms, sign the shown snapshot (its hash is sent, so the site signs
// exactly what it saw), void it while a signature is missing.
import { useState, type FormEvent } from "react";
import type { PlatformMessages } from "@/i18n/platform";
import { Notice, buttonPrimary, buttonSecondary } from "@/components/ui/elements";
import { Field, TextArea } from "@/components/ui/form";
import { CheckIcon, FileTextIcon } from "@/components/ui/icons";
import { contractPath } from "./contract-errors";
import { useAction } from "./use-action";

export function CreateContractButton({ negotiationId, t }: { negotiationId: number; t: PlatformMessages }) {
  const { busy, error, run } = useAction(t);
  return (
    <div className="grid gap-2">
      <button type="button" disabled={busy !== null} onClick={() => run("create", `/api/my/negotiations/${negotiationId}/contract`, {}, (data) => contractPath(data.id))} className={`${buttonPrimary} justify-self-start`}>
        <FileTextIcon size={18} />
        {busy ? t.negotiationDetail.working : t.contract.create}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function SignForm({ contractId, revision, hash, t }: { contractId: number; revision: number; hash: string; t: PlatformMessages }) {
  const c = t.contract;
  const { busy, error, run } = useAction(t);
  const [confirmed, setConfirmed] = useState(false);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("sign", `/api/my/contracts/${contractId}/sign`, { expectedRevision: revision, snapshotHash: hash, confirm: confirmed });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <label className="flex items-start gap-3 text-[15px] leading-relaxed">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-5 flex-none accent-brand" />
        <span>{c.signConfirm}</span>
      </label>
      <p className="text-[13px] leading-normal text-pretty">{c.signHint}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={!confirmed || busy !== null} className={`${buttonPrimary} justify-self-start`}>
        <CheckIcon size={18} />
        {busy ? t.negotiationDetail.working : c.sign}
      </button>
    </form>
  );
}

export function VoidForm({ contractId, revision, t }: { contractId: number; revision: number; t: PlatformMessages }) {
  const c = t.contract;
  const { busy, error, run } = useAction(t);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    void run("void", `/api/my/contracts/${contractId}/void`, { expectedRevision: revision, reason });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{c.voidText}</p>
      <Field id={`void-${contractId}`} label={c.voidReason} required>
        <TextArea id={`void-${contractId}`} name="reason" rows={3} maxLength={1000} required minLength={3} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy !== null} className={`${buttonSecondary} justify-self-start`}>
        {busy ? t.negotiationDetail.working : c.void}
      </button>
    </form>
  );
}
