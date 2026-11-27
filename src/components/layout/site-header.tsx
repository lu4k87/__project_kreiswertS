// Header of the public pages: logo, public navigation and the actions on the right.
// Page tree "Public website": Home | How it works | Regional map | About | Log in | Register company.
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import { LoopIcon } from "@/components/ui/icons";
import { HomeNav } from "./home-nav";
import { LanguageSwitch } from "./language-switch";
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
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-10 gap-y-4 px-5 py-5 sm:px-8">
        <Link href={ROUTES.home} aria-label={t.common.home} className="flex items-center gap-3 rounded-lg">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white">
            <LoopIcon size={20} />
          </span>
          <span className="text-2xl font-medium tracking-tight" translate="no">
            {t.common.brand}
          </span>
        </Link>

        {variant === "home" && (
          <HomeNav label={t.common.mainNav} overview={t.header.overview} howItWorks={t.header.howItWorks} pages={pages} />
        )}
        {variant === "public" && (
          <nav aria-label={t.common.mainNav} className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
            <ul className="flex flex-wrap gap-x-8 gap-y-1 lg:justify-center lg:gap-x-12">
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
          <LanguageSwitch locale={locale} label={t.common.language} />
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
              <Link href={ROUTES.register} className={action}>
                {n.registerCompany}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
