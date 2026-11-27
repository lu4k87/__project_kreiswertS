// Password recovery, step 1 (PG-05): ask for a reset link. Same layout as the login page.
import Link from "next/link";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { AuthBrandCard } from "@/components/auth/auth-brand-card";
import { ForgotPasswordForm } from "@/components/auth/recovery-forms";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROUTES } from "@/components/layout/links";

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = messages[locale];
  const r = t.platform.recovery;
  return (
    <>
      <SiteHeader t={t} locale={locale} variant="login" />
      <main id="content" className="mx-auto grid w-full max-w-[1328px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,620px)_minmax(0,448px)] lg:justify-between lg:gap-16 lg:px-16 lg:py-12">
        <AuthBrandCard t={t.login} />
        <section className="w-full max-w-[448px] justify-self-center lg:justify-self-auto">
          <Link href={ROUTES.login} className="inline-flex items-center gap-1.5 text-sm hover:underline">
            <ArrowLeftIcon size={14} />
            {r.backToLogin}
          </Link>
          <h1 className="mt-4 text-[clamp(2rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.025em] text-balance">{r.forgotTitle}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted">{r.forgotIntro}</p>
          <ForgotPasswordForm t={t} />
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
