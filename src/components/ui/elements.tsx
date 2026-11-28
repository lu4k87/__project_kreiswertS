// Small building blocks of the platform pages: page heading, card, notice, badge, facts list, empty state.
// Server-safe (no state). Colours and type sizes come from the tokens in src/app/globals.css:
// type scale 13 · 15 (body) · 18 (h3) · 22 (h2) · 32 (h1).
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./icons";

export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60";
export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/30 bg-surface px-5 py-2.5 text-[15px] font-semibold text-ink hover:bg-mint disabled:opacity-60";
/** Light button on a dark (brand) card. */
export const buttonInverse =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface px-5 py-2.5 text-[15px] font-semibold text-ink hover:bg-mint disabled:opacity-60";
/** Outlined button on a dark (brand) card. */
export const buttonOnBrand =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/50 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-hover";
export const buttonQuiet =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-mint disabled:opacity-60";
/** One entry (link or button) of a header menu. Lives here, not in the client component of the menu: a constant
 *  exported from a "use client" file reaches server components as a reference, not as the string. */
export const menuEntry = "flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-[15px] font-medium text-ink hover:bg-mint";
export const linkClass = "font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink";
export const cardClass = "min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6";

export function PageHeader({ title, intro, back, actions }: { title: string; intro?: string; back?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="grid gap-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance break-words hyphens-auto sm:text-[2rem]">{title}</h1>
          {intro && <p className="prose-justify mt-2 max-w-[68ch] text-[15px] leading-relaxed text-muted">{intro}</p>}
        </div>
        {actions && <div className="flex flex-none flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/** Card with a heading and an icon as visual anchor. `as="h3"` inside another section. */
export function Section({
  title,
  icon,
  children,
  aside,
  level = 2,
  id,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  level?: 2 | 3;
  id?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section className={cardClass} aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Heading id={id} className={`flex min-w-0 items-center gap-3 leading-tight font-semibold tracking-[-0.01em] ${level === 2 ? "text-[1.375rem]" : "text-lg"}`}>
          {icon && <span className={`grid flex-none place-items-center rounded-xl bg-mint ${level === 2 ? "size-12 *:size-6" : "size-10 *:size-5"}`}>{icon}</span>}
          <span className="min-w-0 text-balance break-words hyphens-auto">{title}</span>
        </Heading>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Tone = "info" | "attention" | "error" | "success";
const TONES: Record<Tone, string> = {
  info: "border-line bg-mint text-ink",
  attention: "border-notice/30 bg-notice-soft text-notice",
  error: "border-danger/40 bg-danger-soft text-danger",
  success: "border-brand/30 bg-mint text-ink",
};

/** Message box. `role="alert"` for errors, `role="status"` for the rest when it appears after an action. */
export function Notice({ tone = "info", title, children, live = false }: { tone?: Tone; title?: string; children?: ReactNode; live?: boolean }) {
  return (
    <div role={tone === "error" ? "alert" : live ? "status" : undefined} className={`flex gap-3 rounded-xl border px-4 py-3 text-[15px] leading-relaxed ${TONES[tone]}`}>
      <span className="mt-0.5 flex-none">{tone === "info" || tone === "success" ? <InfoIcon size={18} /> : <AlertIcon size={18} />}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-pretty">{children}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: "neutral" | "solid" | "attention" | "outline"; icon?: ReactNode }) {
  const tones = {
    neutral: "bg-mint text-ink",
    solid: "bg-brand text-white",
    attention: "bg-notice-soft text-notice",
    outline: "border border-ink/30 text-ink",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] leading-none font-medium whitespace-nowrap ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** Label / value rows. A value of null or "" is left out. A label that is not plain text needs a `key`. */
export function Facts({ rows, columns = 1 }: { rows: { label: ReactNode; key?: string; value: ReactNode; note?: ReactNode }[]; columns?: 1 | 2 }) {
  const shown = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className={`grid gap-x-10 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {shown.map((row) => (
        // label above the value on narrow screens, side by side from 640 px; long German words break with a hyphen
        <div key={row.key ?? String(row.label)} className="grid gap-x-4 gap-y-0.5 border-b border-line py-2.5 text-[15px] last:border-b-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <dt className="min-w-0 font-medium break-words hyphens-auto">{row.label}</dt>
          <dd className="min-w-0 break-words">
            {row.value}
            {row.note && <span className="mt-0.5 block text-[13px] leading-normal text-muted">{row.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-dashed border-ink/25 px-5 py-4">
      {icon && <span className="grid size-10 flex-none place-items-center rounded-lg bg-mint">{icon}</span>}
      <div className="min-w-[14rem] flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {text && <p className="prose-justify mt-0.5 max-w-[68ch] text-[15px] leading-relaxed text-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1.5 rounded text-[13px] font-medium hover:underline">
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

/** Kennzahl tile: number first for the eye, label first for screen readers. */
export function Stat({ value, label, href }: { value: ReactNode; label: string; href?: string }) {
  const body = (
    <>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="text-[2rem] leading-none font-semibold tabular-nums">{value}</dd>
    </>
  );
  const className = "flex flex-col-reverse gap-2 rounded-2xl border border-line bg-surface p-5";
  return href ? (
    <Link href={href} className={`${className} hover:border-ink/40`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
