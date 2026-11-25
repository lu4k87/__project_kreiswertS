// Page header: logo, main navigation (start page) and the actions on the right.
import Link from "next/link";
import type { Locale, Messages } from "@/i18n/messages";
import { LoopIcon } from "@/components/ui/icons";
import { LanguageSwitch } from "./language-switch";
import { PLACEHOLDER_HREF, ROUTES } from "./links";

type Props = {
  t: Messages;
  locale: Locale;
  /** "home": navigation + login/register · "login": language + help only */
  variant: "home" | "login";
  isMember?: boolean;
};

export function SiteHeader({ t, locale, variant, isMember = false }: Props) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center gap-x-10 gap-y-4 px-5 py-5 sm:px-8">
        <Link href={ROUTES.home} aria-label={t.common.home} className="flex items-center gap-3 rounded-lg">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white">
            <LoopIcon size={20} />
          </span>
          <span className="text-2xl font-medium tracking-tight">{t.common.brand}</span>
        </Link>

        {variant === "home" && (
          <nav aria-label={t.common.mainNav} className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
            <ul className="flex gap-8 lg:justify-center lg:gap-16">
              <li>
                <Link
                  href={ROUTES.home}
                  aria-current="page"
                  className="relative block pb-2 text-[15px] font-medium after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-ink"
                >
                  {t.header.overview}
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.howItWorks}
                  className="block pb-2 text-[15px] text-muted hover:text-ink"
                >
                  {t.header.howItWorks}
                </Link>
              </li>
            </ul>
          </nav>
        )}

        <div className="flex w-full items-center justify-between gap-x-4 sm:ml-auto sm:w-auto sm:justify-end sm:gap-x-6">
          <LanguageSwitch locale={locale} label={t.common.language} />
          {variant === "login" ? (
            <a href={PLACEHOLDER_HREF} className="text-[15px] hover:underline">
              {t.header.needHelp}
            </a>
          ) : isMember ? (
            <Link
              href={ROUTES.account}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-hover"
            >
              {t.header.account}
            </Link>
          ) : (
            <>
              <Link href={ROUTES.login} className="text-[15px] font-semibold hover:underline">
                {t.header.logIn}
              </Link>
              <Link
                href={ROUTES.register}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-hover"
              >
                {t.header.createAccount}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
