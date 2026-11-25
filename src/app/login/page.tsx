// Login page (Figma "Log in"): brand card with material photo, login form. Logged-in members go to /konto.
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewer } from "@/server/viewer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PLACEHOLDER_HREF, ROUTES } from "@/components/layout/links";
import { LoginForm } from "@/components/auth/login-form";
import { ArrowLeftIcon, ArrowUpRightIcon, LoopIcon } from "@/components/ui/icons";

export default async function LoginPage() {
  const viewer = await getViewer(await headers());
  if (viewer.role === "member") redirect(ROUTES.account);
  const locale = await getLocale();
  const t = messages[locale];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="login" />

      <main className="mx-auto grid w-full max-w-[1328px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,620px)_minmax(0,448px)] lg:justify-between lg:gap-16 lg:px-16 lg:py-12">
        <section className="order-last overflow-hidden rounded-2xl bg-brand text-white lg:order-none">
          <div className="p-8 sm:p-10">
            <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.16em] text-on-brand-muted uppercase">
              <LoopIcon size={16} />
              {t.login.kicker}
            </p>
            {/* tagline, not a section heading → <p> keeps the h1 "Welcome back." on top */}
            <p className="mt-5 text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.025em] text-balance">
              {t.login.titleLine1}
              <br />
              {t.login.titleLine2}
            </p>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-on-brand-muted">{t.login.text}</p>
          </div>
          <div className="relative aspect-[620/435]">
            <Image
              src="/images/pet-flakes.jpg"
              alt={t.login.imageAlt}
              fill
              sizes="(min-width: 1024px) 620px, 100vw"
              className="object-cover"
              priority
            />
            {/* Overlay card deliberately sits on the photo. */}
            <a
              href={PLACEHOLDER_HREF}
              className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-lg bg-canvas px-4 py-3 text-ink shadow-sm sm:inset-x-7 sm:bottom-7"
            >
              <span className="min-w-0">
                <span className="block text-[15px]">{t.login.imageTitle}</span>
                <span className="block text-xs text-muted">{t.login.imageText}</span>
              </span>
              <ArrowUpRightIcon size={18} />
            </a>
          </div>
        </section>

        <section className="w-full max-w-[448px] justify-self-center lg:justify-self-auto">
          <Link href={ROUTES.home} className="inline-flex items-center gap-1.5 text-sm hover:underline">
            <ArrowLeftIcon size={14} />
            {t.login.back}
          </Link>
          <h1 className="mt-4 text-[clamp(2rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.025em]">
            {t.login.heading}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{t.login.intro}</p>
          <LoginForm t={t.login} locale={locale} />
        </section>
      </main>

      <SiteFooter t={t} />
    </>
  );
}
