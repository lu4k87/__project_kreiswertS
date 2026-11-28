// Register page (Figma "Create account"): on the 12-column grid (layout "Reg:A", user 2026-11-28) the timeline of
// the three steps, benefits and material photo on the left (4 columns), the form card on the right (8).
// Step 1 of the registration (account + company); step 2 is /register/site. Logged-in accounts go on from there.
import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewerOrGuest } from "@/server/viewer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ROUTES } from "@/components/layout/links";
import { RegisterForm } from "@/components/auth/register-form";
import { ArrowLeftIcon, CheckIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { grid12, stack } from "@/components/ui/elements";
import { RegistrationSteps } from "@/components/auth/registration-steps";
import { DEMO_STATIC } from "@/lib/demo";

// ponytail: pellet photo from Figma goes to public/images/pellets.jpg; until then the PET photo stands in.
const PHOTO = existsSync(path.join(process.cwd(), "public/images/pellets.jpg"))
  ? "/images/pellets.jpg"
  : "/images/pet-flakes.jpg";

export default async function RegisterPage() {
  if (DEMO_STATIC) redirect(ROUTES.login); // the static demo has demo logins only
  const viewer = await getViewerOrGuest(await headers());
  if (viewer.role === "admin") redirect(ROUTES.dashboard);
  if (viewer.role === "member") redirect(viewer.site ? ROUTES.dashboard : ROUTES.registerSite);
  const locale = await getLocale();
  const t = messages[locale];
  const r = t.register;
  const s = t.platform.registerSite;
  const steps = [
    { label: s.stepAccount, state: "current" },
    { label: s.stepSite, state: "next" },
    { label: s.stepVerification, state: "next" },
  ] as const;

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="login" />

      {/* below 1024 px one column: steps, form, then the benefits (the left stack dissolves, `order` sorts) */}
      <main className={`${grid12} mx-auto w-full max-w-[1328px] px-5 py-10 sm:px-8 lg:py-16`}>
        <div className={`${stack} max-lg:contents lg:col-span-4`}>
          <Link href={ROUTES.home} className="inline-flex items-center gap-1.5 justify-self-start text-sm hover:underline">
            <ArrowLeftIcon size={14} />
            {t.login.back}
          </Link>
          <div className="min-w-0 max-lg:order-1">
            <RegistrationSteps label={s.stepsLabel} steps={steps} />
          </div>
          <section className="grid min-w-0 gap-8 max-lg:order-3">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] uppercase">{r.kicker}</p>
              {/* tagline, not a section heading → <p> keeps the h1 "Create your account" on top */}
              <p className="mt-5 text-[clamp(2.25rem,3.2vw,2.75rem)] leading-[1.08] font-medium tracking-[-0.03em] text-balance">
                {r.titleLine1}
                <br />
                {r.titleLine2}
              </p>
              <p className="mt-6 max-w-[42ch] text-[17px] leading-relaxed text-pretty text-muted">{r.text}</p>
            </div>

            <ul className="grid gap-5">
              {r.benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3.5 text-[15px]">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-mint">
                    <CheckIcon size={16} />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <figure className="rounded-2xl bg-mint p-4">
              <div className="relative aspect-[565/250] overflow-hidden rounded-lg">
                <Image src={PHOTO} alt={r.imageAlt} fill sizes="(min-width: 1024px) 370px, 100vw" className="object-cover" />
              </div>
              <figcaption className="mt-4 text-[15px] leading-relaxed">
                {r.imageCaption1}
                <br />
                {r.imageCaption2}
              </figcaption>
            </figure>

            <p className="flex items-center gap-2.5 text-[13px] text-muted">
              <ShieldCheckIcon size={18} />
              {r.secure}
            </p>
          </section>
        </div>

        <section className="min-w-0 rounded-3xl border border-line bg-surface p-6 max-lg:order-2 sm:p-8 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <h1 className="text-[clamp(1.75rem,2.6vw,2.25rem)] leading-tight font-semibold tracking-[-0.025em]">
              {r.heading}
            </h1>
            <span className="mt-1.5 rounded-md bg-mint px-2.5 py-1 text-[13px] font-medium">{r.badge}</span>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{r.intro}</p>
          <RegisterForm t={r} locale={locale} />
        </section>
      </main>

      <SiteFooter t={t} />
    </>
  );
}
