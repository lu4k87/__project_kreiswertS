// Registration, step 2 (PG-04): the physical site of the account that was just created. Accounts that already
// have a site (and the administrator) go to the dashboard; guests start at step 1.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { auth } from "@/server/auth";
import { listParks } from "@/server/dal/catalogue";
import { getViewerOrGuest } from "@/server/viewer";
import { Facts } from "@/components/ui/elements";
import { CheckIcon } from "@/components/ui/icons";
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
      <main id="content" className="mx-auto grid w-full max-w-[860px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-10 sm:px-8 lg:py-14">
        <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium">
          {steps.map((step, index) => (
            <li key={step.label} aria-current={step.state === "current" ? "step" : undefined} className="flex items-center gap-2">
              <span className={`grid size-6 flex-none place-items-center rounded-full ${step.state === "next" ? "border border-ink/40" : "bg-brand text-white"}`}>
                {step.state === "done" ? <CheckIcon size={14} /> : index + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance">{r.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted">{r.intro}</p>
          <div className="mt-6 rounded-xl bg-canvas px-4 py-2">
            <Facts
              rows={[
                { label: r.company, value: session?.user.companyName, note: r.companyFromAccount },
                { label: t.register.vatId, value: session?.user.vatId },
              ]}
            />
          </div>
          <div className="mt-8">
            <SiteRegistrationForm parks={parks.map(({ id, name, city }) => ({ id, name, city }))} t={t.platform} />
          </div>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <SignOutButton label={t.platform.nav.logOut} busyLabel={t.platform.nav.loggingOut} failedLabel={t.platform.nav.logOutFailed} className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline" />
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
