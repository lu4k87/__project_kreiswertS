// Password recovery, step 2 (PG-05): the link from the reset message leads here with `?token=…`; an expired or
// used link arrives with `?error=INVALID_TOKEN`. The token is single-use and valid for 30 minutes.
import Link from "next/link";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { Notice, buttonPrimary } from "@/components/ui/elements";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { AuthBrandCard } from "@/components/auth/auth-brand-card";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROUTES } from "@/components/layout/links";

type Props = { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = messages[locale];
  const r = t.platform.recovery;
  const { token } = await searchParams;
  // only the shape is checked here; the server decides whether the token is valid
  const usable = typeof token === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(token) ? token : null;
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
          <h1 className="mt-4 text-[clamp(2rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.025em] text-balance">{r.resetTitle}</h1>
          {usable ? (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted">{r.resetIntro}</p>
              <ResetPasswordForm t={t} locale={locale} token={usable} />
            </>
          ) : (
            <div className="mt-6 grid gap-4">
              <Notice tone="attention">{r.invalidToken}</Notice>
              <Link href={ROUTES.forgotPassword} className={buttonPrimary}>
                {r.requestNew}
              </Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
