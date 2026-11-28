// Registration, step 2 (PG-04): the physical site of the account that was just created. Accounts that already
// have a site (and the administrator) go to the dashboard; guests start at step 1. Layout "Reg:A" (user, 2026-11-28):
// timeline of the steps and the company from the account on the left (4 columns), the form on the right (8).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { auth } from "@/server/auth";
import { listParks } from "@/server/dal/catalogue";
import { getViewerOrGuest } from "@/server/viewer";
import { Facts, cardClass, grid12, stack } from "@/components/ui/elements";
import { RegistrationSteps } from "@/components/auth/registration-steps";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROUTES } from "@/components/layout/links";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { SiteRegistrationForm } from "@/components/sites/site-registration-form";
import { DEMO_STATIC } from "@/lib/demo";

export default async function RegisterSitePage() {
  if (DEMO_STATIC) redirect(ROUTES.login); // the static demo has demo logins only
  const requestHeaders = await headers();
  const viewer = await getViewerOrGuest(requestHeaders);
  if (viewer.role === "guest") redirect(ROUTES.register);
  if (viewer.role === "admin" || viewer.site) redirect(ROUTES.dashboard);
  const locale = await getLocale();
  const t = messages[locale];
  const r = t.platform.registerSite;
  const [session, parks] = await Promise.all([auth.api.getSession({ headers: requestHeaders }), listParks()]);
  const steps = [
    { label: r.stepAccount, state: "done" },
    { label: r.stepSite, state: "current" },
    { label: r.stepVerification, state: "next" },
  ] as const;

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="login" />
      {/* below 1024 px one column: steps, company, form, log out (the left stack dissolves, `order` sorts) */}
      <main id="content" className={`app-area ${grid12} mx-auto max-w-[1328px] content-start px-5 py-10 sm:px-8 lg:py-14`}>
        <div className={`${stack} max-lg:contents lg:col-span-4`}>
          <div className="min-w-0 max-lg:order-1">
            <RegistrationSteps label={r.stepsLabel} steps={steps} />
          </div>
          <div className={`${cardClass} max-lg:order-2`}>
            <Facts
              layout="rail"
              rows={[
                { label: r.company, value: session?.user.companyName, note: r.companyFromAccount },
                { label: t.register.vatId, value: session?.user.vatId },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 max-lg:order-4">
            <SignOutButton label={t.platform.nav.logOut} busyLabel={t.platform.nav.loggingOut} failedLabel={t.platform.nav.logOutFailed} className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline" />
          </div>
        </div>
        <section className="min-w-0 rounded-3xl border border-line bg-surface p-6 max-lg:order-3 sm:p-8 lg:col-span-8">
          <h1 className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">{r.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted">{r.intro}</p>
          <div className="mt-8">
            <SiteRegistrationForm parks={parks.map(({ id, name, city }) => ({ id, name, city }))} t={t.platform} />
          </div>
        </section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
