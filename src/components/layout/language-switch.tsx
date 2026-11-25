"use client";
// DE / EN switch: stores the language in a cookie and re-renders the server components.
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/messages";
import { GlobeIcon } from "@/components/ui/icons";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5 text-sm text-muted">
      <GlobeIcon size={16} />
      {LOCALES.map((code, index) => (
        <span key={code} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">/</span>}
          <button
            type="button"
            onClick={() => choose(code)}
            aria-pressed={code === locale}
            lang={code}
            className="rounded px-0.5 uppercase hover:text-ink aria-pressed:font-semibold aria-pressed:text-ink"
          >
            {code}
          </button>
        </span>
      ))}
    </div>
  );
}
