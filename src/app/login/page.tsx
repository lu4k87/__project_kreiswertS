// Login page (Figma "Log in"): brand card with material photo, login form. Logged-in members go to /konto.
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewer } from "@/server/viewer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ROUTES } from "@/components/layout/links";
import { AuthBrandCard } from "@/components/auth/auth-brand-card";
import { LoginForm } from "@/components/auth/login-form";
import { ArrowLeftIcon } from "@/components/ui/icons";

export default async function LoginPage() {
  const viewer = await getViewer(await headers());
  if (viewer.role === "member") redirect(ROUTES.account);
  const locale = await getLocale();
  const t = messages[locale];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="login" />

      <main className="mx-auto grid w-full max-w-[1328px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,620px)_minmax(0,448px)] lg:justify-between lg:gap-16 lg:px-16 lg:py-12">
        <AuthBrandCard t={t.login} />

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
