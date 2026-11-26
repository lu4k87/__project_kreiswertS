// Access to a platform page (D03): who may open it, and what the others see instead.
// The Data Access Layer checks every query again – this file only decides between redirect, notice and page.
import "server-only";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages, type Locale, type Messages } from "@/i18n/messages";
import type { Admin, Member, ViewerSite } from "@/server/access";
import { getMySite } from "@/server/dal/sites";
import { getViewerOrGuest } from "@/server/viewer";
import { Notice, buttonSecondary } from "@/components/ui/elements";
import { ROUTES } from "@/components/layout/links";

type SiteMember = Member & { site: ViewerSite };
/**
 * account: any login with a finished registration · site: a company site (not the administrator) ·
 * browse: verified site or administrator · admin: the administrator
 */
export type Need = "account" | "site" | "browse" | "admin";

type Base = { locale: Locale; t: Messages };
type Granted<V> = Base & { viewer: V; blocked: null };
// JSX.Element (never null): `if (page.blocked)` then tells the two cases apart for TypeScript.
type Blocked = Base & { viewer: SiteMember | Admin; blocked: JSX.Element };

function Refusal({ tone = "attention", title, text, extra, actions }: { tone?: "attention" | "info"; title: string; text: string; extra?: ReactNode; actions: { href: string; label: string }[] }) {
  return (
    <div className="grid gap-4">
      <Notice tone={tone} title={title}>
        <p>{text}</p>
        {extra}
      </Notice>
      <p className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className={buttonSecondary}>
            {action.label}
          </Link>
        ))}
      </p>
    </div>
  );
}

export async function platformPage(need: "admin", path: string): Promise<Granted<Admin> | Blocked>;
export async function platformPage(need: "site", path: string): Promise<Granted<SiteMember> | Blocked>;
export async function platformPage(need: "account" | "browse", path: string): Promise<Granted<SiteMember | Admin> | Blocked>;
/**
 * `path`: the page itself, used as the return target after login. Guests go to the login, accounts without a
 * site to the site step of the registration; everyone else gets the page or a notice explaining why not.
 */
export async function platformPage(need: Need, path: string): Promise<Granted<SiteMember | Admin> | Blocked> {
  const [viewer, locale] = await Promise.all([getViewerOrGuest(await headers()), getLocale()]);
  const t = messages[locale];
  const g = t.platform.gate;
  if (viewer.role === "guest") redirect(`${ROUTES.login}?next=${encodeURIComponent(path)}`);
  if (viewer.role === "member" && !viewer.site) redirect(ROUTES.registerSite);
  const account = viewer as SiteMember | Admin;
  const base = { locale, t, viewer: account };

  if (need === "admin" && account.role !== "admin") {
    return { ...base, blocked: <Refusal title={g.adminOnlyTitle} text={g.adminOnlyText} actions={[{ href: ROUTES.dashboard, label: g.toDashboard }]} /> };
  }
  if (need === "site" && account.role === "admin") {
    return { ...base, blocked: <Refusal tone="info" title={g.memberOnlyTitle} text={g.memberOnlyText} actions={[{ href: ROUTES.adminVerification, label: g.toVerification }]} /> };
  }
  if (need === "browse" && account.role === "member" && account.site.status !== "verified") {
    const actions = [
      { href: ROUTES.account, label: g.toAccount },
      { href: ROUTES.myOffers, label: g.toMyOffers },
    ];
    if (account.site.status === "pending") return { ...base, blocked: <Refusal title={g.pendingTitle} text={g.pendingText} actions={actions} /> };
    const note = (await getMySite(account)).verificationNote;
    const extra = note ? (
      <p className="mt-2">
        <span className="font-semibold">{g.declinedReason}:</span> {note}
      </p>
    ) : undefined;
    return { ...base, blocked: <Refusal title={g.declinedTitle} text={g.declinedText} extra={extra} actions={actions} /> };
  }
  return { ...base, blocked: null };
}
