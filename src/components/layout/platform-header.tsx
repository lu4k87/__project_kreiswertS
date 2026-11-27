// Header of the company platform (page tree "Registered company – Level 2"): Dashboard, Offers, Requests, Map,
// Companies, My listings, My account; primary actions Create offer and Create request. The administrator gets the admin pages instead
// of the site pages.
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import {
  BuildingIcon,
  DashboardIcon,
  FileTextIcon,
  LayersIcon,
  MapIcon,
  PackageIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@/components/ui/icons";
import { BrandLogo } from "@/components/ui/brand-mark";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/ui/elements";
import { LanguageSwitch } from "./language-switch";
import { ThemeSwitch } from "./theme-switch";
import { ROUTES } from "./links";
import { PlatformNav, type NavItem } from "./platform-nav";
import { SignOutButton } from "./sign-out-button";

export function PlatformHeader({ t, locale, isAdmin }: { t: Messages; locale: Locale; isAdmin: boolean }) {
  const n = t.platform.nav;
  const shared: NavItem[] = [
    { href: ROUTES.dashboard, label: n.dashboard, icon: <DashboardIcon size={16} />, match: [ROUTES.negotiations, ROUTES.exchanges] },
    { href: ROUTES.offers, label: n.offers, icon: <PackageIcon size={16} /> },
    { href: ROUTES.requests, label: n.requests, icon: <FileTextIcon size={16} /> },
    { href: ROUTES.map, label: n.map, icon: <MapIcon size={16} /> },
    { href: ROUTES.companies, label: n.companies, icon: <BuildingIcon size={16} />, match: ["/sites"] },
  ];
  const items: NavItem[] = isAdmin
    ? [
        ...shared,
        { href: ROUTES.adminVerification, label: n.verification, icon: <ShieldCheckIcon size={16} /> },
        { href: ROUTES.adminReferenceData, label: n.referenceData, icon: <FileTextIcon size={16} /> },
        { href: ROUTES.account, label: n.account, icon: <UserIcon size={16} /> },
      ]
    : [
        ...shared,
        // "My listings": my offers, my requests and the matches between them (tabs on each page)
        { href: ROUTES.myOffers, label: n.myListings, icon: <LayersIcon size={16} />, match: [ROUTES.myRequests, ROUTES.matches] },
        { href: ROUTES.account, label: n.account, icon: <UserIcon size={16} /> },
      ];

  return (
    <header className="border-b border-line bg-surface">
      <a href="#content" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {n.skip}
      </a>
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-6 gap-y-3 px-5 pt-4 pb-2 sm:px-8">
        <Link href={ROUTES.dashboard} aria-label={t.common.home} className="flex flex-none items-center gap-3 rounded-lg">
          <BrandLogo text={t.common.brand} />
        </Link>

        <PlatformNav items={items} label={n.label} />

        {/* Narrow screens: settings + log out in one row, the two create buttons side by side at equal width below it
            (instead of a ragged right-aligned stack), without the plus sign so each label stays on one line; from sm
            everything sits in one row on the right. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:ml-auto sm:w-auto sm:justify-end">
          <div className="flex items-center gap-3">
            <LanguageSwitch locale={locale} label={t.common.language} />
            <ThemeSwitch toDark={t.common.themeToDark} toLight={t.common.themeToLight} />
          </div>
          <SignOutButton label={n.logOut} busyLabel={n.loggingOut} failedLabel={n.logOutFailed} className={buttonQuiet} />
          {!isAdmin && (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-4">
              <Link href={ROUTES.newRequest} className={`${buttonSecondary} min-h-10 px-4 py-2 whitespace-nowrap max-sm:px-2 max-sm:text-sm`}>
                <PlusIcon size={16} className="hidden flex-none sm:block" />
                {n.createRequest}
              </Link>
              <Link href={ROUTES.newOffer} className={`${buttonPrimary} min-h-10 px-4 py-2 whitespace-nowrap max-sm:px-2 max-sm:text-sm`}>
                <PlusIcon size={16} className="hidden flex-none sm:block" />
                {n.createOffer}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
