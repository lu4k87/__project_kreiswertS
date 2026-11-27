// Guide (function no. 46): legal duties of both sides, by-product or waste, how a cooperation works, sources.
// Public and static – no backend, no data; texts DE/EN in src/i18n/guide.ts. Orientation only, no legal advice.
import { headers } from "next/headers";
import { guide } from "@/i18n/guide";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewerOrGuest } from "@/server/viewer";
import { Badge, Notice, PageHeader, Section, linkClass } from "@/components/ui/elements";
import { ArrowUpRightIcon, FileTextIcon, HandshakeIcon, InfoIcon, PackageIcon, RecycleIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default async function GuidePage() {
  const locale = await getLocale();
  const t = messages[locale];
  const g = guide[locale];
  const viewer = await getViewerOrGuest(await headers());
  const sides = [
    { icon: <PackageIcon size={18} />, ...g.supplier },
    { icon: <RecycleIcon size={18} />, ...g.receiver },
  ];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="public" isMember={viewer.role !== "guest"} />
      <main id="content" className="mx-auto grid w-full max-w-[1100px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        <PageHeader title={g.title} intro={g.lead} />

        <Notice tone="attention" title={g.disclaimerTitle}>
          <p>{g.disclaimer}</p>
          <p className="mt-1 font-medium">{g.updated}</p>
        </Notice>

        <Section title={g.statusTitle} icon={<InfoIcon size={18} />} id="status">
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-pretty">{g.statusIntro}</p>
          <ul className="mt-5 grid items-start gap-4 md:grid-cols-3">
            {g.statuses.map((status) => (
              <li key={status.key} className="grid content-start gap-3 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg leading-snug font-semibold text-balance">{status.title}</h3>
                  <Badge tone="outline">{status.law}</Badge>
                </div>
                <p className="text-[15px] leading-relaxed text-pretty">{status.text}</p>
                <ul className="grid gap-1.5 text-[15px] leading-normal" aria-label={g.conditions}>
                  {status.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-[0.55em] size-1.5 flex-none rounded-full bg-brand" />
                      <span className="min-w-0 text-pretty">{point}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-pretty">{g.statusFormNote}</p>

          <h3 className="mt-6 text-lg leading-snug font-semibold">{g.hierarchyTitle}</h3>
          <p className="mt-1 max-w-[68ch] text-[15px] leading-relaxed text-pretty">{g.hierarchyText}</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {g.hierarchy.map((level, index) => (
              <li key={level} className="flex items-center gap-2 rounded-lg bg-mint px-3 py-2 text-[15px] leading-snug font-medium lg:grid lg:content-start lg:gap-1">
                <span className="tabular-nums">{index + 1}.</span>
                <span className="min-w-0 break-words hyphens-auto text-pretty">{level}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={g.dutiesTitle} icon={<ShieldCheckIcon size={18} />} id="duties">
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-pretty">{g.dutiesIntro}</p>
          <div className="mt-5 grid items-start gap-4 md:grid-cols-2">
            {sides.map((side) => (
              <article key={side.title} className="grid content-start gap-3 rounded-xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 flex-none place-items-center rounded-lg bg-mint">{side.icon}</span>
                  <h3 className="text-lg leading-snug font-semibold text-balance">{side.title}</h3>
                </div>
                <p className="text-[15px] leading-relaxed text-pretty">{side.text}</p>
                <ul className="grid gap-2 text-[15px] leading-normal">
                  {side.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-[0.55em] size-1.5 flex-none rounded-full bg-brand" />
                      <span className="min-w-0 text-pretty">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section title={g.flowTitle} icon={<HandshakeIcon size={18} />} id="flow">
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-pretty">{g.flowIntro}</p>
          <ol className="mt-5 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-xl border border-line p-4">
                <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-brand text-[15px] font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
                <div className="grid min-w-0 gap-1">
                  <h3 className="text-lg leading-snug font-semibold text-balance">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-pretty">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="prose-justify mt-5 max-w-[68ch] text-[15px] leading-relaxed">
            <span className="font-semibold">{g.platformTitle}:</span> {g.platformText}
          </p>
        </Section>

        <Section title={g.sourcesTitle} icon={<FileTextIcon size={18} />} id="sources">
          <p className="text-[15px] leading-relaxed">{g.sourcesIntro}</p>
          <ul className="mt-3 grid gap-2 text-[15px] leading-normal">
            {g.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-start gap-1.5`}>
                  <span className="min-w-0 text-pretty">{source.label}</span>
                  <ArrowUpRightIcon size={15} className="mt-[0.2em] flex-none" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
