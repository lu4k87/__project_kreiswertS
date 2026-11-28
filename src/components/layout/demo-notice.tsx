"use client";
// Notice of the static demo (demo/README.md): a round (i) button in the header opens a dialog that compares the real
// app with this demo; on the first visit the dialog opens by itself once (user choice 2026-11-28, variant Info:C).
// "Reset demo" brings back the seeded data. The headers render it only when DEMO_STATIC is set.
// The platform header has no room for another button (its row is full from 1344 px on): there the dialog is mounted
// without the button (`trigger={false}`) and opened from the account menu through DemoNoticeMenuEntry.
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { demoMessages } from "@/i18n/demo";
import { DEMO } from "@/lib/demo";
import { InfoIcon, RefreshIcon } from "@/components/ui/icons";
import { buttonPrimary, buttonSecondary, linkClass } from "@/components/ui/elements";

const SEEN_KEY = "kreiswerts-demo-notice-seen";
const OPEN_EVENT = "kreiswerts-demo-notice-open";
// The header is rendered again on every navigation: without storage (private window) the dialog would otherwise
// come back on each page.
let closedSinceLoad = false;

/** Entry for a header menu: opens the dialog of the DemoNotice mounted on the same page. */
export function DemoNoticeMenuEntry({ locale, className }: { locale: Locale; className: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-haspopup="dialog" className={`${className} justify-start gap-2`}>
      <InfoIcon size={16} />
      {demoMessages[locale].notice.open}
    </button>
  );
}

export function DemoNotice({ locale, trigger = true }: { locale: Locale; trigger?: boolean }) {
  const t = demoMessages[locale].notice;
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<"info" | "confirm" | "busy" | "failed">("info");

  useEffect(() => {
    let seen = closedSinceLoad;
    try {
      seen ||= localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // storage blocked: closedSinceLoad decides
    }
    if (!seen) open();
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  function open() {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    // showModal() focuses the first button, which sits at the bottom: on a small screen the dialog would open
    // scrolled down. The title gets the focus instead, so reading starts at the top.
    title.current?.focus();
  }

  function onClose() {
    closedSinceLoad = true;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked: the notice opens again after the next full page load
    }
    setStep("info");
  }

  async function reset() {
    setStep("busy");
    // the service worker of the demo answers this (demo/sw/entry.js): seeded data again, logged out
    const response = await fetch("/api/demo/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    if (!response?.ok) {
      setStep("failed");
      return;
    }
    window.location.assign(`${DEMO.basePath}/`);
  }

  const date = DEMO.date
    ? new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${DEMO.date}T00:00:00Z`))
    : "";

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={open}
          aria-label={t.open}
          aria-haspopup="dialog"
          title={t.open}
          className="grid size-9 flex-none place-items-center rounded-full border border-line bg-notice-soft text-notice transition-colors duration-150 ease-out hover:bg-mint hover:text-ink motion-reduce:transition-none"
        >
          <InfoIcon size={20} />
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={onClose}
        // a click on the backdrop lands on the dialog element itself, one inside on the padded box below
        onClick={(event) => {
          if (event.target === event.currentTarget && step !== "busy") event.currentTarget.close();
        }}
        className="scroll-thin m-auto max-h-[calc(100dvh-2rem)] w-[min(42.5rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-left text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="grid gap-4 p-5 sm:p-7">
          <h2 id={titleId} ref={title} tabIndex={-1} className="outline-none text-2xl leading-tight font-semibold tracking-[-0.015em] text-balance">
            {t.title}
          </h2>
          <p className="text-[15px] leading-relaxed">{t.lead}</p>

          <table className="w-full border-collapse text-[15px] max-sm:block">
            <thead className="max-sm:sr-only">
              <tr>
                <th scope="col" className="border-b border-line">
                  <span className="sr-only">{t.columns.topic}</span>
                </th>
                <th scope="col" className="border-b border-line px-3 py-2.5 text-left text-sm font-semibold">
                  {t.columns.app}
                </th>
                <th scope="col" className="border-b border-line bg-notice-soft px-3 py-2.5 text-left text-sm font-semibold text-notice">
                  {t.columns.demo}
                </th>
              </tr>
            </thead>
            <tbody className="max-sm:grid max-sm:gap-3">
              {t.rows.map((row) => (
                <tr key={row.topic} className="max-sm:grid max-sm:gap-1.5 max-sm:border-b max-sm:border-line max-sm:pb-3">
                  <th scope="row" className="py-2.5 pr-3 text-left align-top font-semibold sm:w-36 sm:border-b sm:border-line max-sm:py-0">
                    {row.topic}
                  </th>
                  <td className="px-3 py-2.5 align-top sm:border-b sm:border-line max-sm:p-0">
                    <span className="font-medium sm:hidden">{t.columns.app}: </span>
                    {row.app}
                  </td>
                  <td className="bg-notice-soft px-3 py-2.5 align-top text-notice sm:border-b sm:border-line max-sm:rounded-md max-sm:px-2.5 max-sm:py-1.5">
                    <span className="font-medium sm:hidden">{t.columns.demo}: </span>
                    {row.demo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
            {date && (
              <p className="tabular-nums">
                {t.stand} {date} · {t.commit} <span translate="no">{DEMO.commit}</span>
              </p>
            )}
            {DEMO.architectureUrl && (
              <a href={DEMO.architectureUrl} className={linkClass}>
                {t.architecture}
              </a>
            )}
          </div>

          {step === "failed" && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
              {t.resetFailed}
            </p>
          )}

          {step === "confirm" || step === "busy" ? (
            <div className="grid gap-3 rounded-xl border border-line bg-canvas p-4">
              <p className="text-[15px] font-medium text-pretty">{t.resetQuestion}</p>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setStep("info")} disabled={step === "busy"} className={`${buttonSecondary} disabled:opacity-60`}>
                  {t.cancel}
                </button>
                <button type="button" onClick={reset} disabled={step === "busy"} className={`${buttonPrimary} disabled:opacity-60`}>
                  <RefreshIcon size={16} />
                  {step === "busy" ? t.resetting : t.resetConfirm}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep("confirm")} className={buttonSecondary}>
                <RefreshIcon size={16} />
                {t.reset}
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className={buttonPrimary}>
                {t.close}
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
