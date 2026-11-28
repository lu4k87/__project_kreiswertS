// Header of the public pages: logo, public navigation and the actions on the right.
// Page tree "Public website": Home | How it works | Regional map | About | Log in | Register company.
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import { BrandLogo } from "@/components/ui/brand-mark";
import { HomeNav } from "./home-nav";
import { LanguageSwitch } from "./language-switch";
import { ThemeSwitch } from "./theme-switch";
import { DEMO_STATIC } from "@/lib/demo";
import { DemoNotice } from "./demo-notice";
import { ROUTES } from "./links";

type PublicPage = "about" | "regionalMap" | "help";

type Props = {
  t: Messages;
  locale: Locale;
  /** "home": start page (scrolling navigation) · "public": other public pages · "login": language + help only */
  variant: "home" | "public" | "login";
  /** Public page that is open, marked in the navigation. */
  current?: PublicPage;
  isMember?: boolean;
};

const action = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-hover";

export function SiteHeader({ t, locale, variant, current, isMember = false }: Props) {
  const n = t.platform.nav;
  const pages: { key: PublicPage; href: string; text: string }[] = [
    { key: "regionalMap", href: ROUTES.regionalMap, text: n.regionalMap },
    { key: "about", href: ROUTES.about, text: n.about },
  ];
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-8 gap-y-4 px-5 py-5 sm:px-8">
        <Link href={ROUTES.home} aria-label={t.common.home} className="flex items-center gap-3 rounded-lg">
          <BrandLogo text={t.common.brand} />
        </Link>

        {variant === "home" && (
          <HomeNav label={t.common.mainNav} overview={t.header.overview} howItWorks={t.header.howItWorks} pages={pages} />
        )}
        {variant === "public" && (
          <nav aria-label={t.common.mainNav} className="order-last w-full xl:order-none xl:w-auto xl:flex-1">
            <ul className="flex flex-wrap gap-x-8 gap-y-1 whitespace-nowrap xl:flex-nowrap xl:justify-center">
              {[{ key: "home", href: ROUTES.home, text: n.home }, { key: "how", href: ROUTES.howItWorks, text: t.header.howItWorks }, ...pages].map((page) => (
                <li key={page.key}>
                  <Link
                    href={page.href}
                    aria-current={page.key === current ? "page" : undefined}
                    className={
                      page.key === current
                        ? "relative block pb-2 text-[15px] font-medium text-ink after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-ink"
                        : "block pb-2 text-[15px] font-medium text-muted hover:text-ink"
                    }
                  >
                    {page.text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:ml-auto sm:w-auto sm:justify-end sm:gap-x-6">
          <div className="flex items-center gap-3">
            <LanguageSwitch locale={locale} label={t.common.language} />
            <ThemeSwitch toDark={t.common.themeToDark} toLight={t.common.themeToLight} />
            {DEMO_STATIC && <DemoNotice locale={locale} />}
          </div>
          {variant === "login" ? (
            <Link href={ROUTES.help} className="text-[15px] hover:underline">
              {t.header.needHelp}
            </Link>
          ) : isMember ? (
            <Link href={ROUTES.dashboard} className={action}>
              {t.header.dashboard}
            </Link>
          ) : (
            <>
              <Link href={ROUTES.login} className="text-[15px] font-semibold hover:underline">
                {t.header.logIn}
              </Link>
              {/* the static demo has demo logins only */}
              {!DEMO_STATIC && (
                <Link href={ROUTES.register} className={action}>
                  {n.registerCompany}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
