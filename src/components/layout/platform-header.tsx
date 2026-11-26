// Header of the company platform (page tree "Registered company – Level 1"): Dashboard, Material offers, Map,
// Companies, My offers, My account; primary action Create offer. The administrator gets the admin pages instead
// of the site pages.
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import {
  BuildingIcon,
  DashboardIcon,
  FileTextIcon,
  LayersIcon,
  LoopIcon,
  MapIcon,
  PackageIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@/components/ui/icons";
import { buttonPrimary, buttonQuiet } from "@/components/ui/elements";
import { LanguageSwitch } from "./language-switch";
import { ROUTES } from "./links";
import { PlatformNav, type NavItem } from "./platform-nav";
import { SignOutButton } from "./sign-out-button";

export function PlatformHeader({ t, locale, isAdmin }: { t: Messages; locale: Locale; isAdmin: boolean }) {
  const n = t.platform.nav;
  const shared: NavItem[] = [
    { href: ROUTES.dashboard, label: n.dashboard, icon: <DashboardIcon size={16} /> },
    { href: ROUTES.offers, label: n.offers, icon: <PackageIcon size={16} /> },
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
        { href: ROUTES.myOffers, label: n.myOffers, icon: <LayersIcon size={16} /> },
        { href: ROUTES.account, label: n.account, icon: <UserIcon size={16} /> },
      ];

  return (
    <header className="border-b border-line bg-canvas">
      <a href="#content" className="sr-only focus:not-sr-only focus:m-2 focus:inline-block focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {n.skip}
      </a>
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-6 gap-y-3 px-5 pt-4 pb-2 sm:px-8">
        <Link href={ROUTES.dashboard} aria-label={t.common.home} className="flex flex-none items-center gap-3 rounded-lg">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white">
            <LoopIcon size={20} />
          </span>
          <span className="text-2xl font-medium tracking-tight" translate="no">
            {t.common.brand}
          </span>
        </Link>

        <PlatformNav items={items} label={n.label} />

        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <LanguageSwitch locale={locale} label={t.common.language} />
          <SignOutButton label={n.logOut} busyLabel={n.loggingOut} failedLabel={n.logOutFailed} className={buttonQuiet} />
          {!isAdmin && (
            <Link href={ROUTES.newOffer} className={`${buttonPrimary} min-h-10 px-4 py-2`}>
              <PlusIcon size={16} />
              {n.createOffer}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
