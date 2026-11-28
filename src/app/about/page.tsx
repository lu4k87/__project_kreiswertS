// About & how it works (PG-02): what the platform does, for whom, what the prototype is not, and the five
// illustrative cases A–E (L1-021) – always labelled as simulated.
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getCatalogue } from "@/server/dal/catalogue";
import { listDemoCases } from "@/server/dal/map";
import { getViewerOrGuest } from "@/server/viewer";
import { Badge, PageHeader, Section, buttonInverse, buttonOnBrand } from "@/components/ui/elements";
import { BuildingIcon, FactoryIcon, InfoIcon, MailIcon, PackageIcon, RecycleIcon, RefreshIcon, SearchIcon } from "@/components/ui/icons";
import { ProcessSteps } from "@/components/ui/process-steps";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROUTES } from "@/components/layout/links";
import { CategoryTiles } from "@/components/offers/category-tiles";

/** Cases and catalogue for the page; null when the database is unreachable – the static text still renders. */
async function load() {
  try {
    const [cases, catalogue] = await Promise.all([listDemoCases(), getCatalogue()]);
    return { cases, categories: catalogue.categories };
  } catch (error) {
    console.error("About page: data could not be loaded", error instanceof Error ? error.name : "");
    return null;
  }
}

export default async function AboutPage() {
  const locale = await getLocale();
  const t = messages[locale];
  const p = t.platform;
  const a = p.about;
  const [viewer, data] = await Promise.all([getViewerOrGuest(await headers()), load()]);
  const audiences: { icon: ReactNode; title: string; text: string }[] = [
    { icon: <PackageIcon size={18} />, title: a.offerersTitle, text: a.offerersText },
    { icon: <SearchIcon size={18} />, title: a.requestersTitle, text: a.requestersText },
    { icon: <RefreshIcon size={18} />, title: a.recyclersTitle, text: a.recyclersText },
  ];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="public" current="about" isMember={viewer.role !== "guest"} />
      <main id="content" className="app-area mx-auto grid max-w-[1328px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        <PageHeader title={a.title} intro={a.lead} />

        <Section title={a.whatTitle} icon={<FactoryIcon size={18} />} id="what">
          <p className="prose-justify text-[15px] leading-relaxed">{a.whatText}</p>
          <ul className="mt-5 grid items-start gap-4 md:grid-cols-3">
            {audiences.map((audience) => (
              <li key={audience.title} className="grid content-start gap-2 rounded-xl border border-line p-4">
                <span className="grid size-9 place-items-center rounded-lg bg-mint">{audience.icon}</span>
                <h3 className="text-lg leading-snug font-semibold text-balance">{audience.title}</h3>
                <p className="text-[15px] leading-relaxed text-pretty">{audience.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Section title={a.stepsTitle} icon={<RefreshIcon size={18} />} id="steps">
            <ProcessSteps
              layout="vertical"
              stepLabel={a.stepLabel}
              steps={a.steps.map((step, index) => {
                const StepIcon = [BuildingIcon, SearchIcon, MailIcon][index] ?? RefreshIcon;
                return { ...step, icon: <StepIcon size={20} /> };
              })}
            />
          </Section>
          <Section title={a.limitsTitle} icon={<InfoIcon size={18} />} id="limits">
            <ul className="grid list-disc gap-2 pl-5 text-[15px] leading-relaxed">
              {a.limits.map((limit) => (
                <li key={limit} className="text-pretty">
                  {limit}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {data && (
          <>
            <Section title={a.scopeTitle} icon={<RecycleIcon size={18} />} id="scope">
              <p className="prose-justify mb-4 text-[15px] leading-relaxed">{a.scopeText}</p>
              <CategoryTiles categories={data.categories} t={p} locale={locale} />
            </Section>

            {data.cases.length > 0 && (
              <Section title={a.casesTitle} icon={<RefreshIcon size={18} />} id="cases">
                <p className="prose-justify text-[15px] leading-relaxed">{a.casesIntro}</p>
                <ul className="mt-4 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.cases.map((entry) => (
                    <li key={entry.code} className="grid content-start gap-2 rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-7 flex-none place-items-center rounded-full border border-ink text-[13px] font-semibold">{entry.code}</span>
                        <Badge tone="attention">{a.simulated}</Badge>
                      </div>
                      <h3 className="text-lg leading-snug font-semibold text-balance">{locale === "de" ? entry.titleDe : entry.titleEn}</h3>
                      <p className="text-[15px] leading-relaxed text-pretty">{locale === "de" ? entry.textDe : entry.textEn}</p>
                      <p className="text-[13px] text-muted">
                        {a.pathway}: {p.labels.pathway[entry.pathway]}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand p-5 sm:p-6">
          <Link href={viewer.role === "guest" ? ROUTES.register : ROUTES.dashboard} className={buttonInverse}>
            {viewer.role === "guest" ? a.cta : t.header.dashboard}
          </Link>
          <Link href={ROUTES.regionalMap} className={buttonOnBrand}>
            {a.ctaMap}
          </Link>
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
