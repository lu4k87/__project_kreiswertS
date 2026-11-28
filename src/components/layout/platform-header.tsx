// Header of the company platform (page tree "Registered company – Level 2"), one row (user, 2026-11-28, layout
// "Kopf:B"): logo, the main entries as text – Dashboard, Offers, Requests, Map, Companies, My listings – and on the
// right the bell with the unread notices of saved searches (function no. 19), one "Create" button with a menu
// (offer, request) and the account menu (my account, language, appearance, log out). The administrator gets the
// admin pages instead of "My listings", no bell and no "Create".
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import { ChevronDownIcon, PlusIcon, UserIcon } from "@/components/ui/icons";
import { BrandLogo } from "@/components/ui/brand-mark";
import { buttonPrimary, menuEntry } from "@/components/ui/elements";
import { DEMO_STATIC } from "@/lib/demo";
import { DemoNotice, DemoNoticeMenuEntry } from "./demo-notice";
import { HeaderMenu } from "./header-menu";
import { initialsOf } from "./initials";
import { LanguageSwitch } from "./language-switch";
import { NotificationBell } from "./notification-bell";
import { ThemeMenuEntry } from "./theme-switch";
import { ROUTES } from "./links";
import { PlatformNav, type NavItem } from "./platform-nav";
import { SignOutButton } from "./sign-out-button";

type Props = { t: Messages; locale: Locale; isAdmin: boolean; unread?: number; /** Company of the logged-in site, shown in the account menu. */ company?: string | null };

export function PlatformHeader({ t, locale, isAdmin, unread = 0, company }: Props) {
  const n = t.platform.nav;
  const shared: NavItem[] = [
    { href: ROUTES.dashboard, label: n.dashboard, match: [ROUTES.negotiations, ROUTES.exchanges] },
    { href: ROUTES.offers, label: n.offers },
    { href: ROUTES.requests, label: n.requests },
    { href: ROUTES.map, label: n.map },
    { href: ROUTES.companies, label: n.companies, match: ["/sites"] },
  ];
  const items: NavItem[] = isAdmin
    ? [...shared, { href: ROUTES.adminVerification, label: n.verification }, { href: ROUTES.adminReferenceData, label: n.referenceData }]
    : // "My listings": my offers, my requests and the matches between them (tabs on each page)
      [...shared, { href: ROUTES.myOffers, label: n.myListings, match: [ROUTES.myRequests, ROUTES.matches] }];
  const initials = company ? initialsOf(company) : "";

  return (
    <header className="border-b border-line bg-surface">
      <a href="#content" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {n.skip}
      </a>
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-8">
        <Link href={ROUTES.dashboard} aria-label={t.common.home} className="flex flex-none items-center gap-3 rounded-lg">
          {/* below 456 px only the mark: the wordmark, the bell and both menus do not fit into one row there */}
          <BrandLogo text={t.common.brand} textClassName="max-[28.5rem]:hidden" />
        </Link>

        <PlatformNav items={items} label={n.label} />

        {/* `relative` below 640 px: the menu panels are positioned on this row there (header-menu.tsx) */}
        <div className="ml-auto flex flex-none items-center gap-2 max-sm:relative sm:gap-3">
          {/* static demo: only the dialog here, its entry sits in the account menu – this row has no room for a button */}
          {DEMO_STATIC && <DemoNotice locale={locale} trigger={false} />}
          {!isAdmin && <NotificationBell unread={unread} t={t.platform} />}
          {!isAdmin && (
            <HeaderMenu
              // below 640 px only the plus sign is shown: logo, bell and both menus have to fit into 320 px
              buttonClassName={`${buttonPrimary} px-4 whitespace-nowrap max-sm:size-11 max-sm:px-0`}
              button={
                <>
                  <PlusIcon size={18} className="flex-none" />
                  <span className="max-sm:sr-only">{n.create}</span>
                  <ChevronDownIcon size={16} className="flex-none max-sm:hidden" />
                </>
              }
            >
              <Link href={ROUTES.newOffer} className={menuEntry}>
                {n.createOffer}
                <span className="text-[13px] font-normal text-muted">{n.createOfferHint}</span>
              </Link>
              <Link href={ROUTES.newRequest} className={menuEntry}>
                {n.createRequest}
                <span className="text-[13px] font-normal text-muted">{n.createRequestHint}</span>
              </Link>
            </HeaderMenu>
          )}
          <HeaderMenu
            label={company ? `${n.accountMenu}: ${company}` : n.accountMenu}
            buttonClassName="flex min-h-11 items-center gap-1.5 rounded-full border border-line py-1 pr-2.5 pl-1.5 text-ink hover:bg-mint"
            button={
              <>
                <span className="grid size-8 flex-none place-items-center rounded-full bg-mint text-[13px] leading-none font-semibold" translate="no">
                  {initials || <UserIcon size={16} />}
                </span>
                <ChevronDownIcon size={16} className="flex-none" />
              </>
            }
          >
            {company && <p className="mb-1 max-w-[18rem] border-b border-line px-3 pt-1.5 pb-2.5 text-[15px] leading-snug font-semibold break-words">{company}</p>}
            <Link href={ROUTES.account} className={menuEntry}>
              {n.account}
            </Link>
            <div className={`${menuEntry} hover:bg-transparent`}>
              <span>{t.common.language}</span>
              <LanguageSwitch locale={locale} label={t.common.language} />
            </div>
            <ThemeMenuEntry label={n.appearance} dark={n.themeDark} light={n.themeLight} toDark={t.common.themeToDark} toLight={t.common.themeToLight} className={menuEntry} />
            {DEMO_STATIC && <DemoNoticeMenuEntry locale={locale} className={menuEntry} />}
            <SignOutButton label={n.logOut} busyLabel={n.loggingOut} failedLabel={n.logOutFailed} className={`${menuEntry} justify-start gap-2 disabled:opacity-60`} />
          </HeaderMenu>
        </div>
      </div>
    </header>
  );
}
