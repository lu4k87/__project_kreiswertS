// Brand card of the auth pages (Figma "Log in"): tagline on dark green, PET photo with overlay card.
import Image from "next/image";
import type { Messages } from "@/i18n/messages";
import Link from "next/link";
import { ROUTES } from "@/components/layout/links";
import { ArrowUpRightIcon, LoopIcon } from "@/components/ui/icons";

export function AuthBrandCard({ t }: { t: Messages["login"] }) {
  return (
    <section className="order-last overflow-hidden rounded-2xl bg-brand text-white lg:order-none">
      <div className="p-8 sm:p-10">
        <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.16em] text-on-brand-muted uppercase">
          <LoopIcon size={16} />
          {t.kicker}
        </p>
        {/* tagline, not a section heading → <p> keeps the page's h1 on top */}
        <p className="mt-5 text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.1] font-medium tracking-[-0.025em] text-balance">
          {t.titleLine1}
          <br />
          {t.titleLine2}
        </p>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-on-brand-muted">{t.text}</p>
      </div>
      <div className="relative aspect-[620/435]">
        <Image
          src="/images/pet-flakes.jpg"
          alt={t.imageAlt}
          fill
          sizes="(min-width: 1024px) 620px, 100vw"
          className="object-cover"
          priority
        />
        {/* Overlay card deliberately sits on the photo. */}
        <Link
          href={ROUTES.about}
          className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-lg bg-canvas px-4 py-3 text-ink shadow-sm sm:inset-x-7 sm:bottom-7"
        >
          <span className="min-w-0">
            <span className="block text-[15px]">{t.imageTitle}</span>
            <span className="block text-xs text-muted">{t.imageText}</span>
          </span>
          <ArrowUpRightIcon size={18} />
        </Link>
      </div>
    </section>
  );
}
