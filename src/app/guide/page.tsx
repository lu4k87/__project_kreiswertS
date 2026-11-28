// Guide (function no. 46): legal duties of both sides, by-product or waste, how a cooperation works, sources.
// Public and static – no backend, no data; texts DE/EN in src/i18n/guide.ts. Orientation only, no legal advice.
import { headers } from "next/headers";
import { guide } from "@/i18n/guide";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewerOrGuest } from "@/server/viewer";
import { Badge, Notice, PageHeader, Section, linkClass } from "@/components/ui/elements";
import { STATUS_PHOTOS, StockPhoto } from "@/components/ui/material-photo";
import {
  ArrowUpRightIcon,
  BanIcon,
  FileTextIcon,
  FlameIcon,
  HandshakeIcon,
  InfoIcon,
  MailIcon,
  PackageIcon,
  RecycleIcon,
  RefreshIcon,
  SearchIcon,
  ShieldCheckIcon,
  TrashIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { ProcessSteps } from "@/components/ui/process-steps";
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
  // Waste hierarchy (KrWG § 6) as a funnel: each level a little narrower and lighter than the one before.
  // Tint = share of brand green mixed into mint; white text only on the two dark levels (contrast ≥ 4.5:1 in both themes).
  const levels = [
    { icon: <BanIcon size={20} />, width: "sm:w-full", tint: 100, onDark: true },
    { icon: <RefreshIcon size={20} />, width: "sm:w-[90%]", tint: 80, onDark: true },
    { icon: <RecycleIcon size={20} />, width: "sm:w-[80%]", tint: 35, onDark: false },
    { icon: <FlameIcon size={20} />, width: "sm:w-[70%]", tint: 15, onDark: false },
    { icon: <TrashIcon size={20} />, width: "sm:w-[60%]", tint: 0, onDark: false },
  ];
  // Icons of the six steps, same order as g.steps.
  const stepIcons = [PackageIcon, SearchIcon, MailIcon, HandshakeIcon, FileTextIcon, TruckIcon];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="public" isMember={viewer.role !== "guest"} />
      <main id="content" className="app-area mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        <PageHeader title={g.title} intro={g.lead} />

        <Notice tone="attention" title={g.disclaimerTitle}>
          <p>{g.disclaimer}</p>
          <p className="mt-1 font-medium">{g.updated}</p>
        </Notice>

        <Section title={g.statusTitle} icon={<InfoIcon size={18} />} id="status">
          <p className="text-[15px] leading-relaxed text-pretty">{g.statusIntro}</p>
          <ul className="mt-5 grid items-start gap-4 md:grid-cols-3">
            {g.statuses.map((status) => (
              <li key={status.key} className="grid content-start gap-3 rounded-xl border border-line p-4">
                {/* Example photo centred above the title (decision of 2026-11-28); the title names the case. */}
                <StockPhoto photo={STATUS_PHOTOS[status.key]} sizes="(min-width: 768px) 330px, 100vw" className="h-36 w-full" />
                <div className="grid min-w-0 justify-items-center gap-1.5 text-center">
                  <h3 className="min-w-0 text-lg leading-snug font-semibold text-balance break-words hyphens-auto">{status.title}</h3>
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
          <p className="mt-4 text-[15px] leading-relaxed text-pretty">{g.statusFormNote}</p>

          <div className="mt-8 grid items-start gap-x-10 gap-y-4 border-t border-line pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="grid content-start gap-1">
              <h3 className="text-lg leading-snug font-semibold">{g.hierarchyTitle}</h3>
              <p className="text-[15px] leading-relaxed text-pretty">{g.hierarchyText}</p>
            </div>
            <div className="grid gap-2">
              <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.04em] uppercase">
                <ArrowUpRightIcon size={15} className="-rotate-45" />
                {g.hierarchyHigh}
              </p>
              <ol className="grid gap-1.5">
                {g.hierarchy.map((label, index) => {
                  const level = levels[index];
                  return (
                    <li
                      key={label}
                      style={{ background: `color-mix(in oklab, var(--color-brand) ${level.tint}%, var(--color-mint))` }}
                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] leading-snug font-medium ${level.width} ${level.onDark ? "text-white" : ""}`}
                    >
                      <span className="w-4 flex-none text-right font-semibold tabular-nums">{index + 1}</span>
                      {level.icon}
                      <span className="min-w-0 break-words hyphens-auto text-pretty">{label}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.04em] uppercase">
                <ArrowUpRightIcon size={15} className="rotate-135" />
                {g.hierarchyLow}
              </p>
            </div>
          </div>
        </Section>

        <Section title={g.dutiesTitle} icon={<ShieldCheckIcon size={18} />} id="duties">
          <p className="text-[15px] leading-relaxed text-pretty">{g.dutiesIntro}</p>
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
          <p className="text-[15px] leading-relaxed text-pretty">{g.flowIntro}</p>
          <div className="mt-6">
            <ProcessSteps
              stepLabel={g.stepLabel}
              steps={g.steps.map((step, index) => {
                const StepIcon = stepIcons[index];
                return { ...step, icon: <StepIcon size={20} /> };
              })}
            />
          </div>
          <p className="prose-justify mt-5 text-[15px] leading-relaxed">
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
