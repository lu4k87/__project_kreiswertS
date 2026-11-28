// Frame of the company platform: header with the main navigation and the notification bell, content column, footer.
// Guests see none of it – every page below redirects them to the login (gate.tsx).
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { unreadNotificationCount } from "@/server/dal/alerts";
import { getMySite } from "@/server/dal/sites";
import { getViewerOrGuest } from "@/server/viewer";
import { PlatformHeader } from "@/components/layout/platform-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const [viewer, locale] = await Promise.all([getViewerOrGuest(await headers()), getLocale()]);
  const t = messages[locale];
  if (viewer.role === "guest") return <>{children}</>;
  // the bell must never take the page down: without the count it simply shows none
  // the same goes for the company name in the account menu: without it the menu shows no name
  const [unread, company] = await Promise.all([
    unreadNotificationCount(viewer).catch(() => 0),
    viewer.role === "member" && viewer.site ? getMySite(viewer).then((site) => site.companyName, () => null) : null,
  ]);
  return (
    <>
      <PlatformHeader t={t} locale={locale} isAdmin={viewer.role === "admin"} unread={unread} company={company} />
      <main id="content" className="mx-auto grid w-full max-w-[1328px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        {children}
      </main>
      <SiteFooter t={t} />
    </>
  );
}
