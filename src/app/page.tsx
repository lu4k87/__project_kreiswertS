// Start page (Figma "Overview"): hero, map, call to action, platform numbers, features, teaser.
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewerOrGuest } from "@/server/viewer";
import { getPlatformStats, type PlatformStats } from "@/server/dal/stats";
import { publicMap, type PublicMap } from "@/server/dal/map";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ROUTES } from "@/components/layout/links";
import { MaterialMap } from "@/components/home/material-map";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BuildingIcon,
  HandshakeIcon,
  PackageIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";

async function loadMap(): Promise<PublicMap | null> {
  try {
    return await publicMap();
  } catch (error) {
    console.error("Start page: map data could not be loaded", error instanceof Error ? error.name : "");
    return null; // the map still shows the region, without park areas
  }
}

async function loadStats(): Promise<PlatformStats | null> {
  try {
    return await getPlatformStats();
  } catch (error) {
    console.error("Start page: figures could not be loaded", error);
    return null; // page still renders; numbers show "–"
  }
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = messages[locale];
  const [viewer, stats, map] = await Promise.all([getViewerOrGuest(await headers()), loadStats(), loadMap()]);
  const isMember = viewer.role !== "guest";
  // Guests continue to the public regional map; accounts go to the offers (the platform checks the site status).
  const exploreHref = isMember ? ROUTES.offers : ROUTES.regionalMap;
  const number = new Intl.NumberFormat(locale);
  const statItems = [
    { value: stats?.businesses, label: t.home.stats.businesses },
    { value: stats?.materials, label: t.home.stats.materials },
    { value: stats?.parks, label: t.home.stats.parks },
  ];
  const features: { icon: ReactNode; title: string; text: string }[] = [
    { icon: <SearchIcon />, ...t.home.features.find },
    { icon: <PackageIcon />, ...t.home.features.surplus },
    { icon: <HandshakeIcon />, ...t.home.features.connect },
  ];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="home" isMember={isMember} />

      <main className="mx-auto w-full max-w-[1328px] px-5 sm:px-8 lg:px-12">
        <section className="grid gap-6 pt-12 pb-8 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,23.5rem)] lg:items-end">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">{t.home.kicker}</p>
            <h1 className="mt-4 text-[clamp(2.5rem,5.2vw,4rem)] leading-[1.06] font-medium tracking-[-0.03em] text-balance">
              {t.home.titleLine1}
              <br />
              {t.home.titleLine2}
            </h1>
          </div>
          <p className="max-w-[36rem] text-base leading-relaxed text-pretty text-muted lg:pb-2">{t.home.subline}</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <MaterialMap t={t.home.map} platform={t.platform} map={map} />

          <div className="flex flex-col rounded-2xl bg-brand p-8 text-white">
            <p className="flex w-fit items-center gap-1.5 rounded-md bg-mint px-2 py-1 text-xs font-medium text-ink">
              <BuildingIcon size={14} />
              {t.home.cta.badge}
            </p>
            <h2 className="mt-6 text-[clamp(1.75rem,2.4vw,2rem)] leading-tight font-medium tracking-[-0.02em] text-balance">
              {t.home.cta.titleLine1}
              <br />
              {t.home.cta.titleLine2}
            </h2>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-on-brand-muted">{t.home.cta.text}</p>
            <div className="mt-auto flex flex-col items-center gap-4 pt-8">
              <Link
                href={exploreHref}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold hover:bg-brand-hover"
              >
                <ArrowUpRightIcon size={18} />
                {/* a logged-in member is not a guest → same label as the teaser button below */}
                {isMember ? t.home.teaser.button : t.home.cta.guest}
              </Link>
              {viewer.role === "guest" && (
                <p className="text-center text-sm text-on-brand-muted">
                  {t.home.cta.member}{" "}
                  <Link
                    href={ROUTES.login}
                    className="inline-flex items-center gap-1 font-semibold text-white hover:underline"
                  >
                    {t.home.cta.logIn}
                    <ArrowRightIcon size={14} />
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          aria-label={t.home.stats.label}
          className="flex flex-wrap items-center gap-x-16 gap-y-5 border-b border-line py-9 lg:gap-x-28"
        >
          <dl className="contents">
            {statItems.map((item) => (
              // label first for screen readers ("businesses connected: 12"), shown after the number
              <div key={item.label} className="flex flex-row-reverse items-baseline justify-end gap-3">
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {item.value == null ? <span aria-label={t.home.stats.unavailable}>–</span> : number.format(item.value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center gap-2 text-sm text-muted lg:ml-auto">
            <ShieldCheckIcon size={18} />
            {t.home.stats.verified}
          </p>
        </section>

        <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-6 py-9">
          <h2 id="how-it-works-heading" className="sr-only">
            {t.home.features.heading}
          </h2>
          <ul className="grid gap-8 lg:grid-cols-3 lg:gap-10">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-10 flex-none place-items-center rounded-lg bg-mint">{f.icon}</span>
                <div className="min-w-0">
                  <h3 className="text-lg leading-tight font-semibold">{f.title}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16 flex flex-wrap items-center gap-x-8 gap-y-5 rounded-2xl border border-line bg-surface/50 p-5">
          <Image
            src="/images/pet-flakes.jpg"
            alt={t.home.teaser.imageAlt}
            width={1216}
            height={656}
            sizes="136px"
            className="h-[76px] w-[136px] flex-none rounded-lg object-cover"
          />
          <div className="min-w-[16rem] flex-1">
            <h2 className="text-lg leading-tight font-semibold text-balance">{t.home.teaser.title}</h2>
            <p className="mt-1 text-[15px] text-muted">{t.home.teaser.text}</p>
          </div>
          <Link
            href={exploreHref}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-3.5 font-semibold text-white hover:bg-brand-hover"
          >
            <ArrowRightIcon size={18} />
            {t.home.teaser.button}
          </Link>
        </section>
      </main>

      <SiteFooter t={t} />
    </>
  );
}
